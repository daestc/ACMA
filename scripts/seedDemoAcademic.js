// 시연 계정(AcadMe대학교) 지난 7개 학기 성적을 한 번에 넣는다.
//
// 위치: 저장소의 scripts/ 폴더에 복사해서 실행한다. 커밋하지 않는다.
// 실행: node scripts/seedDemoAcademic.js <이메일>              (기본 dry-run: 넣을 내용만 출력, DB 변경 없음)
//       node scripts/seedDemoAcademic.js <이메일> --apply      (없는 학기만 넣음)
//       node scripts/seedDemoAcademic.js <이메일> --apply --replace   (7개 학기를 지우고 다시 넣음 — 발표 전 초기화용)
//
// 안전장치: 소속 대학이 'AcadMe대학교'인 계정에만 동작한다. 2026-2(진행 중 학기)는 건드리지 않는다.
// 군휴학(2022~2023) 가정: 2021-1, 2021-2, 2024-1 ~ 2026-1 완료 → 2026-2가 8번째 학기(4학년 2학기).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);

const User = require('../models/User');
const academicService = require('../services/academicService');
const model = require('../models/Academic_records');

const DEMO_UNIVERSITY = 'AcadMe대학교';
const T = { 전필: 'major_required', 전선: 'major_elective', 교필: 'general_required', 교선: 'general_elective' };

// [이수구분, 과목명, 학점, 성적]
const SEMESTERS = {
  '2021-1': [
    ['전필', '프로그래밍기초', 3, 'B+'], ['전필', '이산수학', 3, 'B'],
    ['교필', '대학영어I', 3, 'B+'], ['교필', '글쓰기와표현', 3, 'A'], ['교필', '컴퓨팅사고', 3, 'A'],
    ['교선', '철학의이해', 2, 'B+'],
  ],
  '2021-2': [
    ['전필', 'C프로그래밍', 3, 'A'], ['전필', '디지털논리회로', 3, 'B+'],
    ['교필', '대학영어II', 3, 'B'], ['교필', '대학생활과진로탐색', 1, 'A'],
    ['교선', '심리학의이해', 2, 'A'], ['교선', '경제학의이해', 2, 'B+'],
  ],
  '2024-1': [
    ['전필', '자료구조', 3, 'A'], ['전필', '객체지향프로그래밍', 3, 'A+'],
    ['전선', '웹프로그래밍기초', 3, 'A+'],
    ['교필', '기초통계', 3, 'B+'],
    ['교선', '미디어와사회', 2, 'A'], ['교선', '영어회화', 2, 'B+'],
  ],
  '2024-2': [
    ['전필', '알고리즘', 3, 'B+'], ['전필', '컴퓨터구조', 3, 'B'],
    ['전선', '데이터베이스', 3, 'A+'], ['전선', '자바프로그래밍', 3, 'A'],
    ['교선', '창업과혁신', 2, 'A'], ['교선', '한국사의이해', 2, 'B+'],
  ],
  '2025-1': [
    ['전필', '운영체제', 3, 'B+'], ['전필', '소프트웨어공학', 3, 'A'],
    ['전선', '웹프로그래밍', 3, 'A+'], ['전선', '데이터베이스설계', 3, 'A'],
    ['교필', '커리어설계', 2, 'A'],
    ['교선', '리더십과소통', 2, 'A'],
  ],
  '2025-2': [
    ['전필', '컴퓨터네트워크', 3, 'B+'], ['전필', '프로그래밍언어론', 3, 'B'],
    ['전선', '웹프론트엔드개발', 3, 'A+'], ['전선', '인공지능', 3, 'B+'],
    ['교선', '데이터와사회', 2, 'A'], ['교선', '글로벌문화의이해', 2, 'B+'],
  ],
  '2026-1': [ // 2026 1학기 강의 CSV와 과목명·이수구분이 같다(지난 학기 시간표에 담아도 중복으로 늘지 않음)
    ['전필', '캡스톤디자인I', 3, 'A'],
    ['전선', '웹서버프로그래밍', 3, 'A+'], ['전선', '클라우드기초', 2, 'A'], ['전선', '모바일앱기초', 2, 'B+'],
    ['교필', '취업역량강화', 1, 'A+'],
    ['교선', '실용영어회화', 2, 'B+'], ['교선', '논리적글쓰기', 2, 'A'], ['교선', '경영학원론', 2, 'B'],
  ],
};

function summarize() {
  const byType = {};
  let total = 0;
  for (const [sem, list] of Object.entries(SEMESTERS)) {
    const s = academicService.calculateSemesterSummary(list.map(([t, n, c, g]) => ({ subjectName: n, subjectType: T[t], credits: c, grade: g })));
    console.log(`  ${sem}  ${list.length}과목  신청 ${s.attemptedCredits}  취득 ${s.earnedCredits}  평점 ${s.semesterGPA}`);
    for (const [t, , c] of list) byType[t] = (byType[t] || 0) + c;
    total += list.reduce((a, [, , c]) => a + c, 0);
  }
  console.log(`  합계 ${total}학점  ${JSON.stringify(byType)}`);
}

async function main() {
  const email = process.argv[2];
  const APPLY = process.argv.includes('--apply');
  const REPLACE = process.argv.includes('--replace');
  if (!email || email.startsWith('--')) {
    console.log('사용법: node scripts/seedDemoAcademic.js <이메일> [--apply] [--replace]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('_id name university admissionYear');
    if (!user) throw new Error(`사용자를 찾지 못했습니다: ${email}`);
    if (user.university !== DEMO_UNIVERSITY) {
      throw new Error(`시연 대학(${DEMO_UNIVERSITY}) 계정이 아닙니다(현재: ${user.university}). 중단합니다.`);
    }
    console.log(`대상: ${user.name} (${email}), 입학년도 ${user.admissionYear}`);
    summarize();

    const existing = await model.AcademicRecord.find({ userId: user._id, semester: { $in: Object.keys(SEMESTERS) } }).select('semester');
    const have = new Set(existing.map(r => r.semester));
    console.log(`이미 있는 학기: ${[...have].join(', ') || '없음'}`);

    if (!APPLY) {
      console.log('\n[dry-run] DB를 바꾸지 않았습니다. 넣으려면 --apply를 붙이세요.');
      return;
    }
    if (REPLACE && have.size) {
      await model.AcademicRecord.deleteMany({ userId: user._id, semester: { $in: [...have] } });
      console.log(`지운 학기: ${[...have].join(', ')}`);
      have.clear();
    }
    for (const [sem, list] of Object.entries(SEMESTERS)) {
      if (have.has(sem)) { console.log(`건너뜀(이미 있음): ${sem}`); continue; }
      const [y, n] = sem.split('-').map(Number);
      await academicService.saveSemesterRecord({
        userId: user._id, semester: sem, year: y, semesterNumber: n, status: 'completed',
        subjects: list.map(([t, name, credits, grade]) => ({ subjectName: name, subjectType: T[t], credits, grade })),
      });
      console.log(`넣음: ${sem}`);
    }
    await academicService.calcRemainingCredits(user._id); // 학점 집계 캐시 갱신
    console.log('완료. 화면에 반영하려면 다시 로그인하세요.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('실패:', err.message); process.exit(1); });
