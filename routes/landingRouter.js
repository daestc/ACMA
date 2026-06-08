const express = require('express');
const router = express.Router();
const landingController = require('../controllers/landingController');


// 베너 페이지 
router.get('/', (req, res) => {
  res.render('pages/landing', { title: 'AcadMe' });
});

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  // TODO: JWT 검증 후 req.user 세팅
  // 현재는 더미 유저로 통과
  req.user = {
    name: '가나다',
    major: '컴공',
    grade: 4,
    email: 'abc@test.com',
    password: "1234qwer"
  };
  next();
}

// 메인 페이지
router.get('/home', requireLogin, landingController.getHomePage);

module.exports = router;