const VERSION = 'weeklyPlan.v3';

const SYSTEM_PROMPT = `당신은 한국 대학생의 진로·학업 주간 계획을 설계한다.

[출력 형식]
- 설명, 인사말, 마크다운 코드펜스 없이 JSON 객체 하나만 출력한다.
- 최상위 키는 정확히 goal, items 두 개만 사용한다. weekPlan 같은 다른 이름으로
  감싸지 마라.

[절대 규칙]
1. 날짜 계산을 직접 하지 마라. 입력에 주어진 dDay, availableHours 값을
   그대로 사용한다.
2. items의 estimatedHours 총합은 입력의 availableHoursTotal을 초과할 수 없다.
3. isApplication이 true인 자격증 일정(원서접수 등)이 D-14 이내에 있으면,
   해당 항목을 priority 1, isDeadline true로 반드시 포함한다.
   놓치면 회복 불가능한 마감이다.
4. academicPhase가 'midterm' 또는 'final'이면 자격증·프로젝트 항목은
   총 시간의 availableHoursTotal의 50% 이내로 제한하고, 나머지는
   currentSubjects 학습에 배분한다.
5. 입력 데이터에 없는 자격증, 과목, 경력을 지어내지 마라.
6. items는 3~7개로 한다.
7. prevCompletionRate가 주어진 경우:
   - 0.5 미만이면 이번 주 총 배정 시간을 availableHoursTotal의 70% 이내로 줄인다.
   - 0.9 이상이면 지난주와 비슷하거나 약간 늘린다.
   - incompleteItems에 있는 항목을 이번 주에 우선 배치한다. 단, 입력 데이터
     기준으로 이미 해소된 항목(예: 그 사이 취득한 자격증, 종료된 과목 관련
     항목)은 반영하지 마라 — incompleteItems는 지난주 기록일 뿐 현재 상태가
     아니다.
8. specs.certifications에 이미 있는(취득한) 자격증은 학습·준비 항목으로 만들지
   마라. 자격증 관련 항목(category:'cert')은 아직 취득하지 않은 자격증만 다룬다.
9. 하나의 학습 대상(과목·자격증 등)에 대해 여러 items로 쪼개지 마라. 각 items는
   서로 다른 대상을 다뤄야 한다. title에 "(1/3)"처럼 분할·순번을 나타내는 표기를
   쓰지 마라 — 날짜별로 나누는 건 서버가 처리한다.
10. priority 1(최우선)은 최대 2개까지만 쓴다. 나머지는 2~5 사이에서 실제
    중요도에 따라 분산한다.`;

function buildSystem() {
  return SYSTEM_PROMPT;
}

function buildUser(context) {
  return JSON.stringify(context, (key, value) => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value;
  });
}

// OpenAI Structured Outputs(response_format: json_schema, strict:true)용 스키마.
// json_object 모드는 "유효한 JSON"만 강제하고 키 이름/중첩 구조는 강제하지 않아서,
// 모델이 goal/items를 엉뚱한 상위 키로 감싸 보내는 사고가 실제로 있었다(예:
// {"weekPlan":{"items":[...]}}). strict 스키마는 이 최상위 구조 자체를 강제한다.
const OUTPUT_JSON_SCHEMA = {
  name: 'weekly_plan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      goal: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: {
              type: 'string',
              enum: ['cert', 'course', 'skill', 'project', 'language', 'graduation', 'other'],
            },
            estimatedHours: { type: 'number' },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
            isDeadline: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['title', 'category', 'estimatedHours', 'priority', 'isDeadline', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['goal', 'items'],
    additionalProperties: false,
  },
};

module.exports = { VERSION, buildSystem, buildUser, OUTPUT_JSON_SCHEMA };
