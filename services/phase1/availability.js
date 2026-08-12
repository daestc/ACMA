const calendarService = require('../calendarService');

// Timetable에서 요일별 가용 학습시간(시간 단위) 계산 — calendarService.calcAvailableHours를
// AI 컨텍스트 시그니처(number[7], 0=일요일)에 맞게 감싸는 어댑터
async function calcAvailableHours(userId, semester, dailyBudgetHours = 6) {
  const byDay = await calendarService.calcAvailableHours(userId, semester);

  return Array.from({ length: 7 }, (_, day) => {
    const freeMinutes = (byDay[day] || []).reduce((sum, slot) => sum + slot.minutes, 0);
    return Math.min(dailyBudgetHours, +(freeMinutes / 60).toFixed(1));
  });
}

module.exports = { calcAvailableHours };
