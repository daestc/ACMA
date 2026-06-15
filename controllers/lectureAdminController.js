const lectureAdminService = require('../services/lectureAdminService');
const logger = require('../config/logger');

// 강의 관리 페이지
exports.getLecturePage = async (req, res, next) => {
  try {
    const { search = '', page = 1 } = req.query;
    const lectureData = await lectureAdminService.getLectures({
      search: search.trim(),
      page: Math.max(1, parseInt(page, 10) || 1),
      university: req.user.university, // 소속 대학 강의만 표시
    });

    res.render('pages/lectureAdmin', {
      user: req.user,
      pageTitle: '강의 관리',
      search: search.trim(),
      ...lectureData,
    });
  } catch (err) {
    next(err);
  }
};

// 개별 강의 등록
exports.postLecture = async (req, res) => {
  const { classification, courseName, section, credits, professor, schedules, year, semester } = req.body;

  // 입력 검증
  if (!classification?.trim() || !courseName?.trim())
    return res.status(400).json({ ok: false, message: '이수구분과 교과명을 입력해주세요.' });

  // 분반은 선택 입력 — 비워두면 0(분반 없음)으로 저장
  const sectionNum = (section === '' || section == null) ? 0 : parseInt(section, 10);
  const creditsNum = parseInt(credits, 10);
  if (Number.isNaN(sectionNum) || sectionNum < 0)
    return res.status(400).json({ ok: false, message: '분반은 0 이상의 숫자여야 합니다.' });
  if (!creditsNum || creditsNum < 1)
    return res.status(400).json({ ok: false, message: '학점은 1 이상의 숫자여야 합니다.' });

  if (!Array.isArray(schedules) || schedules.length === 0)
    return res.status(400).json({ ok: false, message: '강의시간을 1개 이상 추가해주세요.' });

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const s of schedules) {
    if (!['월', '화', '수', '목', '금', '토', '일'].includes(s.day) ||
        !timeRegex.test(s.startTime) || !timeRegex.test(s.endTime)) {
      return res.status(400).json({ ok: false, message: '강의시간 형식이 올바르지 않습니다.' });
    }
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    s.startMinute = sh * 60 + sm;
    s.endMinute   = eh * 60 + em;
    if (s.startMinute >= s.endMinute) {
      return res.status(400).json({ ok: false, message: '종료 시간은 시작 시간보다 늦어야 합니다.' });
    }
  }

  try {
    const lecture = await lectureAdminService.createLecture({
      classification: classification.trim(),
      courseName: courseName.trim(),
      section: sectionNum,
      credits: creditsNum,
      professor: professor?.trim(),
      schedules,
      year: parseInt(year, 10) || undefined,
      semester: semester?.trim() || undefined,
      createdBy: req.user.id,
      university: req.user.university,
    });

    logger.info(`강의 등록 | ${lecture.courseName}-${lecture.section} | univ=${req.user.university} | by=${req.user.email}`);
    res.json({ ok: true, lecture });
  } catch (err) {
    if (err.code === 'DUPLICATE_LECTURE') {
      return res.status(409).json({ ok: false, message: err.message });
    }
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    logger.warn(`강의 등록 실패 | by=${req.user.email} | ${err.message}`);
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

// CSV / XLSX 일괄 등록
exports.postLectureCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: '파일을 업로드해주세요.' });
  }

  try {
    const { year, semester } = req.body;
    const result = await lectureAdminService.bulkUpsertFromCsv(req.file.buffer, {
      year: parseInt(year, 10) || undefined,
      semester: semester?.trim() || undefined,
      createdBy: req.user.id,
      university: req.user.university,
      filename: req.file.originalname,
    });

    logger.info(`강의 파일 업로드 | 삽입=${result.inserted} 갱신=${result.updated} | by=${req.user.email}`);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.code === 'EMPTY_CSV') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    if (err.code === 'DUPLICATE_LECTURE') {
      return res.status(409).json({ ok: false, message: err.message });
    }
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    logger.warn(`강의 파일 업로드 실패 | by=${req.user.email} | ${err.message}`);
    res.status(500).json({ ok: false, message: '파일 처리 중 오류가 발생했습니다.' });
  }
};

// 강의 삭제 
exports.deleteLecture = async (req, res) => {
  try {
    const lecture = await lectureAdminService.deleteLecture(req.params.id, req.user.university);
    logger.info(`강의 삭제 | ${lecture.courseName}-${lecture.section} | by=${req.user.email}`);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};
