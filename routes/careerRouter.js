const express = require('express');
const router = express.Router();
const careerController = require('../controllers/careerController');

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  // TODO: JWT 검증 후 req.user 세팅
  // 현재는 더미 유저로 통과
  req.user = {
    name: '김민준',
    major: '컴퓨터공학과',
    grade: 3,
    email: 'minkim@korea.ac.kr',
  };
  next();
}

// 진로정보 페이지 
router.get('/', requireLogin, (req, res) => {
  res.render('pages/career', {
    title:       '진로정보',
    currentPage: 'career',
    pageTitle:   '💼 진로정보',
    user:        req.user,
  });
});
// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
router.get('/categories', careerController.getCategories);
// 진로 검색db에서 대분류, 중분류, 소분류에 따른 진로 정보 가져오기
router.get('/search', careerController.searchCareers);

module.exports = router;