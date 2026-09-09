const staffService = require('../services/staffService');
const logger = require('../config/logger');

const getHomePage = async (req, res, next) => {
  try {
    const dashboard = await staffService.getStaffDashboard(req.user.university);
    res.render('pages/staffHome', {
      user: req.user,
      pageTitle: '홈',
      currentPage: 'staffHome',
      dashboard,
    });
  } catch (err) {
    next(err);
  }
};

// 홈 대시보드 (JSON) — getHomePage와 동일한 조회, React StaffHome.jsx용.
const getHomeData = async (req, res, next) => {
  try {
    const dashboard = await staffService.getStaffDashboard(req.user.university);
    res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
};

const getSchedulePage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const { schedules, total, page: currentPageNum, totalPages } = await staffService.getSchedules(
      req.user.university,
      { page },
    );

    res.render('pages/staffSchedule', {
      user: req.user,
      pageTitle: '학교 일정 등록',
      schedules,
      totalSchedules: total,
      currentPageNum,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
};

// 일정 목록 (JSON, 페이지네이션 포함) — getSchedulePage와 동일한 조회, React StaffSchedule.jsx용.
const getScheduleData = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const { schedules, total, page: currentPageNum, totalPages } = await staffService.getSchedules(
      req.user.university,
      { page },
    );
    res.json({ ok: true, schedules, totalSchedules: total, currentPageNum, totalPages });
  } catch (err) {
    next(err);
  }
};

