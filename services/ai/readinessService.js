// 포트폴리오/진단 생성 전 데이터 충분성 판정 — LLM 미사용. 결정적 계산만 한다.

const MAJOR_COURSES_MIN = 3;   // 포트폴리오 게이트: 이 밑이면 아예 LLM 호출 자체를 막는다
const MAJOR_COURSES_FULL = 10; // score 만점 기준
const CERTS_FULL = 3;
const EXPERIENCES_FULL = 3;
const SKILLS_FULL = 5;
const AWARDS_FULL = 2;
const LANGUAGES_FULL = 1;

function ratio(count, full) {
  return Math.min((count || 0) / full, 1);
}

function scoreOf(count, full) {
  return Math.round(ratio(count, full) * 100);
}

// 어학은 배열 길이만으로 "0건"을 판정하면 "만료돼서 0건"과 "애초에 등록 안 함"을
// 구분 못 한다 — contextBuilder가 만들어둔 hasAnyLanguage/hasExpiredLanguage
// 플래그로 나눈다(specs.languages는 이미 "시험별 최고점만, 만료 제외"로 걸러진 배열).
function languageBreakdown(context) {
  const validCount = (context?.specs?.languages || []).length;
  if (validCount === 0 && context?.specs?.hasExpiredLanguage) {
    return { score: 0, detail: '만료됨' };
  }
  return { score: scoreOf(validCount, LANGUAGES_FULL), detail: validCount ? `${validCount}건 등록` : '미등록' };
}

// 영역별 0~100 점수 + 배점(weight) + 총점(total = Σ(score×weight)/100).
// 단일 숫자만 주면 사용자가 뭘 채워야 할지 알 수 없어서, 총점 대신(혹은 총점과 함께)
// breakdown 배열을 반환한다 — 로직이 아니라 반환값의 확장이다.
function calcBreakdown(context) {
  const majorCourses = context?.academic?.majorCourses || [];
  const certifications = context?.specs?.certifications || [];
  const experiences = context?.specs?.experiences || [];
  const skills = context?.specs?.skills || [];
  const awards = context?.specs?.awards || [];
  const language = languageBreakdown(context);

  return [
    { key: 'job', label: '목표 직무', score: context?.targetJob ? 100 : 0, weight: 20, detail: context?.targetJob ? '설정됨' : '미설정' },
    { key: 'major', label: '전공 이수', score: scoreOf(majorCourses.length, MAJOR_COURSES_FULL), weight: 20, detail: majorCourses.length ? `${majorCourses.length}과목 이수` : '미등록' },
    { key: 'certification', label: '자격증', score: scoreOf(certifications.length, CERTS_FULL), weight: 20, detail: certifications.length ? `${certifications.length}개 보유` : '미등록' },
    { key: 'experience', label: '경험·활동', score: scoreOf(experiences.length, EXPERIENCES_FULL), weight: 15, detail: experiences.length ? `${experiences.length}건` : '미등록' },
    { key: 'skill', label: '보유 스킬', score: scoreOf(skills.length, SKILLS_FULL), weight: 10, detail: skills.length ? `${skills.length}개` : '미등록' },
    { key: 'award', label: '수상', score: scoreOf(awards.length, AWARDS_FULL), weight: 10, detail: awards.length ? `${awards.length}건` : '미등록' },
    { key: 'language', label: '어학', score: language.score, weight: 5, detail: language.detail },
  ];
}

function calcTotal(breakdown) {
  return Math.round(breakdown.reduce((sum, row) => sum + (row.score * row.weight) / 100, 0));
}

/**
 * 포트폴리오 생성 게이트 — 최소 데이터 요건(목표직무+전공과목3+스펙1)을 강제한다.
 * @param {object} context buildPortfolioContext(userId) 결과
 * @returns {{ ready: boolean, blockers: string[], total: number, breakdown: Array<{key,label,score,weight,detail}> }}
 */
function checkReadiness(context) {
  const blockers = [];

  if (!context?.targetJob) {
    blockers.push('목표 직무를 설정해 주세요');
  }
  if ((context?.academic?.majorCourses || []).length < MAJOR_COURSES_MIN) {
    blockers.push(`이수한 전공 과목을 등록해 주세요 (${MAJOR_COURSES_MIN}개 이상)`);
  }

  const specsCount = (context?.specs?.skills?.length || 0)
    + (context?.specs?.awards?.length || 0)
    + (context?.specs?.experiences?.length || 0)
    + (context?.specs?.languages?.length || 0)
    + (context?.specs?.certifications?.length || 0);
  if (specsCount < 1) {
    blockers.push('보유 스펙을 1개 이상 등록해 주세요');
  }

  const breakdown = calcBreakdown(context);
  return { ready: blockers.length === 0, blockers, total: calcTotal(breakdown), breakdown };
}

/**
 * 진단 생성 게이트 — 데이터가 거의 없어도 "뭐가 없는지"가 곧 진단 결과이므로
 * 목표 직무 하나만 있으면 된다(갭 분석의 기준점이 필요할 뿐).
 */
function checkDiagnosisReadiness(context) {
  return context?.targetJob
    ? { ready: true, blockers: [] }
    : { ready: false, blockers: ['목표 직무를 설정해 주세요'] };
}

module.exports = { checkReadiness, checkDiagnosisReadiness };
