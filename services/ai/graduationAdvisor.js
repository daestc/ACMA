// 진단의 "시간 제약 축" — 졸업까지 학점이 얼마나 남았고 어느 방향으로 채울지를
// 결정적으로 계산한다. LLM 미사용.

const CREDITS_PER_SEMESTER = 18;
const CLOSE_TO_GRADUATION_SEMESTERS = 3;

function emptySummary(context) {
  return {
    hasData: false,
    remaining: {
      total: null, majorRequired: null, majorElective: null,
      generalRequired: null, generalElective: null,
    },
    pendingRequirements: context?.academic?.pendingRequirements || [],
    estimatedSemesters: null,
    horizon: 'semester',
    hasElectiveRoom: false,
  };
}

function clamp(v) {
  return Number.isFinite(v) ? Math.max(0, v) : null;
}

/**
 * @param {object} context buildPortfolioContext(userId) 결과
 * @returns {{
 *   hasData: boolean,
 *   remaining: { total, majorRequired, majorElective, generalRequired, generalElective },
 *   pendingRequirements: string[],
 *   estimatedSemesters: number|null,
 *   horizon: 'semester' | 'total',
 *   hasElectiveRoom: boolean
 * }}
 */
function summarizeGraduation(context) {
  const raw = context?.academic?.remaining || {};
  const hasData = [raw.total, raw.majorRequired, raw.majorElective, raw.generalRequired, raw.generalElective]
    .some(Number.isFinite);

  if (!hasData) return emptySummary(context);

  const remaining = {
    total: clamp(raw.total),
    majorRequired: clamp(raw.majorRequired),
    majorElective: clamp(raw.majorElective),
    generalRequired: clamp(raw.generalRequired),
    generalElective: clamp(raw.generalElective),
  };

  const estimatedSemesters = Number.isFinite(remaining.total)
    ? Math.ceil(remaining.total / CREDITS_PER_SEMESTER)
    : null;

  // 저학년은 남은 총량이 커서(예: 100학점 이상) "졸업까지 남은 것"을 강조하면
  // 실행 계획이 아니라 부담만 준다 — 임박했을 때만(3학기 이내) 총량 관점(total)을
  // 쓰고, 그 외엔 "다음 학기 관점"(semester)을 쓴다. profile.grade보다 실제 남은
  // 학점을 우선하는 이유는 휴학·복수전공 등으로 학년과 실제 진도가 어긋나는
  // 경우가 흔해서다.
  const horizon = (estimatedSemesters !== null && estimatedSemesters <= CLOSE_TO_GRADUATION_SEMESTERS)
    ? 'total' : 'semester';

  // 전공필수(majorRequired)·교양필수(generalRequired)는 지정된 과목을 그대로 들어야
  // 해서 "어느 분야로 채울지" 자체가 성립하지 않는다 — 실제로 이 축을 majorRequired
  // 기준으로 잡았다가 LLM이 "정보보호"를 majorRequired로 태깅하는(선택 불가능한
  // 영역에 분야를 배정하는) 무의미한 결과가 나온 적이 있다. 전공선택·교양선택
  // 어느 한쪽이라도 남아 있으면 분야 제안이 의미 있다.
  const hasElectiveRoom = (remaining.majorElective || 0) + (remaining.generalElective || 0) > 0;

  return {
    hasData: true,
    remaining,
    pendingRequirements: context?.academic?.pendingRequirements || [],
    estimatedSemesters,
    horizon,
    hasElectiveRoom,
  };
}

module.exports = { summarizeGraduation };
