const { DailyChecklist } = require('../../models/Calendar');
const kstDate = require('../../utils/kstDate');

const MIN_SLOT_HOURS = 1;    // 1시간 미만 조각을 만들지 않는다
const MAX_SLOT_HOURS = 3;    // 한 항목이 하루를 다 채우지 않게
const MAX_ITEMS_PER_DAY = 4; // 체크리스트가 길면 아무도 안 본다 — 이 알고리즘의 핵심 안전장치
const CONTENT_MAX_LENGTH = 80;

function formatContent(title, hours, sliceIndex, totalSlices, isZeroHour) {
  let content;
  if (isZeroHour) {
    content = title;
  } else if (totalSlices <= 1) {
    content = `${title} (${hours}h)`;
  } else {
    content = `${title} (${sliceIndex + 1}/${totalSlices}, ${hours}h)`;
  }
  return content.length > CONTENT_MAX_LENGTH ? `${content.slice(0, CONTENT_MAX_LENGTH - 1)}…` : content;
}

// items를 정렬: isDeadline 먼저, 그다음 dueDate 오름차순(가까운 마감 먼저), 그다음 priority 오름차순
function sortForDistribution(items) {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const ai = a.item;
      const bi = b.item;
      if (Boolean(ai.isDeadline) !== Boolean(bi.isDeadline)) return ai.isDeadline ? -1 : 1;
      const ad = ai.dueDate ? new Date(ai.dueDate).getTime() : Infinity;
      const bd = bi.dueDate ? new Date(bi.dueDate).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return (ai.priority ?? 3) - (bi.priority ?? 3);
    });
}

/**
 * WeeklyPlan.items를 요일별 DailyChecklist 항목으로 결정적으로 분배한다.
 * 순수 함수 — DB 접근 없음, LLM 미사용.
 * @param {object} weeklyPlan  status:'done'인 WeeklyPlan 문서(lean) — weekStart, items, _id 사용
 * @param {number[]} availableHoursByDay  weeklyPlan.computed.availableHoursByDay (0=일)
 * @returns {{ byDate: Map<string, Array<{content, hours, source, weeklyPlanId, planItemIndex, order}>>, errors: string[], weekDates: string[] }}
 */
function distribute(weeklyPlan, availableHoursByDay) {
  const errors = [];
  const weekDates = kstDate.getWeekDateStrings(weeklyPlan.weekStart);
  const today = kstDate.toKstDateString(new Date());
  const availableDates = weekDates.filter(d => d >= today);

  if (availableDates.length === 0) {
    errors.push('이번 주가 이미 다 지나 배치할 수 있는 날짜가 없습니다.');
    return { byDate: new Map(), errors, weekDates };
  }

  const hasAnyCapacity = availableDates.some(d => {
    const dow = kstDate.getKstDayOfWeek(kstDate.fromKstDateString(d));
    return (availableHoursByDay?.[dow] || 0) > 0;
  });
  if (!hasAnyCapacity) {
    errors.push('가용 시간이 전부 0입니다. 시간표를 등록해 주세요.');
    return { byDate: new Map(), errors, weekDates };
  }

  const usedHoursByDate = new Map(availableDates.map(d => [d, 0]));
  const itemCountByDate = new Map(availableDates.map(d => [d, 0]));
  const byDate = new Map(availableDates.map(d => [d, []]));
  let orderCounter = 1000;

  const sortedItems = sortForDistribution(weeklyPlan.items || []);

  for (const { item, idx } of sortedItems) {
    const dueDateStr = item.dueDate ? kstDate.toKstDateString(new Date(item.dueDate)) : null;
    const isZeroHour = !(item.estimatedHours > 0);
    const slots = []; // { date, hours }

    if (isZeroHour) {
      // 체크만 하면 되는 항목 — 시간 용량을 쓰지 않고 하루에 1회만 배치
      const date = availableDates.find(d => {
        if (dueDateStr && d > dueDateStr) return false;
        return (itemCountByDate.get(d) || 0) < MAX_ITEMS_PER_DAY;
      });
      if (date) {
        slots.push({ date, hours: 0 });
        itemCountByDate.set(date, (itemCountByDate.get(date) || 0) + 1);
      } else {
        errors.push(`"${item.title}"을(를) 배치할 날짜를 찾지 못함`);
      }
    } else {
      let remaining = item.estimatedHours;

      // MAX_SLOT_HOURS는 "하루에 이 항목이 한 번에 차지할 수 있는 최대치"이지
      // "하루 전체 상한"이 아니다 — 한 번 훑어서 못 끝내면(예: 6시간짜리 항목이
      // 하루 6시간 여유가 있는 날 하나뿐인데 3시간씩 끊어야 함) 그 날을 다시 방문해
      // 남은 시간을 마저 채운다. 한 바퀴 돌아도 진전이 없으면(용량이 다 찼거나
      // MIN_SLOT_HOURS 미만만 남음) 종료 — 무한루프 방지.
      let progressed = true;
      while (remaining > 0 && progressed) {
        progressed = false;

        for (const date of availableDates) {
          if (remaining <= 0) break;
          if (dueDateStr && date > dueDateStr) continue; // 마감 지난 날짜만 건너뜀
          if ((itemCountByDate.get(date) || 0) >= MAX_ITEMS_PER_DAY) continue;

          const dow = kstDate.getKstDayOfWeek(kstDate.fromKstDateString(date));
          const capacity = (availableHoursByDay?.[dow] || 0) - (usedHoursByDate.get(date) || 0);
          if (capacity < MIN_SLOT_HOURS) continue;

          let slot = Math.min(remaining, capacity, MAX_SLOT_HOURS);
          slot = Math.round(slot * 2) / 2; // 0.5시간 단위 반올림
          if (slot < MIN_SLOT_HOURS) continue;

          slots.push({ date, hours: slot });
          usedHoursByDate.set(date, (usedHoursByDate.get(date) || 0) + slot);
          itemCountByDate.set(date, (itemCountByDate.get(date) || 0) + 1);
          remaining -= slot;
          progressed = true;
        }
      }

      if (remaining > 0) {
        errors.push(`"${item.title}" ${remaining}시간을 배치하지 못함`);
      }
    }

    // 라벨링: 총 조각 수를 알아야 하므로 슬롯이 전부 정해진 뒤에 진행
    slots.forEach((slot, sliceIndex) => {
      byDate.get(slot.date).push({
        content: formatContent(item.title, slot.hours, sliceIndex, slots.length, isZeroHour),
        hours: slot.hours,
        source: 'ai',
        weeklyPlanId: weeklyPlan._id,
        planItemIndex: idx,
        order: orderCounter++,
      });
    });
  }

  return { byDate, errors, weekDates };
}

