// 학사 일정(UniversitySchedule) 중 type이 'other'인 것을 제목으로 보고 종류를 채운다.
// 관계자 화면이 일정 종류를 보내지 않던 때 등록된 일정은 전부 'other'로 저장되어, 제목이 "기말고사"여도
// 주간 계획의 시험 기간 판단(calendarService.getAcademicContext)에 쓰이지 않았다.
// 키워드는 여기서 한 번만 쓴다 — 시험 기간 판단 자체를 제목으로 하면 "중간고사 대비 특강" 같은 일정이
// 시험 기간이 된다.
//
// 실행: node scripts/backfillScheduleType.js                              (기본 dry-run: 대학별 바뀔 목록과 건수만 출력)
//       node scripts/backfillScheduleType.js --university AcadMe대학교   (한 대학만)
//       node scripts/backfillScheduleType.js --apply [--university <이름>] (실제 반영)
//
// 대상은 type이 'other'인 일정뿐이다. 시드로 넣은 일정이나 관계자가 고른 종류는 건드리지 않는다.
// 주의: 공유 DB에서는 dry-run 결과를 팀에 알린 뒤 --apply 한다(다른 팀원의 테스트 일정도 바뀐다).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// dry-run이 DB를 바꾸지 않도록 자동 인덱스 생성을 전역으로 끈다(모델을 불러오기 전에).
mongoose.set('autoIndex', false);
const UniversitySchedule = require('../models/UniversitySchedule');

// 위에서부터 먼저 걸리는 것
const TITLE_RULES = [
  [/중간고사|중간시험/, 'midterm'],
  [/기말고사|기말시험/, 'final'],
  [/방학/, 'vacation'],
  [/개강/, 'semester_start'],
  [/수강신청|수강정정|수강 신청/, 'registration'],
  [/오리엔테이션|OT/, 'orientation'],
];

function typeFromTitle(title) {
  const rule = TITLE_RULES.find(([pattern]) => pattern.test(title || ''));
  return rule ? rule[1] : 'other';
}

function readUniversityArg() {
  const index = process.argv.indexOf('--university');
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    console.error('--university 뒤에 대학 이름을 적어 주세요.');
    process.exit(1);
  }
  return value.trim();
}

const dateLabel = d => (d ? new Date(d).toISOString().slice(0, 10) : '-');

async function main() {
  const apply = process.argv.includes('--apply');
  const university = readUniversityArg();
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  const query = { type: 'other', ...(university ? { university } : {}) };
  const schedules = await UniversitySchedule.find(query).sort({ university: 1, startDate: 1 }).lean();

  const byUniversity = new Map();
  schedules.forEach(s => {
    const list = byUniversity.get(s.university) || [];
    list.push({ schedule: s, nextType: typeFromTitle(s.title) });
    byUniversity.set(s.university, list);
  });

  console.log(`type='other' 일정 ${schedules.length}건${university ? ` (대학: ${university})` : ''}${apply ? '' : ' — dry-run, 쓰기 없음'}`);
  let changeTotal = 0;
  for (const [univ, list] of byUniversity) {
    const changes = list.filter(item => item.nextType !== 'other');
    changeTotal += changes.length;
    console.log(`\n■ ${univ}: other ${list.length}건 중 바뀔 ${changes.length}건`);
    changes.forEach(({ schedule, nextType }) => {
      console.log(`  ${dateLabel(schedule.startDate)}~${dateLabel(schedule.endDate)} "${schedule.title}" → ${nextType}`);
    });
  }
  console.log(`\n바뀔 일정 합계 ${changeTotal}건`);

  if (apply && changeTotal > 0) {
    let modified = 0;
    for (const list of byUniversity.values()) {
      for (const { schedule, nextType } of list) {
        if (nextType === 'other') continue;
        // 조회 후 누가 종류를 고쳤으면 덮어쓰지 않도록 type:'other' 조건을 다시 건다
        const result = await UniversitySchedule.updateOne({ _id: schedule._id, type: 'other' }, { $set: { type: nextType } });
        modified += result.modifiedCount;
      }
    }
    console.log(`반영 완료: ${modified}건`);
  }

  await mongoose.connection.close();
}

main().catch(async error => {
  console.error('❌ 보정 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
