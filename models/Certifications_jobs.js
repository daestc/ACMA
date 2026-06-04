const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * [certifications] 컬렉션
 * 자격증 정보 DB (관리자가 등록하는 마스터 데이터)
 */
const certificationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // 자격증 이름 (예: 정보처리기사)
    jmcd : { type: String, default: "" }, // 자격증 고유 코드 (외부 API 연동용)
    field1: { type: String, required: true }, // 대분야 (예: 정보통신)
    field2: { type: String, default: "" },   // 중분야 (예: 정보기술)
    
    seriesName: { type: String, default: "" }, // 자격증 시리즈명 (기사, 산업기사  등)
    description: { type: String, default: "" }, // 자격증 설명
    careerPath: { type: String, default: "" }, // 진로및 전망
    
    way: { type: String, default: "" },        // 취득 방법 (시험 과목 등)
    officialUrl: { type: String, default: "" }, // 공식 홈페이지 URL
    
    relatedJobs: [{ type: String }], // 관련 직무명 (예: "웹 개발자", "시스템 관리자" 등)

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
// 1. 카테고리 계층형 조회를 위한 인덱스 (강력 추천)
certificationSchema.index({ field1: 1, field2: 1 });

/**
 * [user_certifications] 컬렉션
 * 사용자가 취득했거나 목표로 하는 자격증
 */
const userCertificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    certificationId: { type: Schema.Types.ObjectId, ref: 'Certification', required: true },

    // 상태 구분: 'acquired'(취득), 'target'(목표)
    status: { 
      type: String, 
      enum: ['acquired', 'target'], 
      required: true,
      default: 'target'
    },

    // 1. 날짜 필드 통합 고려 혹은 명확한 관리
    // 취득일 또는 시험 예정일
    date: { type: Date, default: null }, 
    
    // 2. 진행률: 'target' 상태일 때만 의미가 있지만, 
    // 나중에 UI에서 게이지 차트로 보여주기 딱 좋습니다.
    progress: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 0 
    },

    // 3. 점수/등급: EJS 렌더링 편의를 위해 빈 문자열 기본값 추천
    score: { type: String, default: "" }, 
    memo: { type: String, default: "" },

    // 4. 노출 여부 (선택 사항)
    // 포트폴리오 공개 시 특정 자격증만 노출하고 싶을 때 유용합니다.
    isVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);
// 복합 인덱스: 특정 유저의 '취득 자격증'만 뽑아올 때 매우 빠릅니다.
userCertificationSchema.index({ userId: 1, status: 1 });

/**
 * [pass_rates] 컬렉션
 * 자격증별 연도/회차별 합격률 통계
 */
const passRateSchema = new Schema(
  {
    // 1. 자격증 마스터 DB와의 연결 (1:N 관계의 '1' 쪽 참조)
    certificationId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Certification', 
      required: true,
      index: true // 조인이 잦으므로 인덱스 필수
    },

    // 2. 시험 구분 (필기/실기)
    examType: { 
      type: String, 
      enum: ['written', 'practical'], 
      required: true 
    },

    // 3. 시행 정보
    year: { type: Number, required: true },    // 시행년도 (예: 2025)
    session: { type: String, required: true }, // 시행회차 (예: "1회", "정기기사 2회")

    // 4. 통계 데이터 (계산을 위해 Number 타입 권장)
    applicantCount: { type: Number, default: 0 }, // 응시자 수
    passerCount: { type: Number, default: 0 },    // 합격자 수
    passRate: { type: Number, min: 0, max: 100, default: 0 }, // 합격률 (%)

    // 5. 비고 (특이사항 등)
    note: { type: String, default: "" }
  },
  { timestamps: true }
);

// 최신 합격률부터 보여주기 위한 복합 인덱스
passRateSchema.index({ certificationId: 1, year: -1, examType: 1 });

/**
 * [exam_schedules] 컬렉션
 * 외부 API에서 가져온 오피셜 시험 일정
 */
