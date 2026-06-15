const staffService = require('../services/staffService');
const logger = require('../config/logger');

exports.getSchedulePage = async (req, res, next) => {
  try {
    const schedules = await staffService.getSchedules(req.user.university);
    res.render('pages/staffSchedule', {
      user: req.user,
      pageTitle: '학교 일정 등록',
      schedules,
    });
  } catch (err) {
    next(err);
  }
};

exports.postSchedule = async (req, res) => {
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

exports.deleteSchedule = async (req, res) => {
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

exports.getGraduationPage = async (req, res, next) => {
  try {
    const graduation = await staffService.getGraduationRequirements(req.user.university);
    res.render('pages/staffGraduation', {
      user: req.user,
      pageTitle: '졸업요건 설정',
      requirements: graduation?.requirements || null,
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

exports.saveGraduation = async (req, res) => {
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
