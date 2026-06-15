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
}, { _id: false });

const universityGraduationSchema = new mongoose.Schema({
  university: { type: String, required: true, unique: true, trim: true },
  requirements: { type: graduationRequirementsSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('UniversityGraduation', universityGraduationSchema);
