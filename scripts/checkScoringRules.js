// 진로 추천 점수 규칙 단위 사례. DB 없이 가상 직무로 계산하므로 npm test에서 돌린다.
// 실행: node scripts/checkScoringRules.js   (실패가 있으면 종료 코드 1)

const scorer = require('../services/ai/recommendScorer');

// 학점·성적이 있는 새 경로(recommendationService.loadScoringCourses)를 흉내 낸 과목
const toCourses = (names, credits = 3, grade = 'A') => names.map(name => ({ name, credits, grade }));
const section = title => console.log(`\n══════ ${title} ══════`);

// 점수 규칙 단위 사례(DB 없이 가상 직무로 계산). 교수 상담 반영: 과목 하나로 만점이 나오지 않고,
// 성적은 보조 지표이며, 자격증은 등급에 따라 다르고, 입력하지 않은 항목을 구분한다.
// 기대값은 규칙에서 손으로 계산했다: 영역 17 × 순위 가중 × min(1, 가중 학점 ÷ 9) + 주제 8 × min(1, 주제 과목 가중 학점 ÷ 9).
function checkScoringRules() {
  section('5. 점수 규칙 단위 사례 (근거 강도·성적·자격증 등급·입력 여부)');
  const job = {
    jobCode: 'T1', title: '테스트 직무', jobLrclNm: '테스트', jobMdclNm: '테스트중',
    knowledge: [
      { name: '컴퓨터와 전자공학', importance: 99 }, { name: '산수와 수학', importance: 90 },
      { name: '영어', importance: 80 }, { name: '물리', importance: 70 }, { name: '통신', importance: 60 },
    ],
    abilities: [{ name: '전산', importance: 99 }, { name: '창의력', importance: 90 }],
    characteristics: [], relatedDepartments: [],
    certNames: ['정보처리기사', '정보처리산업기사', '정보처리기능사', '빅데이터분석기사', '전자계산기조직응용기술사'],
    averageSalary: {},
    searchText: '',
  };
  const topicJob = { ...job, searchText: scorer.norm('관계형 데이터베이스 설계와 운영') };
  const score = (context, prefs = null, courses, target = job) => {
    const signals = scorer.extractUserSignals(context, courses);
    return { signals, ...scorer.scoreJob(signals, scorer.sanitizePrefs(prefs), target, []) };
  };
  const db = '데이터베이스';

  let failed = 0;
  const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(expected)})`}`);
  };

  // 지식 점수 = 영역 17 × 순위 가중 × min(1, 가중 학점 ÷ 9) + 주제 8 × min(1, 주제 과목 가중 학점 ÷ 9)
  const know = (names, credits, grade, target) => score({}, null, toCourses(names, credits, grade), target).breakdown.knowledge;
  check('이수 1과목(3학점·A) → 6점 (17×3/9)', know([db], 3, 'A'), 6);
  check('이수 2과목(A) → 11점 (17×6/9)', know([db, '자료구조'], 3, 'A'), 11);
  check('이수 3과목(A) → 17점 (영역 포화)', know([db, '자료구조', '운영체제'], 3, 'A'), 17);
  check('이수 3과목 B(×0.85) → 14점', know([db, '자료구조', '운영체제'], 3, 'B'), 14);
  check('이수 3과목 C(×0.7) → 12점', know([db, '자료구조', '운영체제'], 3, 'C'), 12);
  check('성적 없는 3과목(수강 중, ×0.5) → 9점', know([db, '자료구조', '운영체제'], 3, null), 9);
  check('F 과목은 근거에서 빠진다', know([db], 3, 'F'), 0);
  const retake = score({}, null, [{ name: db, credits: 3, grade: 'F' }, { name: db, credits: 3, grade: 'A' }]);
  check('재수강(F 후 A)은 A 한 건만 센다', [retake.breakdown.knowledge, retake.signals.courses.length], [6, 1]);
  check('학점이 클수록 근거가 강하다(1과목 9학점 → 17점)', know([db], 9, 'A'), 17);
  const pick = score({}, null, [{ name: db, credits: 3, grade: null }, ...toCourses(['미적분학', '선형대수학', '확률과통계'])]);
  check('1순위 지식 근거가 약하면 2순위 지식(×0.8)을 쓴다', [pick.matched.topKnowledge.name, pick.breakdown.knowledge], ['산수와 수학', 14]);

  // 주제 점수: 직무 업무 문장(searchText)에 과목 주제가 있을 때만
  check('업무 문장에 데이터베이스가 없으면 주제 0', score({}, null, toCourses([db])).matched.topicSubjects, []);
  const topic1 = score({}, null, toCourses([db]), topicJob);
  check('업무 문장에 데이터베이스가 있으면 영역 6 + 주제 3 = 8점', [topic1.breakdown.knowledge, topic1.matched.topicSubjects], [8, [db]]);
  const topic3 = score({}, null, toCourses(['데이터베이스1', '데이터베이스2', '데이터베이스3']), topicJob);
  check('영역 17 + 주제 8 = 25점(상한)', topic3.breakdown.knowledge, 25);
  check('관련 과목 3개·9학점이 결과에 남는다(성적 가중 전 원래 학점)', [topic3.matched.courseCount, topic3.matched.courseCredits], [3, 9]);

  // 이름만 넘어오는 옛 경로(context.academic)도 같은 규칙: 전공 이수 3학점·성적 그대로, 수강 중은 성적 없음
  const legacy = score({ academic: { majorCourses: [{ name: db, grade: 'A' }], currentSubjects: [{ name: '자료구조' }] } });
  check('옛 경로: 이수 A(3학점)+수강 중(×0.5) → 17×4.5/9 = 8.5 → 9점', legacy.breakdown.knowledge, 9);

  // 자격증: 등급별 점수, 상한 20
  const certScore = names => score({ specs: { certifications: names.map(name => ({ name })) } }).breakdown.cert;
  check('정보처리기사 → 12', certScore(['정보처리기사']), 12);
  check('정보처리산업기사 → 9', certScore(['정보처리산업기사']), 9);
  check('정보처리기능사 → 6', certScore(['정보처리기능사']), 6);
  check('기술사 → 15', certScore(['전자계산기조직응용기술사']), 15);
  check('기능사+산업기사 → 15', certScore(['정보처리기능사', '정보처리산업기사']), 15);
  check('기사+산업기사 → 21이지만 상한 20', certScore(['정보처리기사', '정보처리산업기사']), 20);
  check('직무와 무관한 자격증 → 0', certScore(['한식조리기능사']), 0);

  // 입력 여부
  const none = scorer.extractUserSignals({});
  check('아무것도 입력하지 않음', scorer.buildInputState(none, scorer.sanitizePrefs(null)), { major: false, cert: false, knowledge: false, skill: false, pref: false });
  const some = scorer.extractUserSignals({ profile: { major: '컴퓨터공학과' }, specs: { skills: [{ name: 'Java' }] } }, toCourses([db]));
  check('전공·기술·수강 과목만 입력', scorer.buildInputState(some, scorer.sanitizePrefs({ work: ['build'] })), { major: true, cert: false, knowledge: true, skill: true, pref: true });
  const expOnly = scorer.extractUserSignals({ specs: { experiences: [{ title: '교내 해커톤' }] } });
  check('경험만 입력해도 기술·경험은 입력으로 본다', scorer.buildInputState(expOnly, scorer.sanitizePrefs(null)).skill, true);

  // 평가 기준(직무가 요구하는 것 vs 학생 근거)
  const crit = score({ specs: { skills: [{ name: 'Java' }] } }, null, toCourses([db])).matched.criteria;
  check('핵심 지식 상위 5개와 근거 여부', crit.knowledge.map(k => `${k.rank}:${k.name}:${k.supported}`), ['1:컴퓨터와 전자공학:true', '2:산수와 수학:false', '3:영어:false', '4:물리:false', '5:통신:false']);
  check('핵심 능력과 근거 여부', crit.abilities.map(k => `${k.name}:${k.supported}`), ['전산:true', '창의력:false']);

  // 같은 입력은 항상 같은 결과
  const input = { specs: { certifications: [{ name: '정보처리기사' }] } };
  const repeat = () => JSON.stringify(score(input, null, toCourses([db, '자료구조'], 3, 'B+'), topicJob).breakdown);
  check('같은 입력 → 같은 결과(반복 5회)', new Set(Array.from({ length: 5 }, repeat)).size, 1);

  console.log(failed ? `❌ ${failed}건 실패` : '✅ 모두 통과');
  return failed === 0;
}

module.exports = { checkScoringRules };

if (require.main === module) {
  process.exit(checkScoringRules() ? 0 : 1);
}
