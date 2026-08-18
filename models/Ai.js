const mongoose = require('mongoose');
const { Schema } = mongoose;

// 생성 메타 — 여러 스키마가 공유
const generationMetaSchema = new Schema({
  model: { type: String, default: null },
  promptVersion: { type: String, default: null },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  costType: { type: String, enum: ['free', 'premium', 'point'], default: 'free' },
  pointsUsed: { type: Number, default: 0 },
}, { _id: false });

// 미입력 데이터 항목 — 서버가 결정적으로 계산(LLM 아님). CareerPortfolio/CareerDiagnosis 공유.
const missingItemSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  reason: { type: String, default: null },
  impact: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  link: { type: String, default: null },
}, { _id: false });

// 아래 세 스키마는 _id가 필요 없는 서브도큐먼트다. 주의: `field: [{...}, { _id:false }]`
// 처럼 배열 리터럴 두 번째 자리에 옵션을 넣는 건 mongoose가 무시한다(실제로 확인함 —
// _id가 계속 생성됨). _id:false를 적용하려면 반드시 명시적 Schema 인스턴스로 만들어야 한다.
const evidenceSectionSchema = new Schema({
  heading: { type: String, required: true },
  body: { type: String, required: true },
  evidence: { type: [String], default: [] },
}, { _id: false });

const strengthSchema = new Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  evidence: { type: [String], default: [] },
}, { _id: false });

const scoreBreakdownSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  score: { type: Number, default: 0 },  // 영역 내 0~100
  weight: { type: Number, default: 0 }, // 총점 기여 배점
  detail: { type: String, default: null },
}, { _id: false });

// ── AI 생성 진로 포트폴리오 (채용담당자용 — 강점만, 부족한 점은 CareerDiagnosis로 분리)
const careerPortfolioSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending', index: true },
  errorMessage: { type: String, default: null },

  jobCode: { type: String, default: null },
  jobTitle: { type: String, default: null },

  summary: { type: String, default: null },
  sections: [evidenceSectionSchema],

  readinessScore: { type: Number, default: null }, // 생성 시점 준비도 점수(0~100)
  missing: [missingItemSchema],

  generation: { type: generationMetaSchema, default: () => ({}) },
}, { timestamps: true });

careerPortfolioSchema.index({ userId: 1, createdAt: -1 });

// ── AI 생성 진로 진단 (본인용 — 강점 + 약점 + 영역별 점수 + 다음 행동 연결)
const careerDiagnosisSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending', index: true },
  errorMessage: { type: String, default: null },

  jobCode: { type: String, default: null },
  jobTitle: { type: String, default: null },

  // 영역별 점수 (LLM 없음, readinessService 계산값)
  scores: {
    total: { type: Number, default: 0 },
    breakdown: [scoreBreakdownSchema],
  },

  // LLM 생성: 현재 상태 요약 (강점 + 약점 모두 서술 가능)
  overview: { type: String, default: null },
  strengths: [strengthSchema],

  // LLM 생성: 목표 직무 대비 갭 + 서버가 붙인 행동 연결
  gaps: [{
    item: { type: String, required: true },
    reason: { type: String, default: null },
    severity: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    actionType: {
      type: String,
      enum: ['cert', 'project', 'course', 'language', 'experience', 'none'],
      default: 'none',
    },
    relatedCertJmcd: { type: String, default: null },
    relatedCertName: { type: String, default: null },
    nextExamDate: { type: Date, default: null },
    dDay: { type: Number, default: null },
    // nextExamDate 하나만으로는 "원서접수 마감"과 "시험일"을 구분할 수 없어
    // D-day의 의미가 불명확하다(원서접수는 놓치면 회복 불가라 더 급함) — Notice에서
    // 같이 가져온다.
    examType: { type: String, default: null }, // '필기' | '실기' 등 (Notice.details.examType)
    isApplication: { type: Boolean, default: false }, // true=원서접수 마감, false=시험일 등
  }], // _id 유지 — /gaps/:gapId/to-plan 참조용

  // LLM 무관, graduationAdvisor.summarizeGraduation 계산값(suggestedFields만 LLM 생성).
  // "직무 갭" 축과 별개인 "시간 제약" 축 — 졸업까지 학점이 얼마나 남았고 어느
  // 방향으로 채울지.
  graduation: {
    hasData: { type: Boolean, default: false },
    remaining: {
      total: { type: Number, default: null },
      majorRequired: { type: Number, default: null },
      majorElective: { type: Number, default: null },
      generalRequired: { type: Number, default: null },
      generalElective: { type: Number, default: null },
    },
    pendingRequirements: { type: [String], default: [] },
    estimatedSemesters: { type: Number, default: null },
    horizon: { type: String, enum: ['semester', 'total'], default: 'semester' },
    // creditType(어느 학점 유형에 속하는지)은 일부러 안 둔다 — 학교마다 커리큘럼이
    // 달라 같은 "정보보호" 분야도 학교에 따라 전공선택/교양선택/개설 안 함이 갈리는데,
    // LLM은 그 학교 커리큘럼을 모르니 추측으로 채울 수밖에 없다("LLM에게 모르는 걸
    // 묻지 않는다" 원칙 위반 — 실제로 두 제안이 전부 majorRequired로 잘못 태깅된 적
    // 있음). 학점 수치는 graduation.remaining에 이미 있으니 화면에서 그쪽과 나란히
    // 보여주면 되고, 분야별 유형 구분은 사용자가 수강편람에서 직접 확인한다.
    suggestedFields: [{
      field: { type: String, required: true },       // "분야명"만 — 과목명 금지(validator에서 필터)
      reason: { type: String, default: null },
      _id: false,
    }],
    _id: false,
  },

  missing: [missingItemSchema],
  generation: { type: generationMetaSchema, default: () => ({}) },
}, { timestamps: true });

