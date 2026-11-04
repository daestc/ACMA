const mongoose = require("mongoose");
const { Schema } = mongoose;

// 학사 정보 스키마
const UniversityProfileSchema = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  studentId: { type: String, default: null }, // 학번

  grade: { type: Number, default: 1 },
  
  // 학적 정보
  enrollmentStatus:   {
    type: String,
    enum: ['재학', '휴학', '자퇴', '제적', '졸업', 'enrolled', 'leave', 'dropout', 'graduated'],
    default: '재학',
  },
  
  major: { type: String, required: true, trim: true }, // 전공
  doubleMajor: { type: String, default: null }, // 복수전공 (현재 입력 경로 없음, 졸업요건 계산 미지원)

  // 졸업요건은 대학관계자가 등록한 UniversityGraduation에서만 가져온다(services/graduationService.js).
  // 예전에는 여기에 학생별 졸업요건 기본값(130/42/…)이 자동 저장되어 학교 등록값을 덮어썼다.

}, {
  timestamps: true
});

// 학사 정보 모델 내보내기
module.exports = mongoose.model('UniversityProfile', UniversityProfileSchema);