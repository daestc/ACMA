const { DailyChecklist } = require('../../models/Calendar');
const { WeeklyPlan } = require('../../models/Ai');
const kstDate = require('../../utils/kstDate');

const MAX_INCOMPLETE_ITEMS = 5;
const DEFAULT_HISTORY_LIMIT = 12;

function collectAiItems(checklists, weeklyPlanId) {
  const items = [];
  checklists.forEach(doc => {
    (doc.items || []).forEach(item => {
      if (item.source === 'ai' && String(item.weeklyPlanId) === String(weeklyPlanId)) {
        items.push(item);
      }
    });
  });
  return items;
}

// 특정 주간계획의 달성률 (0~1). 대상 항목이 하나도 없으면 null(0과 구분 — "아무것도
// 안 함"과 "애초에 배치된 게 없음"을 섞으면 다음 주 계획이 잘못 위축된다).
async function calcCompletionRate(userId, weeklyPlanId) {
  const checklists = await DailyChecklist.find({ userId, 'items.weeklyPlanId': weeklyPlanId })
    .select('items')
    .lean();

  const aiItems = collectAiItems(checklists, weeklyPlanId);
  if (aiItems.length === 0) return null;

  const completed = aiItems.filter(item => item.isCompleted).length;
  return +(completed / aiItems.length).toFixed(2);
}

// 직전 주 달성률 — 새 주간계획 생성 프롬프트에 넣는다
async function getPreviousWeekFeedback(userId, weekStart) {
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

  // Date 완전 일치(findOne({weekStart: prevWeekStart}))는 위험하다 — weekStart가
  // 정확히 KST 자정(예: 15:00:00.000Z)으로 저장돼 있어야만 매칭되는데, 생성 경로가
  // 하나라도 다른 헬퍼를 쓰거나 밀리초가 어긋나면 조용히 못 찾고 rate:null로 빠져서
  // 원인 추적이 어렵다. 그날 하루 범위로 조회하면 이런 미세한 시각 불일치에 안전하다.
  const prevWeekStartRangeEnd = new Date(prevWeekStart.getTime() + 24 * 60 * 60 * 1000);
  const prevPlan = await WeeklyPlan.findOne({
    userId,
    weekStart: { $gte: prevWeekStart, $lt: prevWeekStartRangeEnd },
  }).sort({ weekStart: -1 }).select('_id items').lean();
  if (!prevPlan) return { rate: null, incompleteItems: [] };

  const checklists = await DailyChecklist.find({ userId, 'items.weeklyPlanId': prevPlan._id })
    .select('items')
    .lean();

  const aiItems = collectAiItems(checklists, prevPlan._id);
  const rate = aiItems.length === 0 ? null : +(aiItems.filter(i => i.isCompleted).length / aiItems.length).toFixed(2);

  // item.content는 dailyDistributor가 날짜별로 쪼개면서 "(1/3, 3h)" 같은 분할 표기를
  // 이미 붙인 문자열이다 — 이걸 그대로 LLM에 넘기면 새 주간계획의 title에 분할 표기가
  // 그대로 복사된다(실제로 발생한 사고). planItemIndex로 원본 WeeklyPlan.items[]를
  // 역참조해 깨끗한 title만 넘긴다. 같은 항목이 여러 날에 걸쳐 쪼개져 있으면
  // planItemIndex가 같으므로 Set으로 중복 제거한다.
  const incompleteIndexes = [...new Set(
    aiItems.filter(i => !i.isCompleted && i.planItemIndex != null).map(i => i.planItemIndex),
  )];
  const incompleteItems = incompleteIndexes
    .map(idx => prevPlan.items?.[idx]?.title)
    .filter(Boolean)
    .slice(0, MAX_INCOMPLETE_ITEMS);

  return { rate, incompleteItems };
}

// plans(WeeklyPlan[])를 아우르는 날짜 범위 하나로 DailyChecklist를 한 번만 조회해
// weeklyPlanId별 AI 항목 배열로 묶는다. history/stats처럼 여러 주를 한 번에 다루는
// 곳에서 calcCompletionRate를 주 개수만큼 호출하면 왕복이 그만큼 늘어난다.
async function fetchAiItemsByPlan(userId, plans) {
  const itemsByPlan = new Map();
  if (plans.length === 0) return itemsByPlan;

  const minDate = plans.reduce((min, p) => (p.weekStart < min ? p.weekStart : min), plans[0].weekStart);
  const maxDate = plans.reduce((max, p) => (p.weekEnd > max ? p.weekEnd : max), plans[0].weekEnd);

  const checklists = await DailyChecklist.find({
    userId,
    date: { $gte: kstDate.toKstDateString(minDate), $lte: kstDate.toKstDateString(maxDate) },
  }).select('items').lean();

  checklists.forEach(doc => {
    (doc.items || []).forEach(item => {
      if (item.source !== 'ai' || !item.weeklyPlanId) return;
      const key = String(item.weeklyPlanId);
      if (!itemsByPlan.has(key)) itemsByPlan.set(key, []);
      itemsByPlan.get(key).push(item);
    });
  });

  return itemsByPlan;
}

