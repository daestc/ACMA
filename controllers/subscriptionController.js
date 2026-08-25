const subscriptionService = require('../services/subscriptionService');
const tossPaymentService = require('../services/tossPaymentService');
const logger = require('../config/logger');

const getSubscriptionPage = (req, res) => {
  const status = subscriptionService.getSubscriptionStatus(req.session);
  const clientKey = tossPaymentService.getClientKey();

  res.render('pages/subscription', {
    user: req.user,
    pageTitle: '구독 · 요금제',
    currentPage: 'subscription',
    plans: subscriptionService.PLANS,
    status,
    clientKey,
    hasTossKey: Boolean(clientKey),
  });
};

const getSubscriptionStatus = (req, res) => {
  res.json({
    ok: true,
    status: subscriptionService.getSubscriptionStatus(req.session),
  });
};

const createCheckout = (req, res) => {
  try {
    const planId = req.body?.plan;
    const checkout = subscriptionService.createCheckoutOrder(req.session, req.user, planId);
    const clientKey = tossPaymentService.getClientKey();

    if (!clientKey) {
      return res.status(500).json({
        ok: false,
        message: '토스페이먼츠 Client Key가 설정되지 않았습니다.',
      });
    }

    res.json({
      ok: true,
      checkout: {
        ...checkout,
        customerName: req.user.name,
        customerEmail: req.user.email,
        clientKey,
        successUrl: `${req.protocol}://${req.get('host')}/subscription/success`,
        failUrl: `${req.protocol}://${req.get('host')}/subscription/fail`,
      },
    });
  } catch (err) {
    if (err.code === 'INVALID_PLAN') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '결제 준비 중 오류가 발생했습니다.' });
  }
};

const confirmSubscriptionPayment = async (req, res) => {
  try {
    const { paymentKey, orderId, amount } = req.query;

    if (!paymentKey || !orderId || !amount) {
      return res.render('pages/subscriptionFail', {
        user: req.user,
        pageTitle: '결제 실패',
        currentPage: 'subscription',
        message: '결제 정보가 올바르지 않습니다.',
      });
    }

    const pending = subscriptionService.getPendingOrder(orderId);
    if (!pending || pending.userId !== String(req.user.id)) {
      return res.render('pages/subscriptionFail', {
        user: req.user,
        pageTitle: '결제 실패',
        currentPage: 'subscription',
        message: '유효하지 않은 결제 주문입니다.',
      });
    }

    if (Number(amount) !== pending.amount) {
      return res.render('pages/subscriptionFail', {
        user: req.user,
        pageTitle: '결제 실패',
        currentPage: 'subscription',
        message: '결제 금액이 일치하지 않습니다.',
      });
    }

    const payment = await tossPaymentService.confirmPayment({
      paymentKey,
      orderId,
      amount,
    });

    if (payment.status !== 'DONE') {
      return res.render('pages/subscriptionFail', {
        user: req.user,
        pageTitle: '결제 실패',
        currentPage: 'subscription',
        message: '결제 승인에 실패했습니다.',
      });
    }

    const status = subscriptionService.completeCheckout(req.session, req.user, {
      orderId,
      paymentKey,
    });

    logger.info(`구독 결제 완료 | user=${req.user.email} | plan=${status.plan} | orderId=${orderId}`);

    res.render('pages/subscriptionSuccess', {
      user: req.user,
      pageTitle: '구독 완료',
      currentPage: 'subscription',
      status,
      payment,
    });
  } catch (err) {
    logger.warn(`구독 결제 승인 실패 | user=${req.user?.email} | ${err.message}`);

    res.render('pages/subscriptionFail', {
      user: req.user,
      pageTitle: '결제 실패',
      currentPage: 'subscription',
      message: err.response?.data?.message || err.message || '결제 처리 중 오류가 발생했습니다.',
    });
  }
};

const renderFailPage = (req, res) => {
  res.render('pages/subscriptionFail', {
    user: req.user,
    pageTitle: '결제 실패',
    currentPage: 'subscription',
    message: req.query.message || '결제가 취소되었거나 실패했습니다.',
    code: req.query.code || '',
  });
};

const useAiQuota = (req, res) => {
  try {
    const count = Number(req.body?.count) || 1;
    const status = subscriptionService.consumeAiQuota(req.session, count);
    res.json({ ok: true, status });
  } catch (err) {
    if (err.code === 'AI_LIMIT_EXCEEDED') {
      return res.status(429).json({
        ok: false,
        code: err.code,
        message: err.message,
        status: err.status,
      });
    }
    res.status(500).json({ ok: false, message: 'AI 한도 처리 중 오류가 발생했습니다.' });
  }
};

const cancelSubscription = (req, res) => {
  const status = subscriptionService.resetToFreePlan(req.session);
  res.json({ ok: true, status, message: '무료 플랜으로 변경되었습니다. (세션 기준, DB 미저장)' });
};

module.exports = {
  getSubscriptionPage,
  getSubscriptionStatus,
  createCheckout,
  confirmSubscriptionPayment,
  renderFailPage,
  useAiQuota,
  cancelSubscription,
};
