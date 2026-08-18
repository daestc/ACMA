const express = require('express');
const router = express.Router();
const recruitController = require('../controllers/recruitController');
const { isLoggedIn } = require('../middleware/auth'); // 세션 기반 isLoggedIn 미들웨어 연동!

// 1. 채용정보 페이지 조회 (로그인 안 해도 볼 수 있다면 미들웨어 제외, 필요시 추가)
router.get('/', recruitController.getRecruitPage);

// 2. 공고 스크랩 토글 (로그인 필수 -> auth.js의 isLoggedIn 사용)
router.post('/:id/scrap', isLoggedIn, recruitController.toggleScrap);

module.exports = router;