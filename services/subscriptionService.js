const crypto = require('crypto');
const { PLANS, getPlan, isPaidPlan } = require('../config/subscriptionPlans');

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

function createCheckoutOrder(session, user, planId) {
  cleanupExpiredOrders();

  if (!isPaidPlan(planId)) {
    const err = new Error('유료 플랜만 결제할 수 있습니다.');
    err.code = 'INVALID_PLAN';
    throw err;
  }

  const plan = getPlan(planId);
  const orderId = `sub_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  pendingOrders.set(orderId, {
    userId: String(user.id),
    planId: plan.id,
    amount: plan.price,
    createdAt: Date.now(),
  });

  return {
    orderId,
    orderName: `AcadMe ${plan.label} 구독`,
    amount: plan.price,
    planId: plan.id,
  };
}

function getPendingOrder(orderId) {
  cleanupExpiredOrders();
  return pendingOrders.get(orderId) || null;
}

function completeCheckout(session, user, { orderId, paymentKey }) {
  const pending = getPendingOrder(orderId);
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

  const sub = normalizeSubscription(session);
  sub.plan = pending.planId;
  sub.aiUsed = 0;
  sub.periodKey = getPeriodKey();
  sub.paymentKey = paymentKey;
  sub.orderId = orderId;
  sub.subscribedAt = new Date().toISOString();

  pendingOrders.delete(orderId);

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

function resetToFreePlan(session) {
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
