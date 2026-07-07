const axios   = require('axios');
const User    = require('../models/User');
const Payment = require('../models/Payment');
const logger  = require('../config/logger');

const TOSS_CLIENT_KEY = (process.env.TOSS_CLIENT_KEY || '').trim();
const TOSS_SECRET_KEY = (process.env.TOSS_SECRET_KEY || '').trim();
const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

const PREMIUM_PRICE = 9900;
const PREMIUM_DAYS  = 30;

// 토스 Basic 인증 헤더
function tossAuthHeader() {
  return 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');
}

// ── 플랜 페이지 ─────────────────────────────────────────
exports.getPlansPage = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id)
      .select('planType premiumUntil pointBalance dailyUsage')
      .lean();

    const now = new Date();

    // 프리미엄 만료 자동 처리
    if (user.planType === 'premium' && user.premiumUntil && now > user.premiumUntil) {
      await User.findByIdAndUpdate(user._id, { planType: 'free', premiumUntil: null });
      user.planType = 'free';
      user.premiumUntil = null;
      req.session.user.planType = 'free';
      await new Promise((r, j) => req.session.save(e => e ? j(e) : r()));
    }

    // 결제는 완료됐는데 User 업데이트만 실패한 경우 자동 복구
    if (user.planType === 'free') {
      const donePremium = await Payment.findOne({
        userId: user._id,
        type: 'premium',
        status: 'done',
        premiumUntil: { $gt: now },
      }).lean();
      if (donePremium) {
        await User.findByIdAndUpdate(user._id, {
          planType: 'premium',
          premiumUntil: donePremium.premiumUntil,
        });
        user.planType = 'premium';
        user.premiumUntil = donePremium.premiumUntil;
        req.session.user.planType = 'premium';
        await new Promise((r, j) => req.session.save(e => e ? j(e) : r()));
        logger.info(`프리미엄 자동 복구 | userId=${user._id} | orderId=${donePremium.orderId}`);
      }
    }

    res.render('pages/payment', {
      user:          { ...req.session.user, ...user },
      pageTitle:     '플랜',
      currentPage:   'payment',
      clientKey:     TOSS_CLIENT_KEY,
    });
  } catch (err) {
    next(err);
  }
};

// ── 결제 준비 (프리미엄) ──────────────────────────────────
exports.checkoutPremium = async (req, res, next) => {
  try {
    const userId  = req.session.user.id;
    const orderId = `PREMIUM-${userId}-${Date.now()}`;

    await Payment.create({
      userId,
      orderId,
      orderName: 'AcadMe 프리미엄 1개월',
      amount:    PREMIUM_PRICE,
      type:      'premium',
      status:    'pending',
    });

    res.json({ ok: true, orderId, amount: PREMIUM_PRICE, orderName: 'AcadMe 프리미엄 1개월' });
  } catch (err) {
    next(err);
  }
};

// ── 결제 준비 (포인트) ────────────────────────────────────
exports.checkoutPoint = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const ALLOWED = [1000, 3000, 5000, 10000, 30000];
    if (!ALLOWED.includes(Number(amount))) {
      return res.status(400).json({ ok: false, message: '유효하지 않은 충전 금액입니다.' });
    }
    const userId  = req.session.user.id;
    const orderId = `POINT-${userId}-${Date.now()}`;

    await Payment.create({
      userId,
      orderId,
      orderName: `AcadMe 포인트 ${Number(amount).toLocaleString()}원`,
      amount:    Number(amount),
      type:      'point',
      status:    'pending',
    });

    res.json({ ok: true, orderId, amount: Number(amount), orderName: `AcadMe 포인트 ${Number(amount).toLocaleString()}원` });
  } catch (err) {
    next(err);
  }
};

