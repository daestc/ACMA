// 진로 추천 점수 규칙을 실제 카탈로그로 점검한다 (DB 읽기 전용). Phase5 계획서 v3 §5-1.
// 실행: node scripts/checkRecommendScorer.js
// 종료 코드: 매핑표 이름이 카탈로그에 없거나, 샘플 전공 중 매칭 0건이 3개 이상이면 1.

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

function checkAccounts(jobs) {
  section('4. 테스트 계정 가상 순위');
  ACCOUNTS.forEach(({ label, context, prefs, interests }) => {
    const signals = scorer.extractUserSignals(context);
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
    ranked.forEach((c, i) => {
      const b = c.breakdown;
      const matched = [
        c.matched.major && `전공:${c.matched.major}`,
        c.matched.certs.length && `자격:${c.matched.certs.join('/')}`,
        c.matched.subjects.length && `과목:${c.matched.subjects.join('/')}`,
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
    .select('jobCode title jobLrclNm jobMdclNm knowledge abilities characteristics relatedDepartments certNames averageSalary')
    .lean();
  console.log(`카탈로그 직무 ${jobs.length}건`);

  const certSplitOk = checkCertSplit();
  const namesOk = checkNames(jobs);
  const deptOk = checkDepartments(jobs);
  checkSkills(jobs);
  checkImportance(jobs);
  checkCerts(jobs);
  checkAccounts(jobs);

  await mongoose.connection.close();
  if (!certSplitOk || !namesOk || !deptOk) process.exitCode = 1;
}

main().catch(async error => {
  console.error('❌ 점검 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
