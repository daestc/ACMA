const mongoose = require('mongoose');
const { Schema } = mongoose;

// 지식·능력·성격: "전산(99)/창의력(98)" → [{ name:'전산', importance:99 }, ...]
// (parseSlashList와 달리 괄호 안 중요도 숫자를 버리지 않고 살린다 — 적합도 가중치용)
const weightedItemSchema = new Schema(
  {
    name: { type: String, required: true },
    importance: { type: Number, default: null },
  },
  { _id: false },
);

/**
 * [job_catalogs] 컬렉션
 * AI 진로 추천의 점수 계산용 공용 직무 카탈로그 (seedJobCatalog.js 배치로 적재).
 * 사용자별 저장 목록인 Job과 달리 userId가 없는 공용 마스터 데이터다.
 */
const jobCatalogSchema = new Schema(
  {
    jobCode: { type: String, required: true, unique: true, index: true },
    jobSeq: { type: String, default: '1' },
    title: { type: String, required: true, trim: true, index: true },

    categoryId: { type: String, default: '' },
    depth1_name: { type: String, default: '' },
    depth2_name: { type: String, default: '', index: true },
    depth3_name: { type: String, default: '' },
    depth4_name: { type: String, default: '' },

    summary: { type: String, default: '' },
    responsibilities: [String],

    knowledge: [weightedItemSchema],
    abilities: [weightedItemSchema],
    characteristics: [weightedItemSchema],

    averageSalary: {
      lower25: { type: Number, default: 0 },
      median50: { type: Number, default: 0 },
      upper25: { type: Number, default: 0 },
    },

    relatedDepartments: [String],
    relatedCertifications: [String], // 원문 그대로 (화면 표시용)
    certNames: [String], // relatedCertifications.flatMap(expandCert).map(norm), 인덱스

    searchText: { type: String, default: '' }, // norm(title + summary + responsibilities), 기술 매칭용

    lastSyncedAt: { type: Date, default: null },
    syncError: { type: String, default: '' },
  },
  { timestamps: true },
);

jobCatalogSchema.index({ certNames: 1 });

module.exports = {
  JobCatalog: mongoose.model('JobCatalog', jobCatalogSchema),
};
