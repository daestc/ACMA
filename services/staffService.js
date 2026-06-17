const UniversitySchedule = require('../models/UniversitySchedule');
const UniversityGraduation = require('../models/UniversityGraduation');
const User = require('../models/User');
const { Lecture } = require('../models/Calendar');
const {
  getMajorList,
  getMajorAdditionalRequirements,
  saveMajorAdditionalRequirements,
} = require('./graduationService');
const { buildStaffUniversityFilter } = require('./lectureAdminService');

function requireUniversity(university) {
  const value = university?.trim();
  if (!value) {
    const err = new Error('소속 대학 정보가 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }
  return value;
}

const SCHEDULE_PAGE_SIZE = 5;

async function getSchedules(university, { page = 1, limit = SCHEDULE_PAGE_SIZE } = {}) {
  const univ = requireUniversity(university);
  const filter = { university: univ };

  const total = await UniversitySchedule.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const skip = (safePage - 1) * limit;

  const schedules = await UniversitySchedule.find(filter)
    .sort({ startDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    schedules,
    total,
    page: safePage,
    totalPages,
    limit,
  };
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

function formatScheduleRange(startDate, endDate) {
  const start = new Date(startDate);
  const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
  const startLabel = start.toLocaleDateString('ko-KR', dateOpts);
  if (!endDate) return startLabel;

  const end = new Date(endDate);
  if (start.toDateString() === end.toDateString()) return startLabel;
  return `${startLabel} ~ ${end.toLocaleDateString('ko-KR', dateOpts)}`;
}

function getDDayLabel(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `종료`;
}

function mapScheduleItem(schedule) {
  const targetDate = schedule.endDate || schedule.startDate;
  return {
    _id: schedule._id,
    title: schedule.title,
    description: schedule.description,
    dateLabel: formatScheduleRange(schedule.startDate, schedule.endDate),
    dDayLabel: getDDayLabel(targetDate),
    isUpcoming: new Date(targetDate) >= new Date(new Date().setHours(0, 0, 0, 0)),
  };
}

function buildActiveScheduleFilter(univ, today) {
  return {
    university: univ,
    $or: [
      { endDate: { $gte: today } },
      { endDate: null, startDate: { $gte: today } },
      { startDate: { $lte: today }, endDate: { $gte: today } },
    ],
  };
}

// 대학관계자 대시보드 조회(로그인한 대학관계자의 대학 정보를 기반으로 조회)
async function getStaffDashboard(university) {
  const univ = requireUniversity(university);// DB에서 대학 정보 가져오기
  const lectureFilter = buildStaffUniversityFilter(univ);// 강의 필터 생성
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lectureCount = lectureFilter
    ? await Lecture.countDocuments(lectureFilter)
    : 0;

  const scheduleCount = await UniversitySchedule.countDocuments({ university: univ });

  const studentCount = await User.countDocuments({ university: univ, role: 'student' });

  const graduationDoc = await UniversityGraduation.findOne({ university: univ }).lean();

  const recentRaw = await UniversitySchedule.find({ university: univ })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  const upcomingRaw = await UniversitySchedule.find(buildActiveScheduleFilter(univ, today))
    .sort({ startDate: 1 })
    .limit(6)
    .lean();

  return {
    stats: {
      lectureCount,
      scheduleCount,
      majorCount: graduationDoc?.majorRequirements?.length || 0,
      studentCount,
      hasSchoolGraduation: Boolean(graduationDoc?.requirements),
    },
    recentSchedules: recentRaw.map(mapScheduleItem),
    upcomingSchedules: upcomingRaw.map(mapScheduleItem),
  };
}

module.exports = {
  getSchedules,
  createSchedule,
  deleteSchedule,
  getGraduationRequirements,
  saveGraduationRequirements,
  getMajorList,
  getMajorAdditionalRequirements,
  saveMajorAdditionalRequirements,
  getStaffDashboard,
};
