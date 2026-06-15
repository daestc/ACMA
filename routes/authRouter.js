const express     = require('express');
const fs          = require('fs');
const path        = require('path');
const crypto      = require('crypto');
const multer      = require('multer');
const passport    = require('../config/passport');
const controller  = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// ── 관계자 인증 사진 업로드 설정 ──────────────────
// public/upload/에 저장 → express.static으로 /upload/... URL 제공
const VERIFY_DIR = path.join(__dirname, '..', 'public', 'upload');
fs.mkdirSync(VERIFY_DIR, { recursive: true });

const verifyUpload = multer({
  storage: multer.diskStorage({
    destination: VERIFY_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`); // 원본 파일명 노출 방지
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('이미지 파일(jpg/png/webp)만 업로드할 수 있습니다.'), ok);
  },
});

// multer 오류를 가입 페이지 에러 메시지로 변환
function handleVerifyUpload(req, res, next) {
  verifyUpload.single('verificationImage')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? '인증 사진은 5MB 이하만 업로드할 수 있습니다.'
        : err.message;
      return res.render('pages/register', { title: '회원가입', error: message });
    }
    next();
  });
}

// ── 페이지
router.get('/login',    controller.getLogin);
router.get('/register', controller.getRegister);

// ── 일반 인증
router.post('/login',    loginLimiter,    controller.postLogin);
router.post('/register', registerLimiter, handleVerifyUpload, controller.postRegister);
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
