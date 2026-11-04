const mongoose = require('mongoose');

const graduationRequirementsSchema = new mongoose.Schema({
  requiredTotalCredits: { type: Number, default: 130 },
  requiredMajorCredits: { type: Number, default: 42 },
  requiredMajorElective: { type: Number, default: 40 },
  requiredGeneralCredits: { type: Number, default: 20 },
  requiredGeneralElective: { type: Number, default: 28 },
  requiresGraduationWork: { type: Boolean, default: true },
  requiredCertifications: { type: [String], default: [] },
  requiredLanguageScore: { type: String, default: null },
  requiredInternship: { type: Boolean, default: null },
  requiredCapstonDesign: { type: Boolean, default: null },
  requiredNCProgram: { type: Boolean, default: null },
  requiredVolunteer: { type: Number, default: null },
  // 복수전공자 학점. 둘 다 있어야 복수전공 계산을 한다(하나라도 비면 단일전공 기준).
  doubleMajorPrimaryCredits: { type: Number, default: null }, // 복수전공자의 주전공 이수 학점(전필+전선)
  doubleMajorCredits: { type: Number, default: null },        // 복수전공 이수 학점
}, { _id: false });

const additionalRequirementsSchema = new mongoose.Schema({
  requiresGraduationWork: { type: Boolean, default: null },
  requiredCapstonDesign: { type: Boolean, default: null },
  requiredCertifications: { type: [String], default: [] },
  requiredLanguageScore: { type: String, default: null },
  requiredInternship: { type: Boolean, default: null },
  requiredNCProgram: { type: Boolean, default: null },
  requiredVolunteer: { type: Number, default: null },
}, { _id: false });

const majorRequirementSchema = new mongoose.Schema({
  major: { type: String, required: true, trim: true },
  additionalRequirements: { type: additionalRequirementsSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: true });

// 입학년도별 덮어쓰기: 학교 기본값 위에 "이 입학년도부터" 달라지는 학점 항목만 얹는다.
// 지정하지 않은 항목은 학교 기본값을 쓰므로 default를 두지 않는다(default가 있으면 "지정 안 함"과 구분되지 않음).
const cohortOverrideSchema = new mongoose.Schema({
  requiredTotalCredits: { type: Number },
  requiredMajorCredits: { type: Number },
  requiredMajorElective: { type: Number },
  requiredGeneralCredits: { type: Number },
  requiredGeneralElective: { type: Number },
  doubleMajorPrimaryCredits: { type: Number },
  doubleMajorCredits: { type: Number },
}, { _id: false });

const cohortRequirementSchema = new mongoose.Schema({
  fromYear: { type: Number, required: true, min: 1990, max: 2100 },
  requirements: { type: cohortOverrideSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: true });

const universityGraduationSchema = new mongoose.Schema({
  university: { type: String, required: true, unique: true, trim: true },
  requirements: { type: graduationRequirementsSchema, default: () => ({}) },
  majorRequirements: { type: [majorRequirementSchema], default: [] },
  cohortRequirements: { type: [cohortRequirementSchema], default: [] },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

universityGraduationSchema.index({ university: 1, 'majorRequirements.major': 1 });

module.exports = mongoose.model('UniversityGraduation', universityGraduationSchema);
