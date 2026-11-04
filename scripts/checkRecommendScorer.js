// 진로 추천 점수 규칙을 실제 카탈로그로 점검한다 (DB 읽기 전용). Phase5 계획서 v3 §5-1.
// 실행: node scripts/checkRecommendScorer.js
// 종료 코드: 매핑표 이름이 카탈로그에 없거나, 샘플 전공 중 매칭 0건이 3개 이상이거나, 점수 규칙 단위 사례가 틀리거나,
//           주제 매핑표 용어가 관문(직무 1~40개)을 벗어나면 1.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { JobCatalog } = require('../models/JobCatalog');
const scorer = require('../services/ai/recommendScorer');

const SAMPLE_MAJORS = [
  '컴퓨터공학과', '소프트웨어학과', '경영학과', '전자공학과', '기계공학과',
  '간호학과', '영어영문학과', '시각디자인학과', '경제학과', '행정학과',
];
const SAMPLE_SKILLS = ['Java', 'Python', 'JavaScript', 'React', 'SQL', 'Excel', 'Figma'];
const SAMPLE_CERTS = ['정보처리기사', '컴퓨터활용능력1급', '빅데이터분석기사', '전산회계1급'];
const C_PRIME_PREFS = { work: ['analyze'], style: 'solo' };
const TOPIC_TERM_MIN_JOBS = 1;
const TOPIC_TERM_MAX_JOBS = 40;
// 지식 영역 점수만으로는 같은 점수가 나오던 두 학생(설계서 확인 1번). 모두 A, 3학점.
const WEB_COURSES = ['웹프로그래밍', '웹서버프로그래밍', '데이터베이스', '데이터베이스설계', '모바일프로그래밍', '안드로이드앱개발',
  '자바프로그래밍', '객체지향프로그래밍', '자료구조', '알고리즘', '소프트웨어공학', '웹프레임워크'];
const NETWORK_COURSES = ['컴퓨터네트워크', '데이터통신', '네트워크보안', '정보보호개론', '암호학', '해킹과보안',
  '운영체제', '리눅스시스템관리', '무선통신', '시스템프로그래밍', '자료구조', '알고리즘'];
const gradedCourses = names => names.map(name => ({ name, grade: 'A', credits: 3 }));

// splitCertNames 단위 사례 (계획서 v3.2 §5-0 표 + 재적재 샘플에서 본 실제 표기)
const CERT_SPLIT_CASES = [
  ['CIA(외국)', ['CIA']],
  ['FRM《국제금융위험관리사》(외국)', ['FRM']],
  ['ERP정보관리사《회계》', ['ERP정보관리사']],
  ['전산세무1급 전산세무2급 전산회계1급 전산회계2급', ['전산세무1급', '전산세무2급', '전산회계1급', '전산회계2급']],
  ['품질경영(산업)기사', ['품질경영기사', '품질경영산업기사']],
  ['품질경영(산업)기사(국가기술)', ['품질경영기사', '품질경영산업기사']],
  ['컴퓨터활용능력 1급(국가기술)', ['컴퓨터활용능력 1급']],
  ['빅데이터분석기사, 데이터분석전문가, 데이터분석준전문가', ['빅데이터분석기사', '데이터분석전문가', '데이터분석준전문가']],
  ['직업상담사 2급', ['직업상담사 2급']],
  ['한국사능력검정시험 1급', ['한국사능력검정시험 1급']],
  ['정보처리기사·산업기사', ['정보처리기사·산업기사']],
  ['경영지도사(국가전문)', ['경영지도사']],
  // 쉼표 약식 (카탈로그 492건 중 199건)
  ['정보처리기능사, 산업기사, 기사(국가기술)', ['정보처리기능사', '정보처리산업기사', '정보처리기사']],
  ['전자계산기조직응용기사, 기술사(국가기술)', ['전자계산기조직응용기사', '전자계산기조직응용기술사']],
];

