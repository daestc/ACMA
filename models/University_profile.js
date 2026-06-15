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
    enum: ['enrolled', 'leave', 'dropout', 'graduated'],
    default: 'enrolled',          // 재학 | 휴학 | 자퇴 | 졸업
  },
  
  major: { type: String, required: true, trim: true }, // 전공
  doubleMajor: { type: String, default: null }, // 복수전공

  // ── 졸업 요건 (사용자 직접 입력)
  GraduationRequirements: {
    requiredTotalCredits:    { type: Number, default: 130 }, // 필요학점
    requiredMajorCredits:    { type: Number, default: 42  }, // 전공필수
    requiredMajorElective:   { type: Number, default: 40  }, // 전공선택
    requiredGeneralCredits:  { type: Number, default: 20  }, // 교양필수
    requiredGeneralElective: { type: Number, default: 28  }, // 교양선택
    requiresGraduationWork:  { type: Boolean, default: true }, // 졸업작품
    requiredCertifications:  { type: [String], default: [] },    // 필수 자격증
    requiredLanguageScore:   { type: String, default: null },    // 어학성적
    requiredInternship: {type: Boolean, default: null }, // 인턴쉽 의무 이수
    requiredCapstonDesign: {type: Boolean, default: null }, // 캡스톤 디자인
    requiredNCProgram: {type: Boolean, default: null }, // 비교과 프로그램
    requiredVolunteer: {type: Number, default: null }, // 사회봉사 시간
  }

}, {
  timestamps: true
});

// 학사 정보 모델 내보내기
module.exports = mongoose.model('UniversityProfile', UniversityProfileSchema);