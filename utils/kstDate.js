const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Date → "YYYY-MM-DD" (KST 자정 기준). 서버 TZ와 무관하게 항상 같은 결과.
function toKstDateString(date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" → 그 날 00:00 KST에 해당하는 UTC Date.
// 문자열에 +09:00을 직접 박아넣으므로 서버 TZ 설정과 무관하게 항상 같은 시각을 낸다.
function fromKstDateString(str) {
  return new Date(`${str}T00:00:00+09:00`);
}

// KST 기준 요일 인덱스 (0=일 … 6=토) — Timetable.schedule.dayOfWeek와 동일 규약.
function getKstDayOfWeek(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).getUTCDay();
}

// 주어진 날짜가 속한 주의 일요일 00:00 KST (Date 반환)
function getWeekStart(date) {
  const kstMidnight = fromKstDateString(toKstDateString(date));
  const dow = getKstDayOfWeek(date);
  const start = new Date(kstMidnight);
  start.setUTCDate(start.getUTCDate() - dow);
  return start;
}

// weekStart로부터 7일치 "YYYY-MM-DD" 배열 [일,월,화,수,목,금,토]
function getWeekDateStrings(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return toKstDateString(d);
  });
}

module.exports = {
  toKstDateString,
  fromKstDateString,
  getWeekStart,
  getWeekDateStrings,
  getKstDayOfWeek,
};
