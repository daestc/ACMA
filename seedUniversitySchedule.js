/* ================================================
   대학 학사일정(UniversitySchedule) 시드 스크립트
   AI 주간계획의 academicPhase(중간고사/기말고사/방학/개강)가
   실제로 발동하려면 이 데이터가 있어야 한다 — 지금까지는 대상 대학의
   학사일정이 하나도 없어서 academicPhase가 항상 'normal'로만 나왔다.
   사용법: node seedUniversitySchedule.js
   ================================================ */
require('dotenv').config();
const connectDB = require('./config/database');
const UniversitySchedule = require('./models/UniversitySchedule');

const UNIVERSITY = '대진대학교';

// semester_start는 원문 학사일정표엔 개강일 하루만 있지만, weeklyPlan 프롬프트 규칙
// ("개강 첫 주는 수강 과목 파악과 학기 계획 수립에 배분")이 주 단위로 동작해야
// 의미가 있으므로 개강일부터 1주일로 기간을 잡는다.
const SCHEDULES = [
  { type: 'semester_start', title: '2026-1학기 개강', startDate: '2026-03-02', endDate: '2026-03-08' },
  { type: 'midterm', title: '2026-1학기 중간고사', startDate: '2026-04-20', endDate: '2026-04-24' },
  { type: 'final', title: '2026-1학기 기말고사', startDate: '2026-06-15', endDate: '2026-06-19' },
  { type: 'vacation', title: '2026년 여름방학', startDate: '2026-06-22', endDate: '2026-08-31' },
  { type: 'semester_start', title: '2026-2학기 개강', startDate: '2026-09-01', endDate: '2026-09-07' },
  { type: 'midterm', title: '2026-2학기 중간고사', startDate: '2026-10-19', endDate: '2026-10-23' },
  { type: 'final', title: '2026-2학기 기말고사', startDate: '2026-12-14', endDate: '2026-12-18' },
  { type: 'vacation', title: '2026-2027년 겨울방학', startDate: '2026-12-21', endDate: '2027-02-28' },
];

(async () => {
  try {
    await connectDB();

    for (const schedule of SCHEDULES) {
      await UniversitySchedule.findOneAndUpdate(
        { university: UNIVERSITY, type: schedule.type, startDate: new Date(schedule.startDate) },
        {
          university: UNIVERSITY,
          title: schedule.title,
          type: schedule.type,
          startDate: new Date(schedule.startDate),
          endDate: new Date(schedule.endDate),
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      console.log(`✅ ${schedule.title} (${schedule.startDate} ~ ${schedule.endDate})`);
    }

    console.log(`\n${UNIVERSITY} 학사일정 ${SCHEDULES.length}건 반영 완료.`);
    process.exit(0);
  } catch (err) {
    console.error('실패:', err.message);
    process.exit(1);
  }
})();