const postSchedule = async (req, res) => {
  try {
    const schedule = await staffService.createSchedule({
      university: req.user.university,
      title: req.body.title,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      description: req.body.description,
      createdBy: req.user.id,
    });
    logger.info(`학교 일정 등록 | ${schedule.title} | univ=${req.user.university} | by=${req.user.email}`);
    res.json({ ok: true, schedule });
  } catch (err) {
    if (err.code === 'VALIDATION' || err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    await staffService.deleteSchedule(req.params.id, req.user.university);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const getGraduationPage = async (req, res, next) => {
  try {
    const [graduation, majors] = await Promise.all([
      staffService.getGraduationRequirements(req.user.university),
      staffService.getMajorList(req.user.university),
    ]);
    res.render('pages/staffGraduation', {
      user: req.user,
      pageTitle: '졸업요건 설정',
      requirements: graduation?.requirements || null,
      majors,
    });
  } catch (err) {
    next(err);
  }
};

// 졸업요건 설정 페이지 데이터 (JSON) — getGraduationPage와 동일한 조회, React StaffGraduation.jsx용.
const getGraduationData = async (req, res, next) => {
  try {
    const [graduation, majors] = await Promise.all([
      staffService.getGraduationRequirements(req.user.university),
      staffService.getMajorList(req.user.university),
    ]);
    res.json({ ok: true, requirements: graduation?.requirements || null, majors });
  } catch (err) {
    next(err);
  }
};

function parseNum(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function parseBool(value) {
  if (value === '' || value == null) return null;
  return value === true || value === 'true';
}

const saveGraduation = async (req, res) => {
  try {
    const body = req.body || {};
    const requirements = {
      requiredTotalCredits: parseNum(body.requiredTotalCredits, 130),
      requiredMajorCredits: parseNum(body.requiredMajorCredits, 42),
      requiredMajorElective: parseNum(body.requiredMajorElective, 40),
      requiredGeneralCredits: parseNum(body.requiredGeneralCredits, 20),
      requiredGeneralElective: parseNum(body.requiredGeneralElective, 28),
      requiresGraduationWork: body.requiresGraduationWork === true || body.requiresGraduationWork === 'true',
      requiredCertifications: Array.isArray(body.requiredCertifications)
        ? body.requiredCertifications.filter(Boolean)
        : [],
      requiredLanguageScore: body.requiredLanguageScore?.trim() || null,
      requiredInternship: parseBool(body.requiredInternship),
      requiredCapstonDesign: parseBool(body.requiredCapstonDesign),
      requiredNCProgram: parseBool(body.requiredNCProgram),
      requiredVolunteer: body.requiredVolunteer === '' || body.requiredVolunteer == null
        ? null
        : parseNum(body.requiredVolunteer, null),
    };

    const graduation = await staffService.saveGraduationRequirements(
      req.user.university,
      requirements,
      req.user.id,
    );

    logger.info(`졸업요건 저장 | univ=${req.user.university} | by=${req.user.email}`);
    res.json({ ok: true, requirements: graduation.requirements });
  } catch (err) {
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

function parseAdditionalRequirements(body = {}) {
  const certs = Array.isArray(body.requiredCertifications)
    ? body.requiredCertifications.filter(Boolean)
    : String(body.requiredCertifications || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    requiresGraduationWork: parseBool(body.requiresGraduationWork),
    requiredCapstonDesign: parseBool(body.requiredCapstonDesign),
    requiredCertifications: certs,
    requiredLanguageScore: body.requiredLanguageScore?.trim() || null,
    requiredInternship: parseBool(body.requiredInternship),
    requiredNCProgram: parseBool(body.requiredNCProgram),
    requiredVolunteer: body.requiredVolunteer === '' || body.requiredVolunteer == null
      ? null
      : parseNum(body.requiredVolunteer, null),
  };
}

const getMajorList = async (req, res) => {
  try {
    const majors = await staffService.getMajorList(req.user.university);
    res.json({ ok: true, majors });
  } catch (err) {
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const getMajorGraduation = async (req, res) => {
  try {
    const major = decodeURIComponent(req.params.major || '');
    const additionalRequirements = await staffService.getMajorAdditionalRequirements(
      req.user.university,
      major,
    );
    res.json({ ok: true, major, additionalRequirements });
  } catch (err) {
    if (err.code === 'VALIDATION' || err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const saveMajorGraduation = async (req, res) => {
  try {
    const major = req.body?.major?.trim();
    if (!major) {
      return res.status(400).json({ ok: false, message: '학과를 선택해주세요.' });
    }

    const additionalRequirements = parseAdditionalRequirements(req.body);
    const saved = await staffService.saveMajorAdditionalRequirements(
      req.user.university,
      major,
      additionalRequirements,
      req.user.id,
    );

    logger.info(`학과별 졸업요건 저장 | univ=${req.user.university} | major=${major} | by=${req.user.email}`);
    res.json({
      ok: true,
      major,
      additionalRequirements: saved?.additionalRequirements || additionalRequirements,
    });
  } catch (err) {
    if (err.code === 'VALIDATION' || err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ── 학생 관리 ─────────────────────────────────────────────

const User = require('../models/User');
const DORMANT_DAYS = 180; // 6개월

const getStudentsPage = async (req, res, next) => {
  try {
    const university = req.user.university;
    const students = await User.find({ university, role: 'student' })
      .select('name email studentId major enrollmentStatus planType pointBalance isOnline lastLoginAt lastLogoutAt accountStatus')
      .sort({ isOnline: -1, lastLoginAt: -1 })
      .lean();

    const now = Date.now();
    const dormantThreshold = now - DORMANT_DAYS * 24 * 60 * 60 * 1000;

    const enriched = students.map(s => ({
      ...s,
      isDormant: s.lastLoginAt && s.lastLoginAt.getTime() < dormantThreshold,
    }));

    const totalCount    = students.length;
    const onlineCount   = students.filter(s => s.isOnline).length;
    const premiumCount  = students.filter(s => s.planType === 'premium').length;
    const dormantCount  = enriched.filter(s => s.isDormant).length;

    res.render('pages/staffStudents', {
      user: req.user,
      pageTitle: '학생 관리',
      currentPage: 'staffStudents',
      students: enriched,
      stats: { totalCount, onlineCount, premiumCount, dormantCount },
    });
  } catch (err) {
    next(err);
  }
};

// 학생 목록 (JSON) — getStudentsPage와 동일한 조회, React StaffStudents.jsx용.
const getStudentsData = async (req, res, next) => {
  try {
    const university = req.user.university;
    const students = await User.find({ university, role: 'student' })
      .select('name email studentId major enrollmentStatus planType pointBalance isOnline lastLoginAt lastLogoutAt accountStatus')
      .sort({ isOnline: -1, lastLoginAt: -1 })
      .lean();

    const now = Date.now();
    const dormantThreshold = now - DORMANT_DAYS * 24 * 60 * 60 * 1000;

    const enriched = students.map(s => ({
      ...s,
      isDormant: s.lastLoginAt && s.lastLoginAt.getTime() < dormantThreshold,
    }));

    const totalCount    = students.length;
    const onlineCount   = students.filter(s => s.isOnline).length;
    const premiumCount  = students.filter(s => s.planType === 'premium').length;
    const dormantCount  = enriched.filter(s => s.isDormant).length;

    res.json({
      ok: true,
      students: enriched,
      stats: { totalCount, onlineCount, premiumCount, dormantCount },
    });
  } catch (err) {
    next(err);
  }
};

const getStudentDetail = async (req, res, next) => {
  try {
    const university = req.user.university;
    const student = await User.findOne({ _id: req.params.id, university, role: 'student' })
      .select('name email studentId major enrollmentStatus planType pointBalance isOnline lastLoginAt lastLogoutAt accountStatus loginHistory dailyUsage')
      .lean();

    if (!student) return res.status(404).json({ ok: false, message: '학생을 찾을 수 없습니다.' });

    const history = (student.loginHistory || []).slice().reverse().slice(0, 10);
    res.json({ ok: true, student: { ...student, loginHistory: history } });
  } catch (err) {
    next(err);
  }
};

const suspendStudent = async (req, res, next) => {
  try {
    const university = req.user.university;
    const { action } = req.body; // 'dormant' | 'suspended' | 'active'
    const student = await User.findOneAndUpdate(
      { _id: req.params.id, university, role: 'student' },
      { accountStatus: action || 'suspended' },
      { new: true },
    ).lean();

    if (!student) return res.status(404).json({ ok: false, message: '학생을 찾을 수 없습니다.' });
    logger.info(`계정상태변경 | target=${student.email} | action=${action} | by=${req.user.email}`);
    res.json({ ok: true, accountStatus: student.accountStatus });
  } catch (err) {
    next(err);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const university = req.user.university;
    const student = await User.findOneAndDelete({ _id: req.params.id, university, role: 'student' }).lean();
    if (!student) return res.status(404).json({ ok: false, message: '학생을 찾을 수 없습니다.' });
    logger.info(`계정삭제 | target=${student.email} | by=${req.user.email}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const resetStudentPassword = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const university = req.user.university;
    const tempPw = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPw, 12);
    const student = await User.findOneAndUpdate(
      { _id: req.params.id, university, role: 'student' },
      { password: hashed },
    ).lean();
    if (!student) return res.status(404).json({ ok: false, message: '학생을 찾을 수 없습니다.' });
    logger.info(`비밀번호초기화 | target=${student.email} | by=${req.user.email}`);
    res.json({ ok: true, tempPassword: tempPw });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHomePage,
  getHomeData,
  getSchedulePage,
  getScheduleData,
  postSchedule,
  deleteSchedule,
  getGraduationPage,
  getGraduationData,
  saveGraduation,
  getMajorList,
  getMajorGraduation,
  saveMajorGraduation,
  getStudentsPage,
  getStudentsData,
  getStudentDetail,
  suspendStudent,
  deleteStudent,
  resetStudentPassword,
};
