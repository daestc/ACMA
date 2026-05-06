const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  // TODO: JWT 검증 후 req.user 세팅
  // 현재는 더미 유저로 통과
  req.user = {
    id:   '000000000000000000000001',         //id 추가
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

router.get('/eventsList',requireLogin, calendarController.getEventsList)//사용자의 일정 정보를 서비스에 요청

module.exports = router;