function rateOf(aiItems) {
  return aiItems.length === 0 ? null : +(aiItems.filter(i => i.isCompleted).length / aiItems.length).toFixed(2);
}

// 최근 완료된 주간계획 목록 + 각 주의 달성률. 화면의 "지난 계획들" 목록용.
async function getWeeklyPlanHistory(userId, limit = DEFAULT_HISTORY_LIMIT) {
  const plans = await WeeklyPlan.find({ userId, status: 'done' })
    .sort({ weekStart: -1 })
    .limit(limit)
    .select('weekStart weekEnd goal items computed.allocatedHours computed.academicPhase')
    .lean();

  const itemsByPlan = await fetchAiItemsByPlan(userId, plans);

  return plans.map(plan => ({
    weeklyPlanId: plan._id,
    weekStart: plan.weekStart,
    weekEnd: plan.weekEnd,
    goal: plan.goal,
    itemCount: (plan.items || []).length,
    completionRate: rateOf(itemsByPlan.get(String(plan._id)) || []),
    allocatedHours: plan.computed?.allocatedHours ?? 0,
    academicPhase: plan.computed?.academicPhase ?? null,
  }));
}

// 최근 주부터 거슬러 올라가며 "그 주에 계획이 있었고(공백 없이 연속) + 뭐라도 했다"가
// 끊기는 지점까지 센다. 계획 자체가 없는 주(생성을 건너뜀)나 완료율 0인 주에서 멈춘다.
function computeStreak(weekRatesDesc) {
  let streak = 0;
  let expectedWeekStart = null;
  for (const w of weekRatesDesc) {
    if (expectedWeekStart !== null && w.weekStart.getTime() !== expectedWeekStart.getTime()) break;
    if (w.completionRate == null || w.completionRate <= 0) break;
    streak += 1;
    expectedWeekStart = new Date(w.weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return streak;
}

// 전체 기간 요약 통계. byCategory는 completionRate와 같은 방식(슬롯 단위 — 큰 항목이
// 여러 날로 쪼개지면 그만큼 분모도 늘어남)으로 세어 기존 달성률 계산과 의미를 맞춘다.
async function getWeeklyPlanStats(userId) {
  const plans = await WeeklyPlan.find({ userId, status: 'done' })
    .sort({ weekStart: -1 })
    .select('weekStart weekEnd items')
    .lean();

  if (plans.length === 0) {
    return { totalWeeks: 0, avgCompletionRate: null, currentStreak: 0, byCategory: [] };
  }

  const itemsByPlan = await fetchAiItemsByPlan(userId, plans);
  const categoryTotals = new Map();
  const weekRates = plans.map(plan => {
    const aiItems = itemsByPlan.get(String(plan._id)) || [];

    aiItems.forEach(item => {
      if (item.planItemIndex == null) return;
      const category = plan.items?.[item.planItemIndex]?.category || 'other';
      if (!categoryTotals.has(category)) categoryTotals.set(category, { planned: 0, completed: 0 });
      const bucket = categoryTotals.get(category);
      bucket.planned += 1;
      if (item.isCompleted) bucket.completed += 1;
    });

    return { weekStart: plan.weekStart, completionRate: rateOf(aiItems) };
  });

  const validRates = weekRates.map(w => w.completionRate).filter(r => r != null);
  const avgCompletionRate = validRates.length
    ? +(validRates.reduce((sum, r) => sum + r, 0) / validRates.length).toFixed(2)
    : null;

  const byCategory = [...categoryTotals.entries()]
    .map(([category, { planned, completed }]) => ({
      category, planned, completed, rate: planned ? +(completed / planned).toFixed(2) : 0,
    }))
    .sort((a, b) => b.planned - a.planned);

  return {
    totalWeeks: plans.length,
    avgCompletionRate,
    currentStreak: computeStreak(weekRates),
    byCategory,
  };
}

module.exports = { calcCompletionRate, getPreviousWeekFeedback, getWeeklyPlanHistory, getWeeklyPlanStats };
