const suggestionService = require('../services/suggestionService');
const logger = require('../config/logger');
const { removeUploadedFiles } = require('../config/upload');

const getStudentPage = async (req, res, next) => {
  try {
    if (req.user?.role === 'staff') {
      return res.redirect('/staff/suggestions');
    }

    const university = req.user?.university?.trim();
    let suggestions = [];

    if (university) {
      suggestions = await suggestionService.getStudentSuggestions(req.user.id, university);
    }

    res.render('pages/suggestions', {
      user: req.user,
      pageTitle: '건의 게시판',
      currentPage: 'suggestions',
      suggestions,
      categories: suggestionService.CATEGORY_LABELS,
      hasUniversity: Boolean(university),
    });
  } catch (err) {
    next(err);
  }
};

const createSuggestion = async (req, res) => {
  try {
    const images = (req.files || []).map((file) => `suggestions/${file.filename}`);
    const suggestion = await suggestionService.createSuggestion({
      university: req.user.university,
      authorId: req.user.id,
      authorName: req.user.name,
      category: req.body.category,
      title: req.body.title,
      content: req.body.content,
      images,
    });

    logger.info(`건의 등록 | title=${suggestion.title} | univ=${req.user.university} | by=${req.user.email}`);
    res.json({ ok: true, suggestion });
  } catch (err) {
    removeUploadedFiles(req);
    if (err.code === 'VALIDATION' || err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

// GET /api/suggestions — 학생용 건의 목록 + 카테고리 라벨을 JSON으로 반환.
// views/pages/suggestions.ejs의 getStudentPage가 SSR로 내려주던 데이터를
// React(Suggestions.jsx)가 fetch로 받아갈 수 있게 그대로 옮긴 버전.
const getSuggestionsApi = async (req, res) => {
  try {
    const university = req.user?.university?.trim();

    if (!university) {
      return res.json({
        ok: true,
        suggestions: [],
        categories: suggestionService.CATEGORY_LABELS,
        hasUniversity: false,
      });
    }

    const suggestions = await suggestionService.getStudentSuggestions(req.user.id, university);
    res.json({
      ok: true,
      suggestions,
      categories: suggestionService.CATEGORY_LABELS,
      hasUniversity: true,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const getStudentSuggestionDetail = async (req, res) => {
  try {
    const suggestion = await suggestionService.getStudentSuggestionById(
      req.params.id,
      req.user.id,
      req.user.university,
    );
    res.json({ ok: true, suggestion });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: err.message });
    }
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const getStaffPage = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || '';
    const allSuggestions = await suggestionService.getUniversitySuggestions(req.user.university);
    const pendingCount = allSuggestions.filter((s) => s.status === 'pending').length;
    const suggestions = statusFilter === 'pending' || statusFilter === 'completed'
      ? allSuggestions.filter((s) => s.status === statusFilter)
      : allSuggestions;

    res.render('pages/staffSuggestions', {
      user: req.user,
      pageTitle: '학생 건의 관리',
      currentPage: 'staffSuggestions',
      suggestions,
      statusFilter,
      pendingCount,
      categories: suggestionService.CATEGORY_LABELS,
    });
  } catch (err) {
    next(err);
  }
};

// 학생 건의 목록 (JSON) — getStaffPage와 동일한 조회, React StaffSuggestions.jsx용.
const getStaffSuggestionsData = async (req, res) => {
  try {
    const statusFilter = req.query.status || '';
    const allSuggestions = await suggestionService.getUniversitySuggestions(req.user.university);
    const pendingCount = allSuggestions.filter((s) => s.status === 'pending').length;
    const suggestions = statusFilter === 'pending' || statusFilter === 'completed'
      ? allSuggestions.filter((s) => s.status === statusFilter)
      : allSuggestions;

    res.json({ ok: true, suggestions, statusFilter, pendingCount });
  } catch (err) {
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const getStaffSuggestionDetail = async (req, res) => {
  try {
    const suggestion = await suggestionService.getUniversitySuggestionById(
      req.params.id,
      req.user.university,
    );
    res.json({ ok: true, suggestion });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: err.message });
    }
    if (err.code === 'NO_UNIVERSITY') {
      return res.status(400).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

const replySuggestion = async (req, res) => {
  try {
    const suggestion = await suggestionService.replyToSuggestion(
      req.params.id,
      req.user.university,
      {
        reply: req.body.reply,
        repliedBy: req.user.id,
        repliedByName: req.user.name,
      },
    );

    logger.info(`건의 답변 | id=${req.params.id} | univ=${req.user.university} | by=${req.user.email}`);
    res.json({ ok: true, suggestion });
  } catch (err) {
    if (err.code === 'VALIDATION' || err.code === 'NOT_FOUND' || err.code === 'NO_UNIVERSITY') {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ ok: false, message: err.message });
    }
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
};

module.exports = {
  getStudentPage,
  getSuggestionsApi,
  createSuggestion,
  getStudentSuggestionDetail,
  getStaffPage,
  getStaffSuggestionsData,
  getStaffSuggestionDetail,
  replySuggestion,
};
