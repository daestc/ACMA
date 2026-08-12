// 포트폴리오 미입력 데이터 결정적 분석 — LLM 미사용. 문구는 전부 템플릿.

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };
const MAX_MISSING = 5;

const LABEL_MAP = {
  targetJob: '목표 직무',
  language: '어학 성적',
  certification: '자격증',
  experience: '경험·활동',
  skill: '보유 스킬',
  award: '수상 경력',
  gpa: '학점 등록',
  languageExpired: '어학 성적 만료',
  graduation: '졸업 요건',
};

// 기존 라우터 마운트 경로(app.js: /career, /mystatus, /academic) 기준.
// 해시(#xxx)는 클라이언트 스크롤용이라 서버 라우팅과 무관 — 존재하지 않는 라우트
// 프리픽스만 아니면 404 위험 없음.
const LINK_MAP = {
  targetJob: '/career',
  language: '/mystatus#language',
  certification: '/mystatus#certification',
  experience: '/mystatus#experience',
  skill: '/mystatus#skill',
  award: '/mystatus#award',
  gpa: '/academic',
  languageExpired: '/mystatus#language',
  graduation: '/academic#graduation',
};

function buildReason(key, context) {
  const targetJob = context?.targetJob;

  switch (key) {
    case 'targetJob':
      return '목표 직무가 있어야 포트폴리오의 방향을 잡을 수 있습니다';
    case 'language':
      return targetJob
        ? `${targetJob.title} 직무 지원 시 어학 성적을 참고 자료로 활용할 수 있습니다`
        : '어학 성적은 포트폴리오에서 자주 요구되는 항목입니다';
    case 'certification':
      return targetJob?.relatedCertifications?.[0]
        ? `${targetJob.title} 직무는 ${targetJob.relatedCertifications[0]} 등의 자격증을 요구합니다`
        : '목표 직무와 관련된 자격증이 있으면 포트폴리오가 탄탄해집니다';
    case 'experience':
      return '실무 경험·활동은 포트폴리오에서 가장 설득력 있는 근거입니다';
    case 'skill':
      return targetJob?.abilities?.[0]
        ? `${targetJob.title} 직무는 ${targetJob.abilities[0]} 등의 역량을 요구합니다`
        : '보유 스킬이 3개 미만이면 역량을 설명하기 어렵습니다';
    case 'award':
      return '수상 경력은 역량을 객관적으로 뒷받침하는 근거가 됩니다';
    case 'gpa':
      return '학점 정보가 있어야 학업 성취도를 인용할 수 있습니다';
    case 'languageExpired':
      return '만료된 어학 성적은 인정되지 않아 재응시가 필요합니다';
    case 'graduation':
      return '아직 채우지 못한 졸업 요건이 있습니다';
    default:
      return null;
  }
}

/**
 * @param {object} context buildPortfolioContext(userId) 결과
 * @returns {Array<{ key, label, reason, impact, link }>} impact 내림차순, 최대 5개
 */
function analyzeMissing(context) {
  const items = [];
  const push = (key, impact) => items.push({
    key,
    label: LABEL_MAP[key],
    reason: buildReason(key, context),
    impact,
    link: LINK_MAP[key],
  });

  if (!context?.targetJob) push('targetJob', 'high');
  // specs.languages는 contextBuilder에서 이미 "시험별 최고점만, 만료 제외"로 걸러진
  // 배열이라 배열 존재/만료 여부 판정은 원본 기준 플래그(hasAnyLanguage/
  // hasExpiredLanguage)로 봐야 한다 — 배열 길이만 보면 만료된 것뿐인 경우를 놓친다.
  if (!context?.specs?.hasAnyLanguage) push('language', 'high');

  const hasAnyCert = (context?.certSchedule || []).length > 0 || (context?.specs?.certifications || []).length > 0;
  if (!hasAnyCert) push('certification', 'high');

  if (!(context?.specs?.experiences || []).length) push('experience', 'high');
  if ((context?.specs?.skills || []).length < 3) push('skill', 'medium');
  if (!(context?.specs?.awards || []).length) push('award', 'medium');
  if (context?.academic?.gpa === null || context?.academic?.gpa === undefined) push('gpa', 'medium');

  if (context?.specs?.hasExpiredLanguage) push('languageExpired', 'medium');

  if ((context?.academic?.pendingRequirements || []).length > 0) push('graduation', 'low');

  return items
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
    .slice(0, MAX_MISSING);
}

module.exports = { analyzeMissing };
