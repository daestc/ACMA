// 주간 계획 시간 조정 규칙 단위 사례 (DB·AI 없이 순수 함수만 검사).
// 실행: node scripts/checkPlanAdjustment.js — 하나라도 틀리면 종료 코드 1.

const { computeAdjustment, applyCategoryFactors } = require('../services/ai/planAdjustment');
const validator = require('../services/ai/validator');

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(expected)})`}`);
};

const item = (category, state, answer = {}) => ({ category, state, difficulty: null, missReason: null, ...answer });
const summary = (a) => ({ applied: a.applied, factor: a.hoursFactor, cats: a.categoryFactors.map(c => `${c.category}x${c.factor}`) });

console.log('\n[1] 최근 수행 속도(시간 기준 달성률)');
check('기록 없음 → 조정 없음', summary(computeAdjustment()), { applied: false, factor: 1, cats: [] });
check('평균 95% → 조정 없음', computeAdjustment({ recentRates: [0.95] }).hoursFactor, 1);
check('평균 90% → 조정 없음(경계)', computeAdjustment({ recentRates: [0.9] }).hoursFactor, 1);
check('평균 76%(0.72, 0.8) → 총 시간 ×0.76', computeAdjustment({ recentRates: [0.72, 0.8] }).hoursFactor, 0.76);
check('평균 30% → 하한 ×0.6', computeAdjustment({ recentRates: [0.3] }).hoursFactor, 0.6);
check('조정 이유에 근거 주 수와 달성률이 들어간다', computeAdjustment({ recentRates: [0.72, 0.8] }).reasons[0].includes('최근 2주') && computeAdjustment({ recentRates: [0.72, 0.8] }).reasons[0].includes('76%'), true);

console.log('\n[2] 미완료 이유: 시간 부족');
const timeHeavy = [item('course', 'missed', { missReason: 'time' }), item('skill', 'partial', { missReason: 'time' }), item('cert', 'missed', { missReason: 'other' })];
check('미완료 3개 중 2개가 시간 부족 → ×0.8', computeAdjustment({ reviewItems: timeHeavy }).hoursFactor, 0.8);
check('절반(1/2)이면 적용', computeAdjustment({ reviewItems: [item('course', 'missed', { missReason: 'time' }), item('skill', 'missed', { missReason: 'other' })] }).shortageFactor, 0.8);
check('절반 미만(1/3)이면 적용 안 함', computeAdjustment({ reviewItems: [item('course', 'missed', { missReason: 'time' }), item('skill', 'missed', { missReason: 'other' }), item('cert', 'missed', { missReason: 'other' })] }).shortageFactor, 1);
check('속도 조정과 곱한다: 평균 76% × 0.8 → 0.61', computeAdjustment({ recentRates: [0.76], reviewItems: timeHeavy }).hoursFactor, 0.61);
check('총 시간은 가용 시간의 절반 밑으로 내려가지 않는다', computeAdjustment({ recentRates: [0.3], reviewItems: timeHeavy }).hoursFactor, 0.5);
check('하한이 적용되면 그 사실을 이유에 남긴다', computeAdjustment({ recentRates: [0.3], reviewItems: timeHeavy }).reasons.some(r => r.includes('아래로 줄이지 않았습니다')), true);
check('하한에 걸리지 않으면 하한 문장은 없다', computeAdjustment({ recentRates: [0.76] }).reasons.some(r => r.includes('아래로 줄이지 않았습니다')), false);
check('응답이 없는 미완료 항목은 세지 않는다', computeAdjustment({ reviewItems: [item('course', 'missed'), item('skill', 'missed')] }).applied, false);

console.log('\n[3] 난도: 카테고리별 시간 늘리기');
const hard = [
  item('course', 'missed', { missReason: 'hard' }), item('course', 'done', { difficulty: 'hard' }), item('course', 'done', { difficulty: 'normal' }),
  item('cert', 'done', { difficulty: 'easy' }),
];
check('과목: 어렵다는 응답 2/3 → ×1.3, 자격증은 그대로', summary(computeAdjustment({ reviewItems: hard })).cats, ['coursex1.3']);
check('난도 보정만 있어도 조정 적용으로 표시, 총 시간은 그대로', summary(computeAdjustment({ reviewItems: hard })), { applied: true, factor: 1, cats: ['coursex1.3'] });
check('완료 항목에는 이유를 무시하고 난도만 본다', computeAdjustment({ reviewItems: [item('skill', 'done', { missReason: 'hard' })] }).categoryFactors.length, 0);

console.log('\n[4] 다른 일정이 주된 이유');
const otherHeavy = [item('course', 'missed', { missReason: 'other' }), item('skill', 'missed', { missReason: 'other' }), item('cert', 'missed', { missReason: 'time' })];
const other = computeAdjustment({ reviewItems: otherHeavy });
check('시간은 그대로(×1), 조정 이유만 남김', [other.hoursFactor, other.applied, other.reasons.length], [1, true, 1]);

console.log('\n[5] 난도 보정 적용(0.5시간 단위)');
const base = [
  { title: 'a', category: 'cert', estimatedHours: 4 }, { title: 'b', category: 'cert', estimatedHours: 3 },
  { title: 'c', category: 'cert', estimatedHours: 0 }, { title: 'd', category: 'skill', estimatedHours: 4 },
];
check('자격증 ×1.3: 4h→5h, 3h→4h, 0h 그대로, 다른 카테고리 그대로',
  applyCategoryFactors(base, [{ category: 'cert', factor: 1.3 }]).map(i => i.estimatedHours), [5, 4, 0, 4]);
check('배수가 없으면 원본 그대로', applyCategoryFactors(base, []) === base, true);
check('원본 배열은 바뀌지 않는다', base[0].estimatedHours, 4);

console.log('\n[6] 시간 한도(hoursLimit) 검증');
const plan = {
  goal: 'g',
  items: [
    { title: 'p1', category: 'project', estimatedHours: 6, priority: 1, isDeadline: false, reason: '' },
    { title: 'p2', category: 'skill', estimatedHours: 6, priority: 2, isDeadline: false, reason: '' },
    { title: 'p3', category: 'course', estimatedHours: 6, priority: 3, isDeadline: false, reason: '' },
  ],
};
const limited = validator.validateWeeklyPlan(plan, { computed: { availableHoursTotal: 30, hoursLimit: 12 } });
check('한도 12h: 우선순위 낮은 항목이 빠져 12h', [limited.sanitized.items.length, limited.sanitized.allocatedHours], [2, 12]);
const unlimited = validator.validateWeeklyPlan(plan, { computed: { availableHoursTotal: 30 } });
check('hoursLimit가 없으면 가용 시간 전체(옛 계획과 같은 동작)', unlimited.sanitized.items.length, 3);

console.log(failed ? `\n❌ ${failed}건 실패` : '\n✅ 모두 통과');
process.exit(failed ? 1 : 0);
