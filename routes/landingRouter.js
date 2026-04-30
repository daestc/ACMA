const express = require('express');
const router = express.Router();

// 베너 페이지 
router.get('/', (req, res) => {
  res.render('pages/landing', { title: 'AcadMe' });
});

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

// 메인 페이지
router.get('/home', requireLogin, (req, res) => {
  res.render('pages/home', {
    title:       '홈',
    currentPage: 'home',
    pageTitle:   `안녕하세요, ${req.user.name}님 👋`,
    user:        req.user,
  });
});

module.exports = router;