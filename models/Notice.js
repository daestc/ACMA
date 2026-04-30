const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * [Notices] 컬렉션
 * 모든 외부/내부 공지 정보의 원천 데이터
 */

// /**
//  * 1. [Notice] 원천 데이터 컬렉션
//  * API와 크롤링으로 수집된 자격증, 장학금, 채용, 학사일정 정보
//  */
// const noticeSchema = new Schema({
//   category: { 
//     type: String, 
//     enum: ['certification', 'scholarship', 'academic', 'recruit',  'activity'], 
//     required: true 
//   },
//   source: { 
//     type: String, 
//     enum: ['q-net', 'kosaf', 'saramin', 'work24', 'jobkorea', 'crawling', 'admin'], 
//     required: true 
//   },
//   title: { type: String, required: true, trim: true },
//   organization: { type: String }, 
//   content: { type: String },
//   link: { type: String },

//   // 일정 규격화 (배너 D-Day 계산용)
//   startDate: { type: Date, default: null },   // 접수 시작일
//   endDate: { type: Date, default: null },     // 접수 마감일
//   eventDate: { type: Date, default: null },   // 시험일/학사일정 당일
//   announcementDate: { type: Date, default: null },

//   externalId: { type: String, unique: true, sparse: true }, // API 중복 방지
//   scrapCount: { type: Number, default: 0 },
//   viewCount: { type: Number, default: 0 },
//   isPublished: { type: Boolean, default: true }
// }, { timestamps: true });

// noticeSchema.index({ category: 1, endDate: 1 });
// const Notice = mongoose.model('Notice', noticeSchema);

const noticeSchema = new Schema(
  {
    // 1. 카테고리 및 출처
    category: {
      type: String,
      enum: ['certification', 'scholarship', 'academic', 'recruit',  'activity'], //자격증, 장학금, 학사일정, 채용, 공모전 
      required: true,
    },
    source: {
      type: String,
      enum: ['q-net', 'kosaf', 'saramin', 'work24', 'jobkorea', 'crawling', 'admin'],
      required: true,
    },

    // 2. 기본 정보
    title: { type: String, required: true, trim: true }, // 공고/시험 명칭
    organization: { type: String }, // 기업명, 학교명, 기관명 (company, instt_nm 등)
    content: { type: String },      // 상세 설명 (상세 API 호출 결과 저장)
    link: { type: String },         // 원문 URL (사람인 url, 워크넷 링크 등)

    // 3. 일정 관리 (모든 소스의 날짜를 이 필드로 규격화)
    startDate: { type: Date, default: null },      // 시작일 (opening-date, regDt 등)
    endDate: { type: Date, default: null },        // 마감일 (expiration-date, closeDt 등)
    eventDate: { type: Date, default: null },      // 실제 시험일, 학사일정 당일
    announcementDate: { type: Date, default: null }, // 합격자 발표일 (자격증용)

    // 4. API 연동 고유 식별자 (중복 수집 방지)
    externalId: { type: String, unique: true, sparse: true }, // id, wantedAuthNo 등

    // 5. 부가 정보 (채용/장학금 특화)
    salary: { type: String },       // 급여 정보 (채용용)
    location: { type: String },     // 근무지/지역 (채용용 - loc_cd, region)
    requirements: {                 // 자격 요건 (학력, 경력 등)
      education: { type: String },
      career: { type: String },
    },

    // 6. 상태 및 통계
    isPublished: { type: Boolean, default: true }, // 노출 여부
    viewCount: { type: Number, default: 0 },       // 조회수
    scrapCount: { type: Number, default: 0 },     // 스크랩수 (인기 공고 판별)
  },
  { timestamps: true }
);

// 조회 성능 최적화
noticeSchema.index({ category: 1, endDate: 1 }); // 마감 임박순 조회용
noticeSchema.index({ scrapCount: -1 });         // 인기 공고 조회용

module.exports = mongoose.model('Notice', noticeSchema);