// ── 결제 성공 콜백 (Toss 리다이렉트) ─────────────────────
exports.confirmPayment = async (req, res, next) => {
  const { paymentKey, orderId, amount } = req.query;

  try {
    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.redirect('/payment/fail?message=주문정보를 찾을 수 없습니다.');
    if (payment.status === 'done') return res.redirect('/payment?already=1');
    if (String(payment.amount) !== String(amount)) {
      return res.redirect('/payment/fail?message=결제금액이 일치하지 않습니다.');
    }

    // 토스 결제 승인
    const { data: tossData } = await axios.post(
      TOSS_CONFIRM_URL,
      { paymentKey, orderId, amount: Number(amount) },
      { headers: { Authorization: tossAuthHeader(), 'Content-Type': 'application/json' } },
    );

    const now = new Date();

    if (payment.type === 'premium') {
      const user = await User.findById(payment.userId).select('premiumUntil').lean();
      const base = (user.premiumUntil && user.premiumUntil > now) ? user.premiumUntil : now;
      const until = new Date(base.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);

      // Toss 승인 완료 — 돈이 나간 시점이므로 Payment를 먼저 'done'으로 확정
      await Payment.findByIdAndUpdate(payment._id, {
        paymentKey,
        status:       'done',
        method:       tossData.method,
        paidAt:       now,
        premiumFrom:  now,
        premiumUntil: until,
        rawResponse:  tossData,
      });

      // User DB 업데이트 — 실패해도 Payment 기록은 이미 보존됨
      try {
        await User.findByIdAndUpdate(payment.userId, {
          planType: 'premium',
          premiumUntil: until,
        });
      } catch (err) {
        logger.warn(`프리미엄 User 업데이트 실패 (결제는 완료) | orderId=${orderId} | userId=${payment.userId} | ${err.message}`);
      }

      // 세션 갱신 — 실패해도 다음 페이지 로드 시 DB에서 반영됨
      if (req.session.user.id.toString() === payment.userId.toString()) {
        req.session.user.planType = 'premium';
        await new Promise((r, j) => req.session.save(e => e ? j(e) : r())).catch(() => {});
      }

      logger.info(`결제완료(프리미엄) | orderId=${orderId} | userId=${payment.userId}`);
      return res.redirect(`/payment/success?type=premium&until=${encodeURIComponent(until.toLocaleDateString('ko-KR'))}`);
    }

    if (payment.type === 'point') {
      // Toss 승인 완료 — Payment 먼저 확정
      await Payment.findByIdAndUpdate(payment._id, {
        paymentKey,
        status:       'done',
        method:       tossData.method,
        paidAt:       now,
        pointAwarded: payment.amount,
        rawResponse:  tossData,
      });

      // User 포인트 적립 — 실패해도 Payment 기록은 보존됨
      try {
        await User.findByIdAndUpdate(payment.userId, {
          $inc: { pointBalance: payment.amount },
        });
      } catch (err) {
        logger.warn(`포인트 User 업데이트 실패 (결제는 완료) | orderId=${orderId} | userId=${payment.userId} | ${err.message}`);
      }

      if (req.session.user.id.toString() === payment.userId.toString()) {
        req.session.user.pointBalance = (req.session.user.pointBalance || 0) + payment.amount;
        await new Promise((r, j) => req.session.save(e => e ? j(e) : r())).catch(() => {});
      }

      logger.info(`결제완료(포인트) | orderId=${orderId} | amount=${payment.amount} | userId=${payment.userId}`);
      return res.redirect(`/payment/success?type=point&amount=${payment.amount}`);
    }
  } catch (err) {
    logger.warn(`결제승인실패 | orderId=${orderId} | ${err.message}`);
    const msg = err.response?.data?.message || '결제 처리 중 오류가 발생했습니다.';
    // Toss API 자체가 실패한 경우에만 'failed' 처리 (돈이 나가지 않은 상태)
    if (orderId) {
      await Payment.findOneAndUpdate(
        { orderId, status: 'pending' },
        { status: 'failed' },
      ).catch(() => {});
    }
    return res.redirect(`/payment/fail?message=${encodeURIComponent(msg)}`);
  }
};

// ── 결제 성공 페이지 ──────────────────────────────────────
exports.getSuccessPage = (req, res) => {
  res.render('pages/paymentSuccess', {
    user:        req.session.user,
    pageTitle:   '결제 완료',
    currentPage: 'payment',
    type:        req.query.type,
    until:       req.query.until || null,
    amount:      req.query.amount || null,
  });
};

// ── 결제 실패 페이지 ──────────────────────────────────────
exports.getFailPage = (req, res) => {
  res.render('pages/paymentFail', {
    user:        req.session.user,
    pageTitle:   '결제 실패',
    currentPage: 'payment',
    message:     req.query.message || '결제가 취소되었습니다.',
  });
};

// ── 결제 내역 페이지 ──────────────────────────────────────
exports.getHistoryPage = async (req, res, next) => {
  try {
    const payments = await Payment.find({
      userId: req.session.user.id,
      status: 'done',
    })
      .sort({ paidAt: -1 })
      .limit(50)
      .lean();

    res.render('pages/paymentHistory', {
      user:        req.session.user,
      pageTitle:   '결제 내역',
      currentPage: 'payment',
      payments,
    });
  } catch (err) {
    next(err);
  }
};
