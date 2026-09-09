const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    label: '무료',
    price: 0,
    aiLimit: 10,
    description: '기본 AI 기능 체험',
    features: ['월 AI 10회', '기본 학습 도구'],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    label: 'Plus',
    price: 4900,
    aiLimit: 100,
    description: '학습·요약에 충분한 AI 한도',
    features: ['월 AI 100회', 'AI 학습 요약', '퀴즈 생성'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    label: 'Pro',
    price: 9900,
    aiLimit: 500,
    description: '무제한에 가까운 AI 활용',
    features: ['월 AI 500회', 'AI 학습 요약', '퀴즈 생성', '우선 응답'],
  },
};

const PAID_PLAN_IDS = ['plus', 'pro'];

function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

function isPaidPlan(planId) {
  return PAID_PLAN_IDS.includes(planId);
}

module.exports = {
  PLANS,
  PAID_PLAN_IDS,
  getPlan,
  isPaidPlan,
};
