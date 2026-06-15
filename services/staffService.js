const UniversitySchedule = require('../models/UniversitySchedule');
const UniversityGraduation = require('../models/UniversityGraduation');

function requireUniversity(university) {
  const value = university?.trim();
  if (!value) {
    const err = new Error('소속 대학 정보가 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }
  return value;
}

async function getSchedules(university) {
  const univ = requireUniversity(university);
  return UniversitySchedule.find({ university: univ })
    .sort({ startDate: -1 })
    .lean();
}

async function createSchedule({ university, title, startDate, endDate, description, createdBy }) {
  const univ = requireUniversity(university);
  if (!title?.trim()) {
    const err = new Error('일정 제목을 입력해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!startDate) {
    const err = new Error('시작일을 입력해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }

  return UniversitySchedule.create({
    university: univ,
    title: title.trim(),
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    description: description?.trim() || null,
    createdBy,
  });
}

async function deleteSchedule(id, university) {
  const univ = requireUniversity(university);
  const result = await UniversitySchedule.findOneAndDelete({ _id: id, university: univ });
  if (!result) {
    const err = new Error('일정을 찾을 수 없습니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return result;
}

async function getGraduationRequirements(university) {
  const univ = requireUniversity(university);
  return UniversityGraduation.findOne({ university: univ }).lean();
}

async function saveGraduationRequirements(university, requirements, updatedBy) {
  const univ = requireUniversity(university);
  return UniversityGraduation.findOneAndUpdate(
    { university: univ },
    { requirements, updatedBy },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
}

module.exports = {
  getSchedules,
  createSchedule,
  deleteSchedule,
  getGraduationRequirements,
  saveGraduationRequirements,
};
