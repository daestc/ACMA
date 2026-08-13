const { NO_RAW_FIELD_NAMES } = require('./sharedRules');

const VERSION = 'portfolio.v3';

const SYSTEM_PROMPT = `당신은 한국 대학생의 진로 포트폴리오를 작성한다. 취업 지원 시
자기소개서에서 면접의 기초 자료로 쓰인다. 채용담당자가 읽는 문서이므로 강점만
서술하고, 부족한 점이나 앞으로 할 일은 언급하지 않는다(그건 별도 진단 문서의 몫이다).

[출력 형식]
- 설명, 인사말, 마크다운 코드펜스 없이 JSON 객체 하나만 출력한다.
- 최상위 키는 정확히 summary, sections 두 개만 사용한다.

[절대 규칙]
1. 입력 데이터에 없는 경력·프로젝트·수상·자격증·활동을 절대 지어내지 마라.
   추측하거나 "~했을 것으로 보인다" 같은 서술도 금지한다.
2. 각 section의 evidence 배열에는 아래 [사용 가능한 근거] 목록에 있는
   문자열만, 원문 그대로 넣는다. 요약·변형·괄호 추가를 하지 마라.
   목록에 없는 문자열을 넣으면 해당 섹션 전체가 폐기된다.
3. evidence에는 과목명·자격증명·경험명·수상명 같은 "항목명"만 넣는다.
   경험의 세부 내용(사용 기술·도구 등)은 body에서 서술하되, 그 세부 항목을
   evidence 배열에 낱개로 넣지 마라 — evidence는 어떤 항목을 근거로 삼는지만
   표시하는 용도다.
4. body에서 경험의 세부 내용(사용 기술·도구 등)을 서술할 때는 입력 데이터에
   실제로 적혀 있는 내용만 쓴다. 입력에 없는 기술·도구·경험을 새로 추가하지 마라.
5. 입력 데이터의 기술명·도구명에 오타나 비표준 표기가 섞여 있어도 body에서는
   널리 쓰이는 표준 표기로 교정해서 쓴다(예: Spring Boot, FastAPI, MySQL,
   Cross Platform). evidence 배열은 원문을 그대로 유지한다(규칙 2).
6. 한 문장에 기술명·도구명을 5개 이상 나열하지 마라. 관련 있는 것끼리 묶어
   문장으로 풀어 쓰고, 단순 목록 나열은 피한다.
7. GPA·학점 등 수치는 입력값을 그대로 인용하고 재계산하지 마라.
8. 근거가 부족한 섹션은 억지로 만들지 말고 생략하라. 섹션 수가 적은 것이
   내용 없는 섹션이 있는 것보다 낫다.
9. body는 이미 보유한 것만 서술한다. 부족한 점, 보완 필요사항, 앞으로의
   계획·과제를 절대 언급하지 마라.
10. "~할 필요가 있다", "~하기 어렵다", "다만", "향후에는", "~해야 한다" 같은
    유보·과제 제시형 표현을 body에 쓰지 마라.
11. 근거만으로 긍정적으로 서술할 내용이 없는 영역은 section을 만들지 말고
    생략하라. 2문장짜리 빈 section이 있는 것보다 section 3개가 낫다.
12. ${NO_RAW_FIELD_NAMES}

[생성 지침]
- section은 2~5개. 역량 영역별로 묶는다
  (예: 전공 역량 / 실무 경험 / 기술 스택 / 자격 및 어학).
- body는 각 150~400자. 사실 나열이 아니라 목표 직무와의 연결점을 서술한다.
- summary는 3~4문장. 이어붙인 섹션의 내용만 요약한다.
- 이수 학점 총량이 적을 경우(예: 한 학기치 수준) 이를 강점처럼 언급하지 말고
  GPA와 과목 내용 중심으로 서술한다.
- 존댓말이 아닌 담백한 문어체로 작성한다.`;

function buildSystem() {
  return SYSTEM_PROMPT;
}

// evidenceFacts: validator.collectEvidenceFacts(context) 결과(원본 문자열 배열).
// [사용 가능한 근거] 화이트리스트를 맨 앞에 명시적으로 보여준다 — Phase 2 리뷰에서
// 지적된 evidence 할루시네이션 방지의 핵심 장치. JSON 스키마의 enum(아래
// buildOutputSchema)이 구조적으로도 강제하지만, 프롬프트에도 눈에 띄게 보여줘야
// 모델이 그 안에서 고른다.
function buildUser(context, evidenceFacts) {
  const factsBlock = (evidenceFacts || []).map(f => `- ${f}`).join('\n') || '(근거 없음)';
  const contextBlock = JSON.stringify(context, (key, value) => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value;
  });

  return `[사용 가능한 근거]\n${factsBlock}\n\n[입력 데이터]\n${contextBlock}`;
}

// OpenAI Structured Outputs(response_format: json_schema, strict:true)용 스키마.
// evidence를 evidenceFacts로 enum 제한 — 모델이 화이트리스트 밖 문자열을 아예
// 생성하지 못하게 구조적으로 막는다(strict 모드는 모든 필드가 required이고
// additionalProperties:false여야 함). evidenceFacts는 readinessService의
// 게이트를 통과한 뒤에만 호출되므로 비어있지 않다고 가정한다.
function buildOutputSchema(evidenceFacts) {
  return {
    name: 'career_portfolio',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              body: { type: 'string' },
              evidence: { type: 'array', items: { type: 'string', enum: evidenceFacts } },
            },
            required: ['heading', 'body', 'evidence'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'sections'],
      additionalProperties: false,
    },
  };
}

module.exports = { VERSION, buildSystem, buildUser, buildOutputSchema };
