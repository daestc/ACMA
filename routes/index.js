const express = require('express');
const router  = express.Router();

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

// ── 공개 페이지 ───────────────────────────────────

// GET /  → 랜딩 페이지
router.get('/', (req, res) => {
  res.render('pages/landing', { title: 'AcadMe' });
});

// GET /login
router.get('/login', (req, res) => {
  res.render('pages/login', { title: '로그인' });
});

// GET /register
router.get('/register', (req, res) => {
  res.render('pages/register', { title: '회원가입' });
});

// ── 로그인 필요 페이지 ────────────────────────────
// 각 페이지에 { currentPage, pageTitle, user } 전달
// → sidebar.ejs에서 currentPage로 active 클래스 적용
// → topbar.ejs에서 pageTitle 표시

router.get('/home', requireLogin, (req, res) => {
  res.render('pages/home', {
    title:       '홈',
    currentPage: 'home',
    pageTitle:   `안녕하세요, ${req.user.name}님 👋`,
    user:        req.user,
  });
});

router.get('/calendar', requireLogin, (req, res) => {
  res.render('pages/calendar', {
    title:       '캘린더',
    currentPage: 'calendar',
    pageTitle:   '📅 캘린더',
    user:        req.user,
  });
});

router.get('/mystatus', requireLogin, (req, res) => {
  res.render('pages/mystatus', {
    title:       'MyStatus',
    currentPage: 'mystatus',
    pageTitle:   '⭐ MyStatus',
    user:        req.user,
  });
});

router.get('/notice', requireLogin, (req, res) => {
  res.render('pages/notice', {
    title:       '공지사항',
    currentPage: 'notice',
    pageTitle:   '📢 공지사항',
    user:        req.user,
  });
});

router.get('/academic', requireLogin, (req, res) => {
  res.render('pages/academic', {
    title:       '학사관리',
    currentPage: 'academic',
    pageTitle:   '🎓 학사관리',
    user:        req.user,
  });
});

router.get('/study', requireLogin, (req, res) => {
  res.render('pages/study', {
    title:       '공부',
    currentPage: 'study',
    pageTitle:   '📖 공부',
    user:        req.user,
  });
});

router.get('/career', requireLogin, (req, res) => {
  res.render('pages/career', {
    title:       '진로정보',
    currentPage: 'career',
    pageTitle:   '💼 진로정보',
    user:        req.user,
  });
});

module.exports = router;