const examScheduleSchema = new Schema(
  {
    certificationId: { type: Schema.Types.ObjectId, ref: 'Certification', required: true },
    
    examYear: { type: Number, required: true },    // 시행 년도
    session: { type: String, required: true },     // 회차 (예: "2025년 정기 기사 1회")
    
    // 필기 일정
    writtenExam: {
      regStartDate: { type: Date }, // 접수 시작일
      regEndDate: { type: Date },   // 접수 마감일
      startExamDate: { type: Date },     // 시험일
      ednExamDate: { type: Date },       // 시험 종료일 (필요 시)
      resultDate: { type: Date }    // 합격자 발표일
    },
    // 실기 일정
    practicalExam: {
      regStartDate: { type: Date },
      regEndDate: { type: Date },
      startExamDate: { type: Date },
      endExamDate: { type: Date },
      resultDate: { type: Date }
    },

    lastUpdated: { type: Date, default: Date.now } // API 동기화 시점
  },
  { timestamps: true }
);

// 특정 자격증의 최신 일정을 찾기 위한 인덱스
examScheduleSchema.index({ certificationId: 1, examYear: -1 });

// 직무 검색용 카테고리 정보 스키마
const jobSearchSchema = new Schema(
  {
    // 1. 외부 API의 고유 ID는 유일해야 하므로 unique 설정
    categoryId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    
    // 2. 계층별 이름 (검색 속도를 위해 각각 인덱스 추가)
    depth1_name: { type: String, index: true }, // 대분류
    depth2_name: { type: String, index: true }, // 중분류
    depth3_name: { type: String, index: true }, // 소분류
    
    // 3. 전체 경로 (예: "정보통신 > 소프트웨어 > 웹 개발")
    // 전문 검색(Full-text search)이나 빵부스러기(Breadcrumb) 노출용
    categoryName: { type: String, required: true, trim: true },
    
    // 4. 검색 편의를 위한 키워드 필드 (선택 사항)
    // 사용자가 "백엔드"라고 쳤을 때 "웹 개발"이 나오게 하고 싶을 때 유용함
    searchKeywords: [String], 
  },
  { timestamps: true }
);
// 5. 계층형 조회를 위한 복합 인덱스 (Compound Index)
// "대분류 선택 -> 중분류 조회" 속도를 비약적으로 높여줍니다.
jobSearchSchema.index({ depth1_name: 1, depth2_name: 1 });
jobSearchSchema.index({ depth2_name: 1, depth3_name: 1 });

/**
 * [jobs] 컬렉션
 * 선택한 직무 정보 DB (마스터 데이터 + 외부 API 캐시)
 */
const jobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true }, // 검색을 위해 인덱스 추가
    description: { type: String, default: "" },

    // 배열 필드 최적화 (null 대신 빈 배열 [] 추천)
    responsibilities: [String], // 주요 업무
    waysToAcquire: [String],    // 역량 습득 방법
    
    // 직무 역량 (MyStatus 화면의 그래프 데이터와 연동하기 좋음)
    abilities: [String],  // 업무 수행 능력
    knowledge: [String],  // 업무 관련 지식
    characteristics: [String], // 업무 관련 성격

    relatedOccupations: [String],
    relatedDepartments: [String],

    // 자격증 참조
    relatedCertifications: [{ type: Schema.Types.ObjectId, ref: 'Certification' }],

    // 연봉 정보 (하위 25%, 중간값, 상위 25%로 구분)
    averageSalary: {
      lower25: { type: Number, default: 0 }, 
      median50: { type: Number, default: 0 },
      upper25: { type: Number, default: 0 },
    },

    lastSyncedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

jobSchema.index({ title: 'text', category: 1 });


module.exports = {
  Certification: mongoose.model('Certification', certificationSchema),
  UserCertification: mongoose.model('UserCertification', userCertificationSchema),
  Job: mongoose.model('Job', jobSchema),
  PassRate: mongoose.model('PassRate', passRateSchema),
  ExamSchedule: mongoose.model('ExamSchedule', examScheduleSchema),
  JobSearch: mongoose.model('JobSearch', jobSearchSchema)
};
