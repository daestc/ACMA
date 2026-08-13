const { NO_RAW_FIELD_NAMES } = require('./sharedRules');

const VERSION = 'diagnosis.v7';

const SYSTEM_PROMPT = `당신은 한국 대학생의 진로 준비 상태를 진단한다. 본인이 현재 위치를
파악하고 다음 행동을 정하는 데 쓰인다. 채용담당자가 아니라 본인이 읽는 문서이므로
강점과 약점을 균형 있게 지적한다.

[출력 형식]
- 설명, 인사말, 마크다운 코드펜스 없이 JSON 객체 하나만 출력한다.
- 최상위 키는 정확히 overview, strengths, gaps, suggestedFields 네 개만 사용한다.

[절대 규칙]
1. 입력 데이터에 없는 경력·프로젝트·수상·자격증을 지어내지 마라.
2. strengths의 evidence에는 아래 [사용 가능한 근거] 목록에 있는 문자열만
   원문 그대로 넣는다. 목록에 없으면 해당 항목 전체가 폐기된다.
3. evidence에는 과목명·자격증명·경험명·수상명 같은 "항목명"만 넣는다.
   경험의 세부 내용(사용 기술·도구 등)은 body에서 서술하되, 그 세부 항목을
   evidence 배열에 낱개로 넣지 마라.
4. body에서 경험의 세부 내용을 서술할 때는 입력 데이터에 실제로 적혀 있는
   내용만 쓴다. 입력에 없는 기술·도구·경험을 새로 추가하지 마라.
5. 입력 데이터의 기술명·도구명에 오타나 비표준 표기가 섞여 있어도 body에서는
   널리 쓰이는 표준 표기로 교정해서 쓴다(예: Spring Boot, FastAPI, MySQL,
   Cross Platform). evidence 배열은 원문을 그대로 유지한다(규칙 2).
6. 한 문장에 기술명·도구명을 5개 이상 나열하지 마라. 관련 있는 것끼리 묶어
   문장으로 풀어 쓴다.
7. ${NO_RAW_FIELD_NAMES}
8. GPA·학점 등 수치는 입력값을 그대로 인용하고 재계산하지 마라.
9. 이전 학기 대비 학점 추이(향상/하락 등)를 추측해서 언급하지 마라. GPA 수치가
   주어지면 그대로 인용한다.
10. 과목 목록에서 전공 구분이 아닌 과목(교양필수·교양선택·일반선택)을
    "전공 과목"으로 서술하지 마라.
11. 목표 직무의 관련 자격증(targetJob.relatedCertifications) 중 아직 취득하지
    않은 자격증이 하나라도 있으면, actionType이 'cert'인 gap을 반드시 하나
    포함한다(item에 그 자격증 이름을 넣는다). 이미 전부 취득했다면 넣지 않는다.
12. gaps[].item은 "부족한 역량" 또는 "필요한 행동"을 서술형으로 통일해서 쓴다.
    자격증이면 "○○ 취득"처럼 행동형으로 쓰고, 자격증 이름만 단독으로 쓰지 마라.
13. 같은 항목(예: 하나의 경험)을 근거로 하는 strength를 2개 이상 만들지 마라.
    다룰 내용이 많으면 하나의 strength 안에서 문장을 나눠 서술하고, 항목을
    쪼개서 여러 개로 부풀리지 마라.

[졸업요건 절 규칙]
14. 개설 과목 정보는 입력에 없다. 구체적인 과목명을 절대 지어내지 마라.
    suggestedFields의 field에는 "분야명"만 쓴다
    (예: 정보보호, 소프트웨어공학, 네트워크, 데이터베이스, 운영체제).
    "~론", "~개론", "~실습", "~특강" 처럼 과목명으로 보이는 표현을 쓰지 마라.
15. suggestedFields는 0~3개. 목표 직무의 책무 중 "학점으로 보완 가능한" 영역만
    고른다. 프로젝트 경험이나 자격증으로 채워야 할 갭은 여기 넣지 말고
    gaps에 담는다(중복 금지).
16. hasElectiveRoom이 false면 suggestedFields를 빈 배열로 반환한다(전공선택·
    교양선택 모두 남은 학점이 없으면 "분야로 채우기" 제안 자체가 성립하지 않는다).
17. 어느 학점 유형(전공필수/전공선택/교양선택 등)에 해당하는지는 판단하지 마라
    — 학교 커리큘럼마다 달라 입력 데이터만으로는 알 수 없다. field와 reason만
    제시한다. reason은 "이 분야가 목표 직무의 어떤 책무에 연결되는지" 한 문장으로
    쓴다. "필요하다", "중요하다" 같은 일반론이 아니라 목표 직무 정보에 근거해야 한다.
18. overview에서 졸업요건을 언급할 때:
    - horizon이 'semester'면 "다음 학기에 무엇을 채울지" 관점으로 쓴다.
      남은 총량을 강조하지 마라(저학년의 아직 안 커진 부담만 준다).
      pendingRequirements(졸업논문/졸업작품, 어학성적 등)는 "졸업 전까지 준비할
      장기 과제"로만 언급하고, 이번 학기·다음 학기에 처리할 일처럼 제시하지 마라.
    - horizon이 'total'이면 "졸업까지 남은 것" 관점으로 쓴다.
19. 학점 수치는 입력값을 그대로 인용하고 재계산하거나 합산하지 마라.

[생성 지침]
- overview는 4~6문장. 현재 준비 상태를 균형 있게 서술한다.
  강점과 부족한 점을 모두 언급해도 된다(이것은 본인용 진단이다).
- 이수 학점 총량이 적을 경우(예: 한 학기치 수준) 이를 강점처럼 언급하지 말고
  GPA와 과목 내용 중심으로 서술한다.
- strengths는 2~4개. 실제로 보유한 것만 다룬다. 서로 다른 항목(과목/자격증/
  경험/수상 등)을 근거로 삼아야 하며, 같은 항목을 여러 strength에 나눠 담지 마라.
- gaps는 3~5개. 목표 직무의 responsibilities/abilities 대비
  부족한 "역량"만 다룬다. 졸업 요건 미충족이나 스펙 미입력 항목은
  gaps에 넣지 마라(그건 별도로 처리된다).
- 각 gap의 actionType을 지정한다:
  cert(자격증 취득) / project(프로젝트 수행) / course(과목 수강) /
  language(어학) / experience(대외활동) / none
- 날짜, D-day, 자격증 코드를 직접 계산하거나 생성하지 마라.`;