const ACCOUNTS = [
  {
    label: 'A: 컴공 + 정처기 + 자바·DB·알고리즘 + Java·Spring Boot·Python·React',
    context: {
      profile: { major: '컴퓨터공학과' },
      specs: {
        certifications: [{ name: '정보처리기사' }],
        skills: ['Java', 'Spring Boot', 'Python', 'React'].map(name => ({ name })),
      },
      academic: { majorCourses: ['자바프로그래밍', '데이터베이스론', '컴퓨터알고리즘'].map(name => ({ name })) },
    },
    courses: gradedCourses(['자바프로그래밍', '데이터베이스론', '컴퓨터알고리즘']),
    prefs: null,
  },
  {
    label: 'B: 경영 + 컴활1급 + 경영통계·회계원리·마케팅원론 + Python·SQL·Excel',
    context: {
      profile: { major: '경영학과' },
      specs: {
        certifications: [{ name: '컴퓨터활용능력1급' }],
        skills: ['Python', 'SQL', 'Excel'].map(name => ({ name })),
      },
      academic: { majorCourses: ['경영통계', '회계원리', '마케팅원론'].map(name => ({ name })) },
    },
    courses: gradedCourses(['경영통계', '회계원리', '마케팅원론']),
    prefs: null,
  },
  {
    label: 'D: 컴공 + 웹·DB·모바일 위주 12과목(모두 A)',
    context: { profile: { major: '컴퓨터공학과' }, academic: { majorCourses: gradedCourses(WEB_COURSES) } },
    prefs: null,
  },
  {
    label: 'E: 컴공 + 네트워크·보안 위주 12과목(모두 A)',
    context: { profile: { major: '컴퓨터공학과' }, academic: { majorCourses: gradedCourses(NETWORK_COURSES) } },
    prefs: null,
  },
  {
    label: 'G: 경영 + 교양 통계학 1과목(A, 수강 과목 로더 경로)',
    context: { profile: { major: '경영학과' } },
    courses: gradedCourses(['통계학']),
    prefs: null,
  },
  {
    label: 'F: 컴공 + 컴퓨터개론 1과목(A)',
    context: { profile: { major: '컴퓨터공학과' }, academic: { majorCourses: gradedCourses(['컴퓨터개론']) } },
    prefs: null,
  },
  { label: 'C: 컴퓨터공학전공, 나머지 없음', context: { profile: { major: '컴퓨터공학전공' } }, prefs: null },
  {
    label: "C': C + { work:['analyze'], style:'solo' }",
    context: { profile: { major: '컴퓨터공학전공' } },
    prefs: C_PRIME_PREFS,
  },
  {
    label: "C'': C' + 관심분야 ['연구직 및 공학 기술직']",
    context: { profile: { major: '컴퓨터공학전공' } },
    prefs: C_PRIME_PREFS,
    interests: ['연구직 및 공학 기술직'],
  },
];

function section(title) {
  console.log(`\n══════ ${title} ══════`);
}

function checkNames(jobs) {
  section('1. 매핑표 이름 존재 검사');
  const catalogNames = {
    characteristics: new Set(jobs.flatMap(j => (j.characteristics || []).map(i => i.name))),
    abilities: new Set(jobs.flatMap(j => (j.abilities || []).map(i => i.name))),
    knowledge: new Set(jobs.flatMap(j => (j.knowledge || []).map(i => i.name))),
  };

  const missing = [];
  const checkTargets = (tableName, table) => {
    Object.entries(table).forEach(([key, target]) => {
      Object.entries(target).forEach(([field, set]) => {
        set.forEach(name => {
          if (!catalogNames[field].has(name)) missing.push(`${tableName}.${key}.${field}: "${name}"`);
        });
      });
    });
  };
  checkTargets('WORK_PREF_TARGETS', scorer.WORK_PREF_TARGETS);
  checkTargets('STYLE_TARGETS', scorer.STYLE_TARGETS);

  const subjectNames = new Set(scorer.SUBJECT_KNOWLEDGE_MAP.flatMap(([, names]) => names));
  subjectNames.forEach(name => {
    if (!catalogNames.knowledge.has(name)) missing.push(`SUBJECT_KNOWLEDGE_MAP.knowledge: "${name}"`);
  });

  const skillAbilityNames = new Set([...scorer.SKILL_ABILITY_MAP, ...scorer.SKILL_ONLY_ABILITY_MAP].flatMap(([, names]) => names));
  skillAbilityNames.forEach(name => {
    if (!catalogNames.abilities.has(name)) missing.push(`SKILL_ABILITY_MAP.abilities: "${name}"`);
  });

  const unmappedKnowledge = [...catalogNames.knowledge].filter(n => !subjectNames.has(n));
  console.log(`카탈로그 이름 수: characteristics ${catalogNames.characteristics.size}, abilities ${catalogNames.abilities.size}, knowledge ${catalogNames.knowledge.size}`);
  console.log(`과목 매핑표가 쓰는 지식 ${subjectNames.size}종 / 매핑 없는 지식: ${unmappedKnowledge.join(', ') || '없음'}`);
  if (missing.length) {
    console.log(`❌ 카탈로그에 없는 이름 ${missing.length}개:`);
    missing.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log('✅ 모든 이름이 카탈로그에 있음');
  }
  return missing.length === 0;
}

