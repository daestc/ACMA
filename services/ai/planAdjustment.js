// 지난 실행 기록으로 다음 주 계획의 시간을 조정하는 규칙 (순수 함수만, DB·AI 접근 없음).
// 교수 상담 반영: 사용자마다 학습 속도가 다르므로 달성률(시간 기준), 미완료 이유, 체감 난도로
// "단순하고 설명 가능하게" 조정한다. 조정값은 서버가 계산하고, AI는 그 한도 안에서 계획을 짠다.

const PACE = { min: 0.6, fullAt: 0.9 }; // 최근 평균 달성률이 0.9 이상이면 조정 없음, 그 미만은 비례, 하한 0.6
const SHORTAGE_FACTOR = 0.8; // 미완료 이유의 절반 이상이 '시간 부족'
const HARD_FACTOR = 1.3; // 난도가 높다는 응답이 절반 이상인 카테고리의 항목 시간
const MAJORITY = 0.5;
const FLOOR = 0.5; // 총 시간은 가용 시간의 절반 밑으로는 줄이지 않는다

const CATEGORY_LABEL = {
  cert: '자격증', course: '과목', skill: '스킬', project: '프로젝트',
  language: '어학', graduation: '졸업요건', other: '기타',
};

const round2 = (n) => Math.round(n * 100) / 100;
const pct = (n) => `${Math.round(n * 100)}%`;
const isMissed = (item) => item.state === 'partial' || item.state === 'missed';

/**
 * @param {object} input
 * @param {number[]} input.recentRates 최근 주 달성률(0~1, 시간 기준), 최근 주부터. 없으면 빈 배열.
 * @param {Array<{category: string, state: 'done'|'partial'|'missed', difficulty?: string|null, missReason?: string|null}>} input.reviewItems
 *        직전 주 항목별 실행 상태와 학생이 남긴 "지난주 돌아보기" 응답(없으면 null).
 */
function computeAdjustment({ recentRates = [], reviewItems = [] } = {}) {
  const reasons = [];

  // 1) 최근 수행 속도: 시간 기준 평균 달성률
  const rates = recentRates.filter(r => Number.isFinite(r));
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const paceFactor = avgRate === null || avgRate >= PACE.fullAt ? 1 : Math.max(PACE.min, round2(avgRate));
  if (paceFactor < 1) {
    reasons.push(`최근 ${rates.length}주 평균 달성률이 ${pct(avgRate)}(시간 기준)라서 총 학습 시간을 가용 시간의 ${pct(paceFactor)}로 조정했습니다.`);
  }

  // 2) 미완료 이유가 '시간 부족'에 쏠렸는가
  const missedWithReason = reviewItems.filter(i => isMissed(i) && i.missReason);
  const count = (reason) => missedWithReason.filter(i => i.missReason === reason).length;
  const timeCount = count('time');
  const otherCount = count('other');
  const shortageApplied = missedWithReason.length > 0 && timeCount / missedWithReason.length >= MAJORITY;
  const shortageFactor = shortageApplied ? SHORTAGE_FACTOR : 1;
  if (shortageApplied) {
    reasons.push(`지난주 미완료 ${missedWithReason.length}개 중 ${timeCount}개가 '시간 부족'이라 총 학습 시간을 ${SHORTAGE_FACTOR}배로 더 줄였습니다.`);
  }

  // 3) 난도가 높다는 신호가 절반 이상인 카테고리: 그 카테고리 항목의 시간을 늘린다
  //    신호 = 미완료 이유 '난도 높음' + 완료 항목의 체감 난도 '어려움'. 응답이 있는 항목만 센다.
  const byCategory = new Map();
  reviewItems.forEach(item => {
    const answered = isMissed(item) ? item.missReason : (item.state === 'done' ? item.difficulty : null);
    if (!answered) return;
    const entry = byCategory.get(item.category) || { hard: 0, total: 0 };
    entry.total += 1;
    if ((isMissed(item) && item.missReason === 'hard') || (item.state === 'done' && item.difficulty === 'hard')) entry.hard += 1;
    byCategory.set(item.category, entry);
  });
  const categoryFactors = [];
  byCategory.forEach(({ hard, total }, category) => {
    if (total >= 1 && hard / total >= MAJORITY) {
      categoryFactors.push({ category, factor: HARD_FACTOR });
      reasons.push(`${CATEGORY_LABEL[category] || category} 항목은 어렵다는 응답이 ${total}개 중 ${hard}개라 시간을 ${HARD_FACTOR}배로 늘렸습니다.`);
    }
  });

  // 4) '다른 일정'이 주된 이유: 시간은 그대로 두고 미완료 항목을 우선 배치(AI에게 incompleteItems로 전달됨)
  const otherApplied = !shortageApplied && missedWithReason.length > 0 && otherCount / missedWithReason.length >= MAJORITY;
  if (otherApplied) {
    reasons.push(`지난주 미완료 ${missedWithReason.length}개 중 ${otherCount}개가 '다른 일정' 때문이라 시간은 그대로 두고 미완료 항목을 먼저 배치합니다.`);
  }

  const rawFactor = round2(paceFactor * shortageFactor);
  const hoursFactor = Math.max(FLOOR, rawFactor);
  if (rawFactor < FLOOR) {
    reasons.push(`조정 폭이 커서 총 학습 시간은 가용 시간의 ${pct(FLOOR)} 아래로 줄이지 않았습니다.`);
  }
  return {
    applied: hoursFactor < 1 || categoryFactors.length > 0 || otherApplied,
    hoursFactor,
    paceFactor,
    shortageFactor,
    categoryFactors,
    reasons,
    basis: { weeks: rates.length, timeRate: avgRate === null ? null : round2(avgRate) },
  };
}

// 난도 보정: 해당 카테고리 항목의 시간을 배수로 늘린다(0.5시간 단위). 시간이 0인 항목은 건드리지 않는다.
function applyCategoryFactors(items, categoryFactors = []) {
  if (!categoryFactors.length) return items;
  const factors = new Map(categoryFactors.map(c => [c.category, c.factor]));
  return items.map(item => {
    const factor = factors.get(item.category);
    if (!factor || !(item.estimatedHours > 0)) return item;
    return { ...item, estimatedHours: Math.round(item.estimatedHours * factor * 2) / 2 };
  });
}

module.exports = { computeAdjustment, applyCategoryFactors, PACE, SHORTAGE_FACTOR, HARD_FACTOR, FLOOR, MAJORITY };
