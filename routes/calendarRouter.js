const express = require('express');
const router = express.Router();

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

// 캘린더 페이지
router.get('/', requireLogin, (req, res) => {
  res.render('pages/calendar', {
    title:       '캘린더',
    currentPage: 'calendar',
    pageTitle:   '📅 캘린더',
    user:        req.user,
  });
});

module.exports = router;