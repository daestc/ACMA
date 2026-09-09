const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const multer  = require('multer');
const controller = require('../../controllers/authController');
const { loginLimiter, registerLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

const VERIFY_DIR = path.join(__dirname, '..', '..', 'public', 'upload');
fs.mkdirSync(VERIFY_DIR, { recursive: true });

const verifyUpload = multer({
  storage: multer.diskStorage({
    destination: VERIFY_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('이미지 파일(jpg/png/webp)만 업로드할 수 있습니다.'), ok);
  },
});

function handleVerifyUploadApi(req, res, next) {
  verifyUpload.single('verificationImage')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? '인증 사진은 5MB 이하만 업로드할 수 있습니다.'
        : err.message;
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}

router.post('/login', loginLimiter, controller.postLoginApi);
router.post('/register', registerLimiter, handleVerifyUploadApi, controller.postRegisterApi);

module.exports = router;
