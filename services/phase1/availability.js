const calendarService = require('../calendarService');
const { Timetable } = require('../../models/Calendar');

// Timetable에서 요일별 가용 학습시간(시간 단위) 계산 — calendarService.calcAvailableHours를
// AI 컨텍스트 시그니처(number[7], 0=일요일)에 맞게 감싸는 어댑터.
//
// semester가 null이거나(방학 등 학기 공백기) 해당 학기 Timetable이 아예 없으면
// calendarService.calcAvailableHours는 조용히 빈 스케줄을 반환해 하루 종일
// dailyBudgetHours(기본 6시간)가 그대로 "가용 시간"으로 나간다 — 실제 시간표를 반영한
// 값인지, 데이터가 없어 기본값으로 때운 것인지 호출부가 구분할 수 없었다(실제로
// 방학 주간에 매번 6시간 균일로 나오는데도 사용자에게 아무 안내가 안 가는 문제로
// 이어짐). calendarService.calcAvailableHours와 동일한 조건으로 존재 여부만 별도
// 조회해 hasTimetable로 알려준다.
async function calcAvailableHours(userId, semester, dailyBudgetHours = 6) {
  const [byDay, hasTimetable] = await Promise.all([
    calendarService.calcAvailableHours(userId, semester),
    Timetable.exists({ userId, isActive: true, $or: [{ semester }, { semester: null }] }).then(Boolean),
  ]);

  const hoursByDay = Array.from({ length: 7 }, (_, day) => {
    const freeMinutes = (byDay[day] || []).reduce((sum, slot) => sum + slot.minutes, 0);
    return Math.min(dailyBudgetHours, +(freeMinutes / 60).toFixed(1));
  });

  return { hoursByDay, hasTimetable };
}

module.exports = { calcAvailableHours };