function checkDepartments(jobs) {
  section('2. 학과 형식 / 샘플 전공 매칭');
  const counts = new Map();
  jobs.forEach(j => (j.relatedDepartments || []).forEach(d => counts.set(d, (counts.get(d) || 0) + 1)));
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);
  console.log(`relatedDepartments 고유값 ${counts.size}종, 상위 ${top.length}:`);
  console.log(top.map(([d, n]) => `${d} ${n}`).join(' | '));

  const zero = [];
  SAMPLE_MAJORS.forEach(major => {
    const hits = jobs.filter(j => scorer.majorMatch(major, j.relatedDepartments));
    if (hits.length === 0) zero.push(major);
    console.log(`  ${major}: ${hits.length}건${hits.length ? ` (예: ${hits.slice(0, 4).map(j => j.title).join(', ')})` : ''}`);
  });
  console.log(zero.length >= 3 ? `❌ 0건 전공 ${zero.length}개: ${zero.join(', ')}` : `✅ 0건 전공 ${zero.length}개${zero.length ? `: ${zero.join(', ')}` : ''}`);
  return zero.length < 3;
}

function checkSkills(jobs) {
  section('3. 스킬 → 능력 매칭');
  SAMPLE_SKILLS.forEach(skill => {
    const signals = scorer.extractUserSignals({ specs: { skills: [{ name: skill }] } });
    const abilities = [...signals.skillAbilities.keys()];
    const hits = jobs.filter(j => (j.abilities || []).some(a => signals.skillAbilities.has(a.name)));
    console.log(`  ${skill} → [${abilities.join(', ') || '없음'}]: ${hits.length}건${hits.length ? ` (예: ${hits.slice(0, 4).map(j => j.title).join(', ')})` : ''}`);
  });
}

function checkImportance(jobs) {
  section('3-1. importance 범위');
  ['knowledge', 'abilities', 'characteristics'].forEach(field => {
    const values = jobs.flatMap(j => (j[field] || []).map(i => i.importance)).filter(v => typeof v === 'number').sort((a, b) => a - b);
    const median = values.length ? values[Math.floor(values.length / 2)] : '-';
    const zeros = values.filter(v => v === 0).length;
    console.log(`  ${field}: n=${values.length} min=${values[0]} max=${values[values.length - 1]} median=${median} (0인 항목 ${zeros}개 — 순위 가중에서 제외)`);
  });
}

function checkCertSplit() {
  section('0. splitCertNames 단위 사례');
  let failed = 0;
  CERT_SPLIT_CASES.forEach(([raw, expected]) => {
    const actual = scorer.splitCertNames(raw);
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${raw} → ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(expected)})`}`);
  });
  console.log(failed ? `❌ ${failed}/${CERT_SPLIT_CASES.length} 실패` : `✅ ${CERT_SPLIT_CASES.length}건 모두 통과`);
  return failed === 0;
}

