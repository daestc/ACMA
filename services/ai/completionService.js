const { DailyChecklist } = require('../../models/Calendar');
const { WeeklyPlan } = require('../../models/Ai');

const MAX_INCOMPLETE_ITEMS = 5;

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

  const prevPlan = await WeeklyPlan.findOne({ userId, weekStart: prevWeekStart }).select('_id items').lean();
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

module.exports = { calcCompletionRate, getPreviousWeekFeedback };