careerDiagnosisSchema.index({ userId: 1, createdAt: -1 });

// ── AI 생성 주간 계획
const weeklyPlanSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending', index: true },
  errorMessage: { type: String, default: null },

  // 포트폴리오·진단과 달리 생성 시점 목표 직무 스냅샷이 없었다 — 나중에 "이 계획이
  // 어느 직무 기준이었나"를 알 수 없고, 목표 직무 변경 후 옛 gap이 섞여 들어가는지
  // 대조할 방법도 없었다. planService.generateWeeklyPlan에서 채운다.
  jobCode: { type: String, default: null },
  jobTitle: { type: String, default: null },

  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },

  goal: { type: String, default: null },
  items: [{
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['cert', 'course', 'skill', 'project', 'language', 'graduation', 'other'],
      default: 'other',
    },
    estimatedHours: { type: Number, default: 0, min: 0 },
    priority: { type: Number, default: 3, min: 1, max: 5 },
    relatedType: { type: String, default: null },
    relatedId: { type: Schema.Types.ObjectId, default: null },
    isDeadline: { type: Boolean, default: false },
    reason: { type: String, default: null },
    dueDate: { type: Date, default: null }, // 마감 항목의 실제 마감일 (서버가 채움, LLM 아님)
  }],

  computed: {
    availableHoursByDay: { type: [Number], default: [] },
    availableHoursTotal: { type: Number, default: 0 },
    allocatedHours: { type: Number, default: 0 },
    academicPhase: { type: String, default: null },
    semester: { type: String, default: null },
    // false면 이 주에 해당하는 Timetable을 못 찾아 availableHoursByDay가 기본값
    // (하루 6시간 균일)으로 대체됐다는 뜻 — 방학처럼 정말 시간표가 없는 것과 학생이
    // 아직 등록을 안 한 것을 구분 못 하므로, false일 때 distribution.errors에
    // 안내를 남긴다(services/ai/planService.js).
    hasTimetable: { type: Boolean, default: true },
  },

  prevCompletionRate: { type: Number, default: null },
  generation: { type: generationMetaSchema, default: () => ({}) },

  distribution: {
    status: { type: String, enum: ['none', 'done', 'failed'], default: 'none' },
    distributedAt: { type: Date, default: null },
    dayCount: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    // errors: 실제로 시간/항목이 배치 안 되고 버려진 경우(사용자 조치 필요할 수 있음).
    // notices: 정보성 안내(시간표 데이터 없음, 마감 매칭 실패로 isDeadline 해제 등) —
    // 뭔가 실패한 게 아니라 참고 사항. 화면에서 성격이 다르게 뜨도록 분리한다.
    errors: { type: [String], default: [] },
    notices: { type: [String], default: [] },
  },
}, { timestamps: true });

weeklyPlanSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = {
  CareerPortfolio: mongoose.model('CareerPortfolio', careerPortfolioSchema),
  CareerDiagnosis: mongoose.model('CareerDiagnosis', careerDiagnosisSchema),
  WeeklyPlan: mongoose.model('WeeklyPlan', weeklyPlanSchema),
};
