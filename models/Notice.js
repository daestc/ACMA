const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    // 1. 카테고리 및 출처
    category: {
      type: String,
      enum: ['certification', 'scholarship', 'academic', 'recruit', 'activity'],
      required: true,
    },
    source: {
      type: String,
      enum: ['q-net', 'crawling', 'crawling', 'crawling', 'crawling', 'crawling', 'crawling'],
      required: true,
    },

    // 2. 기본 정보
    title: { type: String, required: true, trim: true },
    organization: { type: String }, // 기관/기업명
    content: { type: String },      // 상세 내용
    link: { type: String },         // 원문 링크

    // 3. 일정 관리 (D-Day 계산의 핵심)
    startDate: { type: Date, default: null },   // 접수 시작
    endDate: { type: Date, default: null },     // 접수 마감 (이걸로 D-Day 계산)
    eventDate: { type: Date, default: null },   // 시험/행사 당일
    announcementDate: { type: Date, default: null }, // 발표일

    // 4. 중복 방지 고유 ID
    externalId: { type: String, unique: true, sparse: true },

    // 5. 카테고리별 특화 정보 (자격증, 채용 등 유동적 데이터)
    details: {
      // 자격증용
      round: { type: String },      // 시험 회차 (예: 2026년 정기 1회)
      examType: { type: String },   // 필기/실기 구분
      
      // 채용/인턴용
      salary: { type: String },     // 급여
      location: { type: String },   // 지역
      education: { type: String },  // 학력 요구사항
      career: { type: String },     // 경력 요구사항
      
      // 장학금/공모전용
      benefit: { type: String },    // 혜택/상금
      target: { type: String }      // 대상자
    },

    // 6. 상태 및 통계
    isPublished: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
    scrapCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 조회 성능 최적화
noticeSchema.index({ category: 1, endDate: 1 }); 
noticeSchema.index({ scrapCount: -1 });

module.exports = mongoose.model('Notice', noticeSchema);