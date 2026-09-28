const { NO_RAW_FIELD_NAMES } = require('./sharedRules');

const VERSION = 'recommendation.v1';
const ANGLES = ['안정', '확장', '도전'];
const SUMMARY_MAX_CHARS = 120;
const KNOWLEDGE_LIMIT = 3;
const CERT_LIMIT = 3;

const SYSTEM_PROMPT = `당신은 한국 대학생에게 진로 후보 직무를 추천한다. 후보 직무는 시스템이 학생 정보로
점수를 매겨 이미 골라 두었다. 당신은 그 후보 안에서 3개를 고르고, 학생 본인이 읽을 추천 사유를 쓴다.

[출력 형식]
- 설명, 인사말, 마크다운 코드펜스 없이 JSON 객체 하나만 출력한다.
- 최상위 키는 recommendations 하나만 사용한다. recommendations는 정확히 3개다.

[절대 규칙]
1. jobCode는 [후보 직무]에 있는 값만 쓴다. 서로 다른 직무 3개를 고른다.
2. angle은 세 추천이 서로 다르게, '안정'·'확장'·'도전'을 하나씩 쓴다.
   - 안정: 지금 학생 데이터와 가장 잘 맞는 직무
   - 확장: 가진 역량을 살려 옆 분야로 넓히는 직무
   - 도전: 보완이 필요하지만 선호·관심분야·기술 신호가 있는 직무
3. reason은 2~3문장. 후보 직무 정보(요약, 핵심 지식·능력, 매칭 항목)와 학생 정보에 실제로 있는
   내용만 근거로 쓴다. 매칭 항목의 핵심 지식·능력 순위는 "이 직무에서 가장 중요한 능력이 전산이고"
   (1순위), "두 번째로 중요한 지식인"(2순위)처럼 자연어로 풀어 쓴다.
4. 점수·순위 숫자(총점, 몇 점, 몇 위)를 문장에 쓰지 마라.
5. 연봉·전망·근무 조건을 지어내지 마라. 학생이 워라밸이나 안정성을 중시한다고 답했어도, 입력에 없는
   근무 조건(야근이 적다, 정년이 보장된다 등)을 단정하지 마라. "중시한다고 답했다"는 사실만 언급할 수 있다.
6. 후보 직무 요약에 없는 업무를 서술하지 마라.
7. 입력 데이터에 없는 경력·프로젝트·자격증·과목을 지어내지 마라.
8. evidence에는 [사용 가능한 근거] 목록의 문자열만 원문 그대로 넣는다. 추천 사유에서 실제로 기댄 것만
   넣고, 없으면 빈 배열로 둔다.
9. ${NO_RAW_FIELD_NAMES}`;

function buildSystem() {
  return SYSTEM_PROMPT;
}

function dropEmpty(value) {
  return JSON.parse(JSON.stringify(value, (key, v) => {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v) && v.length === 0) return undefined;
    return v;
  }));
}

// 목표 직무·졸업요건·일정 같은 진단용 정보는 빼고, 추천 사유에 쓸 "가진 것"만 넘긴다.
function buildStudentBlock(context) {
  return dropEmpty({
    전공: context?.profile?.major,
    복수전공: context?.profile?.doubleMajor,
    학년: context?.profile?.grade,
    이수과목: (context?.academic?.majorCourses || []).map(c => c.name),
    이번학기과목: (context?.academic?.currentSubjects || []).map(s => s.name),
    자격증: (context?.specs?.certifications || []).map(c => c.name),
    스킬: (context?.specs?.skills || []).map(s => s.name),
    경험: (context?.specs?.experiences || []).map(e => e.title),
    수상: (context?.specs?.awards || []).map(a => a.name),
  });
}

function rankedNames(items, limit) {
  return (items || [])
    .filter(it => (it?.importance || 0) > 0)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
    .map(it => it.name);
}

function buildCandidateBlock(candidate, job) {
  const m = candidate.matched || {};
  return dropEmpty({
    jobCode: candidate.jobCode,
    직무명: candidate.title,
    중분류: candidate.jobMdclNm,
    요약: String(job?.summary || '').slice(0, SUMMARY_MAX_CHARS),
    중요지식: rankedNames(job?.knowledge, KNOWLEDGE_LIMIT),
    관련자격증: (job?.relatedCertifications || []).slice(0, CERT_LIMIT),
    총점: candidate.total,
    매칭: {
      전공: m.major,
      보유자격증: m.certs,
      과목: m.subjects,
      스킬: m.skills,
      경험: m.experiences,
      체크리스트: m.prefs,
      핵심지식: m.topKnowledge ? `${m.topKnowledge.name}(이 직무 ${m.topKnowledge.rank}순위)` : undefined,
      핵심능력: m.topAbility ? `${m.topAbility.name}(이 직무 ${m.topAbility.rank}순위)` : undefined,
    },
  });
}

/**
 * @param {object} context buildUserContext 결과
 * @param {Array} candidates recommendScorer.rankCandidates 결과
 * @param {Map} jobsByCode jobCode → JobCatalog 문서(summary·knowledge·relatedCertifications)
 * @param {string[]} prefLabels 체크리스트 응답 문구("선호: …", "방식: …", "중시: …")
 * @param {string[]} facts 근거 화이트리스트
 */
function buildUser(context, candidates, jobsByCode, prefLabels, facts) {
  const factsBlock = (facts || []).map(f => `- ${f}`).join('\n') || '(근거 없음)';
  const prefsBlock = (prefLabels || []).map(p => `- ${p}`).join('\n') || '(응답 없음)';
  const candidatesBlock = JSON.stringify(candidates.map(c => buildCandidateBlock(c, jobsByCode.get(c.jobCode))));
  return `[사용 가능한 근거]\n${factsBlock}\n\n[학생의 체크리스트 응답]\n${prefsBlock}\n\n`
    + `[학생 정보]\n${JSON.stringify(buildStudentBlock(context))}\n\n[후보 직무]\n${candidatesBlock}`;
}

// jobCode는 enum으로 후보 밖 직무를 구조적으로 막는다. facts가 비면 evidence 속성을 아예 뺀다 —
// 빈 enum은 strict 스키마에서 오류가 날 수 있다. "정확히 3개"는 프롬프트와 validator가 맡는다
// (minItems/maxItems는 strict 모드 지원이 불확실해 스키마에 넣지 않는다).
function buildOutputSchema(candidateCodes, facts) {
  const itemProperties = {
    jobCode: { type: 'string', enum: candidateCodes },
    angle: { type: 'string', enum: ANGLES },
    reason: { type: 'string' },
  };
  const required = ['jobCode', 'angle', 'reason'];
  if ((facts || []).length > 0) {
    itemProperties.evidence = { type: 'array', items: { type: 'string', enum: facts } };
    required.push('evidence');
  }

  return {
    name: 'career_recommendation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: { type: 'object', properties: itemProperties, required, additionalProperties: false },
        },
      },
      required: ['recommendations'],
      additionalProperties: false,
    },
  };
}

module.exports = { VERSION, ANGLES, buildSystem, buildUser, buildOutputSchema };