// 하루치 AI 항목을 DailyChecklist에 반영 (단일 날짜, 3단계 — 배치 버전의 기반 단위 로직)
async function applyToChecklist(userId, dateStr, aiItems, weeklyPlanId) {
  // 1단계: 문서 확보 (없으면 생성)
  await DailyChecklist.updateOne(
    { userId, date: dateStr },
    { $setOnInsert: { userId, date: dateStr, items: [] } },
    { upsert: true },
  );

  // 2단계: 이 주간계획이 이전에 넣어둔 "미완료" AI 항목만 제거 (완료 기록은 보존)
  await DailyChecklist.updateOne(
    { userId, date: dateStr },
    { $pull: { items: { source: 'ai', weeklyPlanId, isCompleted: false } } },
  );

  // 3단계: 새 AI 항목 삽입
  if (aiItems.length > 0) {
    await DailyChecklist.updateOne(
      { userId, date: dateStr },
      { $push: { items: { $each: aiItems } } },
    );
  }
}

function toChecklistItem(slot) {
  return {
    content: slot.content,
    isCompleted: false,
    completedAt: null,
    order: slot.order,
    source: 'ai',
    weeklyPlanId: slot.weeklyPlanId,
    planItemIndex: slot.planItemIndex,
  };
}

/**
 * distribute() 결과를 여러 날짜에 한 번에 반영한다. 날짜마다 순차 await하면 최대
 * 21왕복(7일 × 3단계)이 나므로, 단계별로 bulkWrite 3번(=3왕복)으로 묶는다.
 * 각 날짜는 서로 다른 문서라 같은 단계 내 순서는 무관하고, 단계 간 순서만 지키면 된다.
 *
 * byDate의 키는 distribute()가 걸러낸 "오늘 이후" 날짜뿐이다 — 지난 날짜엔 새로
 * 배치할 게 없어서다. 하지만 이 weeklyPlanId가 "이전 회차"에 지난 날짜로 넣어둔
 * 미완료 항목까지 그대로 두면, 재생성할 때마다 과거 날짜에 이전 버전의 항목이
 * 영원히 쌓인다(실제로 발생 — 오래된 항목이 화면에 계속 보임). 그래서 정리(pull)
 * 단계는 byDate가 아니라 이번 주 전체(weekDates)를 대상으로 한다. weekDates가
 * 없으면(과거 호출부 호환) byDate 키로 폴백한다.
 */
async function applyDistributionToChecklists(userId, weeklyPlanId, byDate, weekDates) {
  const pushDates = [...byDate.keys()];
  const cleanupDates = (weekDates && weekDates.length) ? weekDates : pushDates;
  if (cleanupDates.length === 0) return;

  if (pushDates.length > 0) {
    await DailyChecklist.bulkWrite(pushDates.map(date => ({
      updateOne: {
        filter: { userId, date },
        update: { $setOnInsert: { userId, date, items: [] } },
        upsert: true,
      },
    })));
  }

  // 이번 주 전체(과거 포함)에서 이 weeklyPlanId가 남긴 미완료 AI 항목을 정리 —
  // 완료 기록은 그대로 보존한다(isCompleted:false 조건).
  await DailyChecklist.bulkWrite(cleanupDates.map(date => ({
    updateOne: {
      filter: { userId, date },
      update: { $pull: { items: { source: 'ai', weeklyPlanId, isCompleted: false } } },
    },
  })));

  const pushOps = pushDates
    .filter(date => (byDate.get(date) || []).length > 0)
    .map(date => ({
      updateOne: {
        filter: { userId, date },
        update: { $push: { items: { $each: byDate.get(date).map(toChecklistItem) } } },
      },
    }));

  if (pushOps.length > 0) {
    await DailyChecklist.bulkWrite(pushOps);
  }
}

module.exports = { distribute, applyToChecklist, applyDistributionToChecklists };