function checkCerts(jobs) {
  section('3-2. 자격증 매칭');
  const withCerts = jobs.filter(j => (j.certNames || []).length > 0);
  const avg = jobs.reduce((sum, j) => sum + (j.certNames || []).length, 0) / (jobs.length || 1);
  console.log(`  certNames 채움 ${withCerts.length}/${jobs.length}, 직무당 평균 ${avg.toFixed(2)}개`);
  SAMPLE_CERTS.forEach(cert => {
    const keys = scorer.expandCert(cert).map(scorer.norm);
    const hits = jobs.filter(j => (j.certNames || []).some(c => keys.includes(c)));
    console.log(`  ${cert}: ${hits.length}건${hits.length ? ` (예: ${hits.slice(0, 4).map(j => j.title).join(', ')})` : ''}`);
  });
}

// 점수 규칙 단위 사례(DB 없이 가상 직무로 계산). 교수 상담 반영: 과목 하나로 만점이 나오지 않고,
// 성적은 보조 지표이며, 자격증은 등급에 따라 다르고, 입력하지 않은 항목을 구분한다.
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
  };
  const score = (context, prefs = null) => {
    const signals = scorer.extractUserSignals(context);
    return { signals, ...scorer.scoreJob(signals, scorer.sanitizePrefs(prefs), job, []) };
  };
  const courses = (grade, ...names) => names.map(name => ({ name, grade }));

  let failed = 0;
  const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(expected)})`}`);
  };

  // 지식 점수 = 영역(17 × 순위 가중 × 근거 강도 × 성적 계수) + 주제(8 × min(1, 주제 가중치 합 / 3)).
  // 이 가상 직무는 searchText가 없어 주제 점수가 0이다 — 영역 점수만 본다.
  const dbOnly = '데이터베이스';
  check('수강 중 1과목만 → 9점 (17×0.5)', score({ academic: { currentSubjects: [{ name: dbOnly }] } }).breakdown.knowledge, 9);
  check('이수 1과목(A) → 10점 (17×0.6)', score({ academic: { majorCourses: courses('A', dbOnly) } }).breakdown.knowledge, 10);
  check('이수 2과목(A) → 14점 (17×0.8)', score({ academic: { majorCourses: courses('A', dbOnly, '자료구조') } }).breakdown.knowledge, 14);
  check('이수 3과목(A) → 17점 (영역 만점)', score({ academic: { majorCourses: courses('A', dbOnly, '자료구조', '운영체제') } }).breakdown.knowledge, 17);
  check('이수 3과목 평균 B(3.0) → 15점(×0.9)', score({ academic: { majorCourses: courses('B', dbOnly, '자료구조', '운영체제') } }).breakdown.knowledge, 15);
  check('이수 3과목 평균 C(2.0) → 14점(×0.8)', score({ academic: { majorCourses: courses('C', dbOnly, '자료구조', '운영체제') } }).breakdown.knowledge, 14);
  check('성적이 기록되지 않은 이수 과목은 성적 계수 1.0', score({ academic: { majorCourses: [{ name: dbOnly }, { name: '자료구조' }, { name: '운영체제' }] } }).breakdown.knowledge, 17);
  const both = score({ academic: { majorCourses: courses('A', dbOnly), currentSubjects: [{ name: dbOnly }] } });
  check('같은 과목이 이수·수강 중에 같이 있으면 이수로만 센다', [both.breakdown.knowledge, both.matched.knowledgeBasis.completed, both.matched.knowledgeBasis.current], [10, 1, 0]);
  const pick = score({ academic: { currentSubjects: [{ name: dbOnly }], majorCourses: courses('A', '미적분학', '선형대수학', '확률과통계') } });
  check('1순위 지식이 수강 중뿐이면 이수 3과목인 2순위 지식을 쓴다', [pick.matched.topKnowledge.name, pick.breakdown.knowledge], ['산수와 수학', 14]);

  // 주제 점수: 직무 업무 문장(searchText)에 과목 주제 용어가 있으면 8점까지(이수 1, 수강 중 0.5, 3과목에서 포화)
  const webJob = { ...job, searchText: scorer.norm('웹사이트를 기획하고 웹프로그래밍으로 구현한다') };
  const topicScore = context => {
    const signals = scorer.extractUserSignals(context);
    return scorer.scoreJob(signals, scorer.sanitizePrefs(null), webJob, []);
  };
  const web1 = topicScore({ academic: { majorCourses: courses('A', '웹프로그래밍') } });
  check('웹 이수 1과목 → 영역 10 + 주제 2.7 = 13', [web1.breakdown.knowledge, web1.matched.topicSubjects], [13, ['웹프로그래밍']]);
  const web3 = topicScore({ academic: { majorCourses: courses('A', '웹프로그래밍', '웹서버구축', '웹디자인') } });
  check('웹 이수 3과목 → 영역 17 + 주제 8 = 25', web3.breakdown.knowledge, 25);
  const webCur = topicScore({ academic: { currentSubjects: [{ name: '웹프로그래밍' }] } });
  check('웹 수강 중 1과목 → 영역 9(8.5) + 주제 1.3 = 10', webCur.breakdown.knowledge, 10);
  const net1 = topicScore({ academic: { majorCourses: courses('A', '컴퓨터네트워크') } });
  check('업무 문장에 없는 주제(네트워크) → 주제 0', [net1.breakdown.knowledge, net1.matched.topicSubjects], [10, []]);
  check('근거 과목 목록 뒤에 주제 일치 과목이 붙는다', web1.matched.subjects, ['웹프로그래밍']);

  // 수강 과목 로더 경로(courses): 교양 포함, 성적 있으면 이수·없으면 수강 중, 같은 이름은 성적이 좋은 쪽, F·NP 제외
  const viaCourses = list => scorer.extractUserSignals({}, list).subjectInfo;
  check('교양 통계학(A)도 근거 과목이 된다', [...viaCourses([{ name: '통계학', grade: 'A', credits: 3 }])], [['통계학', { completed: true, grade: 'A' }]]);
  check('재수강은 성적이 좋은 쪽 하나만', [...viaCourses([{ name: '자료구조', grade: 'C' }, { name: '자료구조', grade: 'A+' }])], [['자료구조', { completed: true, grade: 'A+' }]]);
  check('성적 없음 = 수강 중, 이수 기록이 있으면 이수', [...viaCourses([{ name: '운영체제', grade: null }, { name: '운영체제', grade: 'B' }, { name: '컴파일러', grade: null }])],
    [['운영체제', { completed: true, grade: 'B' }], ['컴파일러', { completed: false, grade: null }]]);
  check('F·NP는 근거가 아니다', viaCourses([{ name: '회로이론', grade: 'F' }, { name: '봉사', grade: 'NP' }]).size, 0);
  const ctxOnly = { academic: { majorCourses: courses('A', dbOnly) } };
  check('courses가 undefined면 context 경로 그대로', JSON.stringify(score(ctxOnly).breakdown), JSON.stringify(scorer.scoreJob(scorer.extractUserSignals(ctxOnly, undefined), scorer.sanitizePrefs(null), job, []).breakdown));
  check('근거 강도 정보가 결과에 남는다', score({ academic: { currentSubjects: [{ name: dbOnly }] } }).matched.knowledgeBasis, { completed: 0, current: 1, strength: 0.5, gradeFactor: 1 });

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
  const some = scorer.extractUserSignals({ profile: { major: '컴퓨터공학과' }, specs: { skills: [{ name: 'Java' }] }, academic: { currentSubjects: [{ name: dbOnly }] } });
  check('전공·기술·수강 과목만 입력', scorer.buildInputState(some, scorer.sanitizePrefs({ work: ['build'] })), { major: true, cert: false, knowledge: true, skill: true, pref: true });
  // 자유전공·전공 미정은 전공 입력이 아니다(전공 점수·신뢰도·inputState 모두 입력 안 함)
  ['자유전공학부', '자율전공학부', '무전공', '전공 미정', '미정'].forEach(major => {
    const sig = scorer.extractUserSignals({ profile: { major }, academic: { currentSubjects: [{ name: dbOnly }] } });
    const prefs = scorer.sanitizePrefs({ work: ['build'] });
    check(`"${major}" + 수강 중 1과목 + 체크리스트 → 전공 입력 아님, 신뢰도 low`,
      [sig.majors.length, scorer.buildInputState(sig, prefs).major, scorer.calcConfidence(sig, prefs)], [0, false, 'low']);
  });
  const declared = scorer.extractUserSignals({ profile: { major: '컴퓨터공학과' }, academic: { currentSubjects: [{ name: dbOnly }] } });
  check('"컴퓨터공학과"는 그대로 전공 입력', [declared.majors, scorer.calcConfidence(declared, scorer.sanitizePrefs({ work: ['build'] }))], [['컴퓨터공학과'], 'normal']);
  const expOnly = scorer.extractUserSignals({ specs: { experiences: [{ title: '교내 해커톤' }] } });
  check('경험만 입력해도 기술·경험은 입력으로 본다', scorer.buildInputState(expOnly, scorer.sanitizePrefs(null)).skill, true);

  // 평가 기준(직무가 요구하는 것 vs 학생 근거)
  const crit = score({ academic: { currentSubjects: [{ name: dbOnly }] }, specs: { skills: [{ name: 'Java' }] } }).matched.criteria;
  check('핵심 지식 상위 5개와 근거 여부', crit.knowledge.map(k => `${k.rank}:${k.name}:${k.supported}`), ['1:컴퓨터와 전자공학:true', '2:산수와 수학:false', '3:영어:false', '4:물리:false', '5:통신:false']);
  check('핵심 능력과 근거 여부', crit.abilities.map(k => `${k.name}:${k.supported}`), ['전산:true', '창의력:false']);

  // 같은 입력은 항상 같은 결과
  const input = { academic: { majorCourses: courses('B+', dbOnly, '자료구조') }, specs: { certifications: [{ name: '정보처리기사' }] } };
  check('같은 입력 → 같은 결과(반복 5회)', new Set(Array.from({ length: 5 }, () => JSON.stringify(score(input).breakdown))).size, 1);

  console.log(failed ? `❌ ${failed}건 실패` : '✅ 모두 통과');
  return failed === 0;
}

