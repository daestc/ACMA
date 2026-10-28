const crypto = require('crypto');
const { PLANS, getPlan, isPaidPlan } = require('../config/subscriptionPlans');
const Payment = require('../models/Payment');
const User = require('../models/User');

// 재시작 복구용 캐시 — DB가 원본, Map은 빠른 조회용
const pendingOrders = new Map();
const ORDER_TTL_MS = 30 * 60 * 1000;

function getPeriodKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function cleanupExpiredOrders() {
  const now = Date.now();
  for (const [orderId, order] of pendingOrders.entries()) {
    if (now - order.createdAt > ORDER_TTL_MS) {
      pendingOrders.delete(orderId);
    }
  }
}

function initSessionSubscription(session) {
  if (!session.subscription) {
    session.subscription = {
      plan: 'free',
      aiUsed: 0,
      periodKey: getPeriodKey(),
      paymentKey: null,
      orderId: null,
      subscribedAt: null,
    };
  }
  return session.subscription;
}

function normalizeSubscription(session) {
  const sub = initSessionSubscription(session);
  const currentPeriod = getPeriodKey();
  if (sub.periodKey !== currentPeriod) {
    sub.aiUsed = 0;
    sub.periodKey = currentPeriod;
  }
  return sub;
}

function getSubscriptionStatus(session) {
  const sub = normalizeSubscription(session);
  const plan = getPlan(sub.plan);
  return {
    plan: plan.id,
    planName: plan.label,
    aiLimit: plan.aiLimit,
    aiUsed: sub.aiUsed,
    aiRemaining: Math.max(plan.aiLimit - sub.aiUsed, 0),
    periodKey: sub.periodKey,
    subscribedAt: sub.subscribedAt,
    isPaid: isPaidPlan(plan.id),
  };
}

// 결제 준비 — DB에 pending 레코드 저장 (프로세스 재시작 시 복구 가능)
async function createCheckoutOrder(session, user, planId) {
  cleanupExpiredOrders();

  if (!isPaidPlan(planId)) {
    const err = new Error('유료 플랜만 결제할 수 있습니다.');
    err.code = 'INVALID_PLAN';
    throw err;
  }

  const plan = getPlan(planId);
  const orderId = `sub_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // DB에 pending 레코드 저장
  await Payment.create({
    userId:    user.id,
    orderId,
    orderName: `AcadMe ${plan.label} 구독`,
    amount:    plan.price,
    type:      'subscription',
    status:    'pending',
  });

  // 메모리 캐시에도 등록 (빠른 조회용)
  pendingOrders.set(orderId, {
    userId:    String(user.id),
    planId:    plan.id,
    amount:    plan.price,
    createdAt: Date.now(),
  });

  return {
    orderId,
    orderName: `AcadMe ${plan.label} 구독`,
    amount:    plan.price,
    planId:    plan.id,
  };
}

// 메모리 캐시 우선 조회, 없으면 DB 폴백 (재시작 복구)
async function getPendingOrder(orderId) {
  cleanupExpiredOrders();
  if (pendingOrders.has(orderId)) {
    return pendingOrders.get(orderId);
  }

  const record = await Payment.findOne({ orderId, type: 'subscription', status: 'pending' }).lean();
  if (!record) return null;

  // DB에서 찾으면 캐시 복구
  const order = {
    userId:    String(record.userId),
    planId:    record.orderName.includes('Pro') ? 'pro' : 'basic',
    amount:    record.amount,
    createdAt: record.createdAt?.getTime() || Date.now(),
  };
  pendingOrders.set(orderId, order);
  return order;
}

// 결제 완료 — DB Payment 확정 + User planType 업데이트
async function completeCheckout(session, user, { orderId, paymentKey, tossData }) {
  const pending = await getPendingOrder(orderId);
  if (!pending) {
    const err = new Error('결제 주문 정보를 찾을 수 없습니다.');
    err.code = 'ORDER_NOT_FOUND';
    throw err;
  }

  if (pending.userId !== String(user.id)) {
    const err = new Error('결제 주문 정보가 일치하지 않습니다.');
    err.code = 'ORDER_MISMATCH';
    throw err;
  }

  const now = new Date();

  // Payment 레코드 확정
  await Payment.findOneAndUpdate(
    { orderId, status: { $in: ['pending', 'processing'] } },
    {
      $set: {
        paymentKey,
        status:    'done',
        paidAt:    now,
        rawResponse: tossData || null,
      },
    }
  );

  // User planType 업데이트
  await User.findByIdAndUpdate(user.id, { $set: { planType: pending.planId } });

  // 메모리 캐시 정리
  pendingOrders.delete(orderId);

  // 세션 업데이트
  const sub = normalizeSubscription(session);
  sub.plan        = pending.planId;
  sub.aiUsed      = 0;
  sub.periodKey   = getPeriodKey();
  sub.paymentKey  = paymentKey;
  sub.orderId     = orderId;
  sub.subscribedAt = now.toISOString();

  return getSubscriptionStatus(session);
}

function consumeAiQuota(session, count = 1) {
  const sub = normalizeSubscription(session);
  const plan = getPlan(sub.plan);

  if (sub.aiUsed + count > plan.aiLimit) {
    const err = new Error(`AI 사용 한도를 초과했습니다. (${plan.label} 월 ${plan.aiLimit}회)`);
    err.code = 'AI_LIMIT_EXCEEDED';
    err.status = getSubscriptionStatus(session);
    throw err;
  }

  sub.aiUsed += count;
  return getSubscriptionStatus(session);
}

// 구독 취소 — Payment canceled + User planType 복원
async function resetToFreePlan(session, userId) {
  // 현재 세션의 orderId로 Payment canceled 처리
  const sub = session.subscription;
  if (sub?.orderId) {
    await Payment.findOneAndUpdate(
      { orderId: sub.orderId, status: 'done' },
      { $set: { status: 'canceled' } }
    );
  }

  if (userId) {
    await User.findByIdAndUpdate(userId, { $set: { planType: 'free' } });
  }

  session.subscription = {
    plan: 'free',
    aiUsed: 0,
    periodKey: getPeriodKey(),
    paymentKey: null,
    orderId: null,
    subscribedAt: null,
  };

  return getSubscriptionStatus(session);
}

module.exports = {
  PLANS,
  getPlan,
  getSubscriptionStatus,
  createCheckoutOrder,
  getPendingOrder,
  completeCheckout,
  consumeAiQuota,
  resetToFreePlan,
};
