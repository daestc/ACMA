// 저장된 모든 학기 기록(AcademicRecord)의 semesterSummary를 calculateSemesterSummary로 다시 계산한다.
// 학기 평점 분모에서 성적 미입력 과목을 빼기 전에 저장된 문서는 다음 수정 때까지 옛 값(진행 중 학기
// 0.00 등)이 남아 있어서, 한 번 돌려 바로잡는다.
// 실행: node scripts/recalcSemesterGPA.js --dry-run   (바뀔 문서 수만 출력, 쓰기 없음)
//       node scripts/recalcSemesterGPA.js             (실제 반영)

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { AcademicRecord } = require('../models/Academic_records');
const { calculateSemesterSummary } = require('../services/academicSevice');

const SAMPLE_LIMIT = 10;

function sameSummary(stored, next) {
  return (stored?.attemptedCredits ?? null) === next.attemptedCredits
    && (stored?.earnedCredits ?? null) === next.earnedCredits
    && (stored?.semesterGPA ?? null) === next.semesterGPA;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI);

  const records = await AcademicRecord.find().select('userId semester subjects semesterSummary').lean();
  const changes = records
    .map(r => ({ r, next: calculateSemesterSummary(r.subjects || []) }))
    .filter(({ r, next }) => !sameSummary(r.semesterSummary, next));

  console.log(`학기 기록 ${records.length}건 중 바뀔 문서 ${changes.length}건${dryRun ? ' (dry-run, 쓰기 없음)' : ''}`);
  changes.slice(0, SAMPLE_LIMIT).forEach(({ r, next }) => {
    const before = r.semesterSummary || {};
    console.log(`  ${r.semester} userId=${r.userId}: 평점 ${before.semesterGPA ?? 'null'} → ${next.semesterGPA ?? 'null'}`
      + ` / 신청 ${before.attemptedCredits ?? '-'} → ${next.attemptedCredits} / 취득 ${before.earnedCredits ?? '-'} → ${next.earnedCredits}`);
  });
  if (changes.length > SAMPLE_LIMIT) console.log(`  ... 외 ${changes.length - SAMPLE_LIMIT}건`);

  if (!dryRun && changes.length > 0) {
    const result = await AcademicRecord.bulkWrite(changes.map(({ r, next }) => ({
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            'semesterSummary.attemptedCredits': next.attemptedCredits,
            'semesterSummary.earnedCredits': next.earnedCredits,
            'semesterSummary.semesterGPA': next.semesterGPA,
          },
        },
      },
    })));
    console.log(`반영 완료: ${result.modifiedCount}건`);
  }

  await mongoose.connection.close();
}

main().catch(async error => {
  console.error('❌ 재계산 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