// 주제 매핑표 용어마다 searchText에 그 용어가 든 직무 수와 예시. 관문을 벗어난 용어가 있으면 false.
function checkTopicTerms(jobs) {
  section('3-3. 주제 매핑표 용어 실측 (searchText)');
  const bare = jobs.filter(j => !(j.responsibilities || []).length && !String(j.summary || '').trim());
  console.log(`  업무 문장 없는 직무(responsibilities·summary 모두 빈 값): ${bare.length}건`);
  const outOfGate = [];
  scorer.SUBJECT_TOPIC_MAP.forEach(([pattern, terms]) => {
    console.log(`  ${pattern}`);
    terms.forEach(term => {
      const hits = jobs.filter(j => (j.searchText || '').includes(scorer.norm(term)));
      const ok = hits.length >= TOPIC_TERM_MIN_JOBS && hits.length <= TOPIC_TERM_MAX_JOBS;
      if (!ok) outOfGate.push(`${term}(${hits.length})`);
      console.log(`    ${ok ? '✅' : '❌'} ${term}: ${hits.length}건${hits.length ? ` (예: ${hits.slice(0, 3).map(j => j.title).join(', ')})` : ''}`);
    });
  });
  console.log(outOfGate.length
    ? `❌ 관문(${TOPIC_TERM_MIN_JOBS}~${TOPIC_TERM_MAX_JOBS}건)을 벗어난 용어: ${outOfGate.join(', ')}`
    : `✅ 모든 용어가 관문(${TOPIC_TERM_MIN_JOBS}~${TOPIC_TERM_MAX_JOBS}건) 안`);
  return outOfGate.length === 0;
}

