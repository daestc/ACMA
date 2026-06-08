const express     = require('express');
const passport    = require('../config/passport');
const controller  = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// ── 페이지
router.get('/login',    controller.getLogin);
router.get('/register', controller.getRegister);

// ── 일반 인증
router.post('/login',    loginLimiter,    controller.postLogin);
router.post('/register', registerLimiter, controller.postRegister);
router.post('/logout',   controller.postLogout);
router.post('/withdraw',        requireLogin, controller.postWithdraw);
router.post('/change-password', requireLogin, controller.postChangePassword);

// ── 이메일 중복 확인
router.get('/check-email', controller.checkEmail);

// ── 세션 정보
router.get('/me', controller.getMe);

// ── 카카오
router.get('/kakao',          passport.authenticate('kakao'));
router.get('/kakao/callback', controller.oauthCallback('kakao'));

// ── 네이버
router.get('/naver',          passport.authenticate('naver'));
router.get('/naver/callback', controller.oauthCallback('naver'));

// ── 구글
router.get('/google',          passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', controller.oauthCallback('google'));

module.exports = router;
