// AI 진로 추천 적합도 점수 계산 (순수 함수만, DB 접근 없음).
// 규칙은 Phase5 계획서 v3 §4. 매핑표의 오른쪽 이름은 전부 JobCatalog에 실제로 있는 값이어야
// 하며 scripts/checkRecommendScorer.js가 검사한다 — 한 글자만 달라도 에러 없이 0점이 된다.

const WEIGHTS = { major: 15, cert: 20, knowledge: 25, skill: 20, pref: 20 };
const CERT_POINT = 12;
const SKILL_POINT = 10; // 걸린 능력 하나당 importance/100 × 10, 최대 20
const PREF_POINTS = { work: 12, style: 4, salary: 4 };

// ── 정규화 ─────────────────────────────────────────────

const norm = v => String(v || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

// "정보처리기사·산업기사" → ["정보처리기사", "정보처리산업기사"]
const CERT_SERIES = /(기술사|기능장|산업기사|기사|기능사|\d급)$/;
function expandCert(raw) {
  const parts = String(raw).split('·').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  const m = parts[0].match(CERT_SERIES);
  const stem = m ? parts[0].slice(0, -m[0].length) : parts[0];
  return [parts[0], ...parts.slice(1).map(p => (p.replace(CERT_SERIES, '') === '' ? stem + p : p))];
}

// 1차 API relCertList.certNm은 꼬리표("컴퓨터활용능력 1급(국가기술)")가 붙거나 한 항목에
// 여러 개가 쉼표로 들어 있다("빅데이터분석기사, 데이터분석전문가"). 끝의 괄호만 뗀다 —
// 이름 중간의 괄호는 자격증 이름의 일부일 수 있다.
function splitCertNames(raw) {
  return String(raw || '')
    .split(/[,，]/)
    .map(s => s.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim())
    .filter(Boolean);
}

// 학과: 끝의 학과/전공/학부/과/부 제거. 같으면 길이와 무관하게 일치,
// 포함 관계는 짧은 쪽이 3자 이상일 때만 인정("경영" ⊂ "경영정보" 차단)
const normMajor = v => norm(v).replace(/(학과|전공|학부|과|부)$/, '');

// 고용24 학과명이 "컴퓨터·통신공학"처럼 계열 단위일 수 있어서 구분자로도 쪼갠다.
const splitDept = d => [d, ...String(d).split(/[·ㆍ,/]/)].map(s => s.trim()).filter(Boolean);

// 카탈로그 표기와 이어지지 않는 전공만 여기 추가한다(점검 스크립트로 발견된 것만).
// 키·값 모두 normMajor 결과 기준. 모든 전공을 망라하려 하지 않는다.
const MAJOR_ALIASES = {
  영어영문: ['영미어'], // 카탈로그: "영미어·문학과"
};

function majorMatch(userMajor, depts) {
  const base = normMajor(userMajor);
  if (!base) return false;
  return [base, ...(MAJOR_ALIASES[base] || [])].some(u => majorMatchOne(u, depts));
}

function majorMatchOne(u, depts) {
  return (depts || []).flatMap(splitDept).some(d => {
    const dd = normMajor(d);
    if (!dd) return false;
    if (dd === u) return true;
    const [short, long] = dd.length <= u.length ? [dd, u] : [u, dd];
    return short.length >= 3 && long.includes(short);
  });
}

// ── 매핑표 ─────────────────────────────────────────────

// 과목명 → 지식(knowledge) 이름. 실제 교과명 1,034개로 오탐을 걸러낸 표(계획서 §3-3, §4-4).
const SUBJECT_KNOWLEDGE_MAP = [
  [/프로그래밍|코딩|자바|파이썬|알고리즘|자료구조|데이터베이스|운영체제|컴퓨터|소프트웨어|웹(?!툰)|앱|인공지능|머신러닝|딥러닝|빅데이터|데이터사이언스|클라우드|정보보호|해킹|시스템분석|객체지향/, ['컴퓨터와 전자공학']],
  [/네트워크|통신|무선|이동통신/, ['통신', '컴퓨터와 전자공학']],
  [/전자|회로|전기|반도체|신호처리|디지털논리|임베디드|마이크로프로세서/, ['컴퓨터와 전자공학', '물리']],
  [/미적분|선형대수|이산수학|확률|통계|수학|해석학|수치해석/, ['산수와 수학']],
  [/물리|(열|유체|유제|고체|재료|구조|운동|동|정|양자|전자기)역학/, ['물리']],
  [/화학/, ['화학']],
  [/생물|생명|유전|미생물|생리학/, ['생물']],
  [/기계|CAD|열역학|유체|메카트로닉스|로봇/, ['기계', '공학과 기술']],
  [/건축|토목|구조설계|도시계획|조경/, ['건축 및 설계']],
  [/(?<!교육)공학/, ['공학과 기술']],
  [/회계|재무|경제|금융|세무|투자/, ['경제와 회계']],
  [/경영|조직|전략|창업|생산관리|행정/, ['경영 및 행정']],
  [/인사관리|인적자원|노사/, ['인사']],
  [/마케팅|광고|소비자|영업|유통|브랜드/, ['영업과 마케팅']],
  [/서비스|고객/, ['고객서비스']],
  [/심리/, ['심리']],
  [/상담/, ['상담']],
  [/법학|민법|형법|헌법|상법|행정법|노동법|법률|국제법|소송/, ['법']],
  [/영어|English|토익|TOEIC|영문|영미/i, ['영어']],
  [/국어|문학|글쓰기|작문|한국어/, ['국어']],
  [/(?<!캡스톤)디자인|드로잉|색채|UX|UI|타이포/, ['디자인']], // i 플래그 없음: "ui"가 영단어 안에 걸리지 않게
  [/미술|음악|예술|영상|사진|공연|연기|무용/, ['예술']],
  [/미디어|커뮤니케이션|언론|방송|저널리즘|홍보|스피치/, ['의사소통과 미디어']],
  [/교육|교수법|교직|교과교재/, ['교육 및 훈련']],
  [/사회학|인류|복지|사회문제/, ['사회와 인류']],
  [/역사|사학|한국사/, ['역사']],
  [/철학|윤리|신학|종교/, ['철학과 신학']],
  [/지리|지역학/, ['지리']],
  [/간호|의학|보건|해부|약리|병리|임상/, ['의료']],
  [/식품|영양|조리|외식/, ['식품생산']],
  [/무역|물류|교통|운송|항공/, ['운송']],
  [/안전|소방|재난|경호|보안/, ['안전과 보안']],
  [/사무|문서|오피스|엑셀/, ['사무']],
];

// 스킬명·경험 제목 → 그 도구가 증명하는 능력(abilities) 이름. 고용24 직무 설명에는 도구 이름이
// 거의 없어서(Python·Excel 0건) 텍스트 매칭 대신 능력으로 옮겨 비교한다. 지식은 과목이 맡으므로
// 대상에서 뺀다(같은 신호를 두 번 세지 않기 위해).
const SKILL_ABILITY_MAP = [
  [/python|파이썬|java(?!script)|자바|javascript|자바스크립트|typescript|react|리액트|vue|spring|스프링|node|kotlin|swift|c\+\+|c#|코딩|프로그래밍|개발|부트캠프|알고리즘|git/i, ['전산', '기술 설계']],
  [/sql|데이터베이스|db|excel|엑셀|pandas|tableau|태블로|power ?bi|통계|spss|데이터 ?분석|빅데이터/i, ['전산', '수리력', '논리적 분석']],
  [/figma|피그마|photoshop|포토샵|illustrator|일러스트|premiere|프리미어|after ?effects|영상 ?편집|디자인|3d|blender|블렌더/i, ['창의력']],
  [/회계|재무|세무|erp|전산회계|결산/i, ['재정 관리']],
  [/발표|스피치|토론|영업|마케팅|판매|홍보/i, ['말하기', '설득']],
  [/튜터|멘토|강사|과외|교육 ?봉사|조교/i, ['가르치기']],
  [/글쓰기|기자|에디터|블로그|작가|카피|번역/i, ['글쓰기']],
];
// 한 글자 언어명은 오탐이 쉬워서 스킬명 전체가 일치할 때만 적용한다(경험 제목에는 적용하지 않음)
const SKILL_ONLY_ABILITY_MAP = [
  [/^\s*c\s*(언어)?\s*$/i, ['전산', '기술 설계']],
  [/^\s*r\s*(언어)?\s*$/i, ['전산', '수리력', '논리적 분석']],
];

const IMPORTANCE_MAX = 100; // 점검 스크립트 3-1에서 knowledge·abilities·characteristics 모두 최대 100 이하로 확인

// ── 선호 체크리스트 ───────────────────────────────────────

const PREF_OPTIONS = {
  work: {
    label: '끌리는 일',
    max: 3,
    options: [
      { key: 'build', label: '무언가를 만들고 구현하는 일' },
      { key: 'analyze', label: '데이터를 분석해 답을 찾는 일' },
      { key: 'persuade', label: '사람을 설득하고 조율하는 일' },
      { key: 'operate', label: '시스템을 안정적으로 운영하는 일' },
      { key: 'design', label: '보기 좋게 설계·디자인하는 일' },
      { key: 'precise', label: '규칙에 따라 정확히 처리하는 일' },
    ],
  },
  style: {
    label: '일하는 방식',
    max: 1,
    options: [
      { key: 'solo', label: '혼자 깊게 파고들기' },
      { key: 'team', label: '팀과 협업하기' },
      { key: 'any', label: '상관없음' },
    ],
  },
  value: {
    label: '가장 중요한 것',
    max: 1,
    options: [
      { key: 'salary', label: '연봉' },
      { key: 'growth', label: '새 기술과 성장' },
      { key: 'stable', label: '안정성' },
      { key: 'balance', label: '워라밸' },
    ],
  },
};

const targets = ({ characteristics = [], abilities = [], knowledge = [] }) => ({
  characteristics: new Set(characteristics),
  abilities: new Set(abilities),
  knowledge: new Set(knowledge),
});

// 정확한 이름 집합으로만 매칭한다(부분일치 금지 — 계획서 §6).
const WORK_PREF_TARGETS = {
  build: targets({ characteristics: ['혁신'], abilities: ['기술 설계', '전산', '설치'] }),
  analyze: targets({ characteristics: ['분석적 사고'], abilities: ['논리적 분석', '수리력', '기술 분석', '품질관리분석'] }),
  persuade: targets({ characteristics: ['리더십', '사회성'], abilities: ['설득', '협상', '말하기', '행동조정'] }),
  operate: targets({ abilities: ['장비의 유지', '작동 점검', '고장의 발견.수리', '조작 및 통제', '모니터링(Monitoring)'] }),
  design: targets({ abilities: ['창의력', '공간지각력'], knowledge: ['디자인', '예술'] }),
  precise: targets({ characteristics: ['꼼꼼함', '자기통제'] }),
};

const STYLE_TARGETS = {
  solo: targets({ characteristics: ['독립성'] }),
  team: targets({ characteristics: ['협조'] }),
};

const optionLabel = (question, key) => PREF_OPTIONS[question].options.find(o => o.key === key)?.label || key;
const isOptionKey = (question, key) => PREF_OPTIONS[question].options.some(o => o.key === key);

// 틀린 값은 400이 아니라 조용히 버린다 — 체크리스트는 선택 사항이다.
function sanitizePrefs(raw) {
  const work = Array.isArray(raw?.work)
    ? [...new Set(raw.work.filter(k => isOptionKey('work', k)))].slice(0, PREF_OPTIONS.work.max)
    : [];
  const style = isOptionKey('style', raw?.style) ? raw.style : null;
  const value = isOptionKey('value', raw?.value) ? raw.value : null;
  return { work, style, value };
}

// ── 사용자 신호 ───────────────────────────────────────────

function mapSubjectsToKnowledge(subjects) {
  const knowledgeSubjects = new Map(); // 지식 이름 → [과목명]
  subjects.forEach(subject => {
    const compactName = String(subject).replace(/\s+/g, '');
    SUBJECT_KNOWLEDGE_MAP.forEach(([pattern, names]) => {
      if (!pattern.test(compactName)) return;
      names.forEach(name => {
        const list = knowledgeSubjects.get(name) || [];
        if (!list.includes(subject)) list.push(subject);
        knowledgeSubjects.set(name, list);
      });
    });
  });
  return knowledgeSubjects;
}

// buildUserContext 결과는 compact()로 null·빈 배열 키가 통째로 사라진다 → 전부 ?.와 || []로 읽는다.
function extractUserSignals(context) {
  const majors = [context?.profile?.major, context?.profile?.doubleMajor].filter(Boolean);
  const certs = (context?.specs?.certifications || []).map(c => c?.name).filter(Boolean);
  const subjects = [...new Set([
    ...(context?.academic?.majorCourses || []).map(s => s?.name),
    ...(context?.academic?.currentSubjects || []).map(s => s?.name),
  ].filter(Boolean))];
  const skills = (context?.specs?.skills || []).map(s => s?.name).filter(Boolean);
  const experiences = (context?.specs?.experiences || []).map(e => e?.title).filter(Boolean);

  const certIndex = new Map(); // norm(펼친 이름) → 원래 표기
  certs.forEach(name => expandCert(name).forEach(n => certIndex.set(norm(n), name)));

  return {
    majors, certs, subjects, skills, experiences,
    certIndex,
    knowledgeSubjects: mapSubjectsToKnowledge(subjects),
    skillAbilities: mapSkillsToAbilities(skills, experiences),
  };
}

// 능력 이름 → [그 능력을 증명한 스킬·경험]
function mapSkillsToAbilities(skills, experiences) {
  const skillAbilities = new Map();
  const add = (label, abilityNames) => abilityNames.forEach(name => {
    const list = skillAbilities.get(name) || [];
    if (!list.includes(label)) list.push(label);
    skillAbilities.set(name, list);
  });
  skills.forEach(label => {
    SKILL_ONLY_ABILITY_MAP.forEach(([pattern, abilityNames]) => { if (pattern.test(label)) add(label, abilityNames); });
  });
  [...skills, ...experiences].forEach(label => {
    SKILL_ABILITY_MAP.forEach(([pattern, abilityNames]) => { if (pattern.test(label)) add(label, abilityNames); });
  });
  return skillAbilities;
}

// ── 점수 ───────────────────────────────────────────────

const TARGET_FIELDS = ['characteristics', 'abilities', 'knowledge'];

// 직무의 5개 항목 중 target 이름과 일치하는 것의 최대 importance/IMPORTANCE_MAX (없으면 0).
// 적중 여부(0/1)가 아니라 중요도로 가중해야 흔한 항목이 모든 직무에 같은 점수를 주지 않는다.
function targetStrength(job, target) {
  let best = 0;
  TARGET_FIELDS.forEach(field => {
    (job[field] || []).forEach(item => {
      if (target[field].has(item?.name)) best = Math.max(best, (item.importance || 0) / IMPORTANCE_MAX);
    });
  });
  return best;
}

// 후보 풀 연봉(0 제외)의 오름차순 배열에서 v의 백분위(0~1)
function salaryPercentile(v, sortedPool) {
  if (!v || sortedPool.length === 0) return 0;
  if (sortedPool.length === 1) return 1;
  const below = sortedPool.filter(s => s < v).length;
  return below / (sortedPool.length - 1);
}

function buildSalaryPool(jobs) {
  return (jobs || []).map(j => j?.averageSalary?.median50 || 0).filter(v => v > 0).sort((a, b) => a - b);
}

// 직무 쪽 데이터가 없으면 그 항목은 0점이며 환산하지 않는다(계획서 §3-5).
function scoreJob(signals, prefs, job, salaryPool = []) {
  const breakdown = { major: 0, cert: 0, knowledge: 0, skill: 0, pref: 0 };
  const matched = { major: null, certs: [], subjects: [], skills: [], prefs: [] };

  const majorHit = signals.majors.find(m => majorMatch(m, job.relatedDepartments));
  if (majorHit) {
    breakdown.major = WEIGHTS.major;
    matched.major = majorHit;
  }

  const jobCerts = new Set(job.certNames || []);
  const heldCerts = [...new Set([...signals.certIndex].filter(([key]) => jobCerts.has(key)).map(([, name]) => name))];
  breakdown.cert = Math.min(WEIGHTS.cert, heldCerts.length * CERT_POINT);
  matched.certs = heldCerts;

  const jobKnowledge = job.knowledge || [];
  const totalImportance = jobKnowledge.reduce((sum, k) => sum + (k.importance || 0), 0);
  const heldKnowledge = jobKnowledge.filter(k => signals.knowledgeSubjects.has(k.name));
  if (totalImportance > 0 && heldKnowledge.length > 0) {
    const heldImportance = heldKnowledge.reduce((sum, k) => sum + (k.importance || 0), 0);
    breakdown.knowledge = Math.round((WEIGHTS.knowledge * heldImportance) / totalImportance);
    matched.subjects = [...new Set(heldKnowledge.flatMap(k => signals.knowledgeSubjects.get(k.name)))];
  }

  const heldAbilities = (job.abilities || []).filter(a => signals.skillAbilities.has(a.name));
  const skillRaw = heldAbilities.reduce((sum, a) => sum + ((a.importance || 0) / IMPORTANCE_MAX) * SKILL_POINT, 0);
  breakdown.skill = Math.min(WEIGHTS.skill, Math.round(skillRaw));
  matched.skills = [...new Set(heldAbilities.flatMap(a => signals.skillAbilities.get(a.name)))];

  let pref = 0;
  const work = (prefs?.work || []).filter(key => WORK_PREF_TARGETS[key]);
  if (work.length > 0) {
    const strengths = work.map(key => targetStrength(job, WORK_PREF_TARGETS[key]));
    pref += Math.round((PREF_POINTS.work * strengths.reduce((a, b) => a + b, 0)) / work.length);
    work.forEach((key, i) => { if (strengths[i] > 0) matched.prefs.push(`선호: ${optionLabel('work', key)}`); });
  }
  if (prefs?.style && STYLE_TARGETS[prefs.style]) {
    const stylePoint = Math.round(PREF_POINTS.style * targetStrength(job, STYLE_TARGETS[prefs.style]));
    if (stylePoint > 0) {
      pref += stylePoint;
      matched.prefs.push(`방식: ${optionLabel('style', prefs.style)}`);
    }
  }
  if (prefs?.value === 'salary') {
    const salaryPoint = Math.round(PREF_POINTS.salary * salaryPercentile(job.averageSalary?.median50 || 0, salaryPool));
    if (salaryPoint > 0) {
      pref += salaryPoint;
      matched.prefs.push(`중시: ${optionLabel('value', 'salary')}`);
    }
  }
  breakdown.pref = Math.min(WEIGHTS.pref, pref);

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown, matched };
}

// 총점 내림차순 → jobCode 오름차순. 같은 입력이면 항상 같은 후보가 나와야 한다.
function rankCandidates(signals, prefs, jobs, { limit = 10, perMidClass = 3 } = {}) {
  const salaryPool = buildSalaryPool(jobs);
  const scored = (jobs || []).map(job => ({
    jobCode: job.jobCode,
    title: job.title,
    jobLrclNm: job.jobLrclNm || '',
    jobMdclNm: job.jobMdclNm || '',
    ...scoreJob(signals, prefs, job, salaryPool),
  }));
  scored.sort((a, b) => b.total - a.total || String(a.jobCode).localeCompare(String(b.jobCode)));

  const picked = [];
  const perClass = new Map();
  for (const candidate of scored) {
    const count = perClass.get(candidate.jobMdclNm) || 0;
    if (count >= perMidClass) continue;
    perClass.set(candidate.jobMdclNm, count + 1);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}

// 반드시 선호 점수를 반영한 순위로 판정한다(계획서 §6).
function calcConfidence(ranked) {
  if (!ranked || ranked.length === 0) return 'low';
  const activeKinds = Object.keys(WEIGHTS).filter(kind => ranked.some(c => c.breakdown[kind] > 0));
  if (activeKinds.length <= 1) return 'low';
  const compareWith = ranked[Math.min(4, ranked.length - 1)];
  return ranked[0].total - compareWith.total < 10 ? 'low' : 'normal';
}

module.exports = {
  WEIGHTS,
  norm,
  expandCert,
  splitCertNames,
  normMajor,
  splitDept,
  majorMatch,
  SUBJECT_KNOWLEDGE_MAP,
  MAJOR_ALIASES,
  SKILL_ABILITY_MAP,
  SKILL_ONLY_ABILITY_MAP,
  IMPORTANCE_MAX,
  PREF_OPTIONS,
  WORK_PREF_TARGETS,
  STYLE_TARGETS,
  sanitizePrefs,
  extractUserSignals,
  scoreJob,
  rankCandidates,
  calcConfidence,
};