function checkAccounts(jobs) {
  section('4. 테스트 계정 가상 순위');
  // courses가 있는 계정은 이름만 넘기는 옛 경로(context)와 수강 과목 로더 경로(courses)를 둘 다 돌린다.
  const runs = ACCOUNTS.flatMap(account => (account.courses && account.context?.academic
    ? [{ ...account, courses: undefined, label: `${account.label} (context 경로)` }, { ...account, label: `${account.label} (courses 경로)` }]
    : [account]));
  runs.forEach(({ label, context, courses, prefs, interests }) => {
    const signals = scorer.extractUserSignals(context, courses);
    const safePrefs = scorer.sanitizePrefs(prefs);
    const pool = interests ? jobs.filter(j => interests.includes(j.jobLrclNm)) : jobs;
    const ranked = scorer.rankCandidates(signals, safePrefs, pool, { limit: 10, perMidClass: 3 });
    const confidence = scorer.calcConfidence(signals, safePrefs);
    const flow = confidence === 'low' && !interests ? 'needs_interests' : `결과 표시${confidence === 'low' ? ' + 참고용' : ''}`;
    const distinct = kind => new Set(ranked.map(c => c.breakdown[kind])).size;
    const knowledgeMapped = [...signals.knowledgeSubjects].map(([k, s]) => `${k}←${s.join('/')}`).join(', ');
    const abilityMapped = [...signals.skillAbilities].map(([a, s]) => `${a}←${s.join('/')}`).join(', ');

    console.log(`\n▶ ${label}`);
    if (interests) console.log(`  후보 풀: ${pool.length}건 (관심분야 필터)`);
    console.log(`  과목→지식: ${knowledgeMapped || '없음'}`);
    console.log(`  스킬→능력: ${abilityMapped || '없음'}`);
    console.log(`  신뢰도: ${confidence} (입력 신호 ${scorer.countSignalKinds(signals, safePrefs)}종) → 요청 흐름: ${flow}`);
    console.log(`  1위 ${ranked[0]?.total ?? '-'}, 5위 ${ranked[4]?.total ?? '-'} / 후보 10개 값 종류: 지식 ${distinct('knowledge')}, 기술 ${distinct('skill')}, 선호 ${distinct('pref')}`);
    const picks = scorer.pickDiverse(ranked, 3);
    console.log(`  picks: ${picks.map(p => `${ranked.indexOf(p) + 1}위 ${p.title} [${p.jobMdclNm}]`).join(' / ')}`);
    ranked.forEach((c, i) => {
      const b = c.breakdown;
      const matched = [
        c.matched.major && `전공:${c.matched.major}`,
        c.matched.certs.length && `자격:${c.matched.certs.join('/')}`,
        c.matched.subjects.length && `과목:${c.matched.subjects.join('/')}`,
        c.matched.topicSubjects.length && `주제:${c.matched.topicSubjects.join('/')}`,
        c.matched.skills.length && `기술:${c.matched.skills.join('/')}`,
        c.matched.prefs.length && c.matched.prefs.join('/'),
      ].filter(Boolean).join(' ');
      console.log(`  ${String(i + 1).padStart(2)}. ${c.title} [${c.jobMdclNm}] ${c.total} ` +
        `(전공${b.major} 자격${b.cert} 지식${b.knowledge} 기술${b.skill} 선호${b.pref}) ${matched}`);
    });
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const jobs = await JobCatalog.find({ source: 'jobInfo', syncError: '' })
    .select('jobCode title jobLrclNm jobMdclNm knowledge abilities characteristics relatedDepartments certNames averageSalary searchText summary responsibilities')
    .lean();
  console.log(`카탈로그 직무 ${jobs.length}건`);

  const certSplitOk = checkCertSplit();
  const namesOk = checkNames(jobs);
  const deptOk = checkDepartments(jobs);
  checkSkills(jobs);
  checkImportance(jobs);
  checkCerts(jobs);
  const topicOk = checkTopicTerms(jobs);
  checkAccounts(jobs);
  const rulesOk = checkScoringRules();

  await mongoose.connection.close();
  if (!certSplitOk || !namesOk || !deptOk || !rulesOk || !topicOk) process.exitCode = 1;
}

main().catch(async error => {
  console.error('❌ 점검 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
