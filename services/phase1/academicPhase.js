const User = require('../../models/User');
const calendarService = require('../calendarService');
const dateCaculate = require('../../service/dateCaculateService');

// 캘린더.js의 parseSemesterRange와 동일한 월 기준 휴리스틱(1학기: 3~6월, 2학기: 9~12월)
// 주의: contextBuilder.js가 이 반환값을 await 없이 바로 다음 인자로 넘겨쓴다(동기 함수
// 전제). async로 바꾸면 Promise가 semester 자리에 들어가 조회가 조용히 0건이 된다.
function deriveSemesterFromDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 6) return `${year}-1`;
  if (month >= 9 && month <= 12) return `${year}-2`;
  return null;
}

// 오늘이 시험기간/방학/등록기간인지 + 다음 시험까지 남은 일수 (userId 기준 어댑터)
async function getAcademicContext(userId, date = new Date()) {
  const user = await User.findById(userId).select('university').lean();
  const ctx = await calendarService.getAcademicContext(user?.university, date);

  let phase = 'normal';
  if (ctx.isExamPeriod) {
    phase = ctx.examType;
  } else if (ctx.isVacation) {
    phase = 'vacation';
  } else if (ctx.activeSchedules.some(s => s.type === 'registration')) {
    phase = 'registration';
  } else if (ctx.activeSchedules.some(s => s.type === 'semester_start')) {
    phase = 'semester_start';
  }

  const upcoming = (ctx.examSchedules || [])
    .map(s => dateCaculate.getRemainingDays(s.startDate))
    .filter(d => d !== null && d >= 0);

  const daysUntilNextExam = ctx.isExamPeriod ? 0 : (upcoming.length ? Math.min(...upcoming) : null);

  return {
    phase,
    semester: deriveSemesterFromDate(date),
    daysUntilNextExam,
  };
}

module.exports = { getAcademicContext, deriveSemesterFromDate };
