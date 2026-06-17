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

module.exports = {
  getHomePage,
  getSchedulePage,
  postSchedule,
  deleteSchedule,
  getGraduationPage,
  saveGraduation,
  getMajorList,
  getMajorGraduation,
  saveMajorGraduation,
};
