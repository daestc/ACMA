// 강의(lectures) 유일 인덱스를 {university, courseName, section} → {university, year, semester, courseName, section}으로 바꾼다.
// Mongoose는 스키마에서 사라진 인덱스를 자동으로 지우지 않는다. 옛 유일 인덱스가 남아 있으면 같은 과목·분반의
// 다른 학기 강의를 저장할 때 중복 키 오류(E11000)가 계속 난다.
//
// 실행: node scripts/migrateLectureIndex.js           (기본 dry-run: 인덱스 목록과 할 일만 출력, DB 변경 없음)
//       node scripts/migrateLectureIndex.js --apply   (옛 인덱스 삭제 + Lecture.syncIndexes())
//
// 주의: 공유 DB에서는 dry-run 결과를 팀에 알린 뒤 --apply 한다. 옛 인덱스를 지운 뒤 새 인덱스가 만들어질 때까지
//       잠깐 동안 강의 등록이 DB 수준 중복 검사 없이 열린다. 옛 인덱스 기준으로 중복이 없었으므로 새 인덱스
//       (열이 더 많음) 생성은 중복 때문에 실패하지 않는다.
// 참고: 새 코드로 서버를 띄우면 Mongoose autoIndex가 새 인덱스를 먼저 만들 수 있다. 그래도 옛 인덱스는 남으므로
//       이 스크립트의 --apply가 필요하다.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// dry-run이 DB를 바꾸지 않도록 자동 인덱스 생성을 전역으로 끈다(모델을 불러오기 전에).
// Mongoose 9에서는 connect의 autoIndex 옵션만으로는 막히지 않았다(실측: dry-run이 새 인덱스를 만들었음).
mongoose.set('autoIndex', false);

const OLD_INDEX_NAME = 'university_1_courseName_1_section_1';
const NEW_INDEX_KEY = { university: 1, year: 1, semester: 1, courseName: 1, section: 1 };
const APPLY = process.argv.includes('--apply');

function printIndexes(title, indexes) {
  console.log(`\n${title}`);
  indexes.forEach(i => console.log(`  - ${i.name} ${JSON.stringify(i.key)}${i.unique ? ' (unique)' : ''}`));
}

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  // 모델 없이 드라이버로 읽는다 — dry-run에서는 Lecture 모델을 불러오지 않는다.
  const collection = mongoose.connection.db.collection('lectures');

  const before = await collection.indexes();
  printIndexes('현재 인덱스', before);

  const hasOld = before.some(i => i.name === OLD_INDEX_NAME);
  const hasNew = before.some(i => sameKey(i.key, NEW_INDEX_KEY) && i.unique);
  console.log(`\n옛 유일 인덱스(${OLD_INDEX_NAME}): ${hasOld ? '있음 → 삭제 대상' : '없음'}`);
  console.log(`새 유일 인덱스 ${JSON.stringify(NEW_INDEX_KEY)}: ${hasNew ? '있음' : '없음 → syncIndexes로 생성'}`);
  console.log(`강의 문서 수: ${await collection.countDocuments()}`);

  if (!APPLY) {
    console.log('\n[dry-run] DB를 바꾸지 않았습니다. 적용하려면 --apply를 붙여 다시 실행하세요.');
    return;
  }

  const { Lecture } = require('../models/Calendar');
  if (hasOld) {
    await collection.dropIndex(OLD_INDEX_NAME);
    console.log(`\n삭제: ${OLD_INDEX_NAME}`);
  }
  const dropped = await Lecture.syncIndexes();
  if (dropped.length) console.log(`syncIndexes가 지운 인덱스: ${dropped.join(', ')}`);

  printIndexes('적용 후 인덱스', await collection.indexes());
}

main()
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close().catch(() => {}));