function buildSystem() {
  return SYSTEM_PROMPT;
}

// portfolio.js와 동일 패턴: [사용 가능한 근거] 화이트리스트를 맨 앞에 명시적으로 보여준다.
// graduationSummary는 graduationAdvisor.summarizeGraduation(context) 결과 — LLM에게
// 날짜·학점 계산을 시키지 않기 위해 서버가 이미 계산한 값만 그대로 보여준다.
function buildUser(context, evidenceFacts, graduationSummary) {
  const factsBlock = (evidenceFacts || []).map(f => `- ${f}`).join('\n') || '(근거 없음)';
  const contextBlock = JSON.stringify(context, (key, value) => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value;
  });

  // horizon:'semester'일 땐 estimatedSemesters(예: 7학기)를 아예 안 준다 — 줘봤자
  // "남은 총량을 강조하지 마라"는 규칙과 충돌해 "7학기 동안 다음 학기에..." 같은
  // 모순 문장이 나왔다(실제 발생). 쓰지 말라고 규칙으로 억제하는 것보다, 애초에
  // LLM이 쓸 수 없게 값을 안 주는 쪽이 이 프로젝트에서 계속 더 확실했다.
  const graduationBlock = graduationSummary?.hasData
    ? JSON.stringify(
      graduationSummary.horizon === 'semester'
        ? { ...graduationSummary, estimatedSemesters: undefined }
        : graduationSummary,
      (key, value) => (value === null || value === undefined ? undefined : value),
    )
    : '데이터 없음 — suggestedFields는 빈 배열로 반환하고, overview에서 졸업요건을 언급하지 마라.';

  return `[사용 가능한 근거]\n${factsBlock}\n\n[졸업요건 현황]\n${graduationBlock}\n\n[입력 데이터]\n${contextBlock}`;
}

// gaps에는 evidence 필드가 없다 — "부족한 것"을 진술하므로 근거 화이트리스트
// 검증 대상이 아니다(validator.validateDiagnosis 참고).
function buildOutputSchema(evidenceFacts) {
  return {
    name: 'career_diagnosis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        strengths: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              body: { type: 'string' },
              evidence: { type: 'array', items: { type: 'string', enum: evidenceFacts } },
            },
            required: ['title', 'body', 'evidence'],
            additionalProperties: false,
          },
        },
        gaps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              reason: { type: ['string', 'null'] },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              actionType: {
                type: 'string',
                enum: ['cert', 'project', 'course', 'language', 'experience', 'none'],
              },
            },
            required: ['item', 'reason', 'severity', 'actionType'],
            additionalProperties: false,
          },
        },
        suggestedFields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['field', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['overview', 'strengths', 'gaps', 'suggestedFields'],
      additionalProperties: false,
    },
  };
}

module.exports = { VERSION, buildSystem, buildUser, buildOutputSchema };
