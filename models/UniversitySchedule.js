const mongoose = require('mongoose');

const universityScheduleSchema = new mongoose.Schema({
  university: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  description: { type: String, default: null, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

universityScheduleSchema.index({ university: 1, startDate: -1 });

module.exports = mongoose.model('UniversitySchedule', universityScheduleSchema);
