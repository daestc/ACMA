const express = require('express');
const multer = require('multer');
const { requireStaff } = require('../middleware/auth');
const controller = require('../controllers/lectureAdminController');

const router = express.Router();

// CSV는 메모리에서 바로 파싱 (디스크 저장 불필요)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const isCsv = file.originalname.toLowerCase().endsWith('.csv');
    cb(isCsv ? null : new Error('CSV 파일만 업로드할 수 있습니다.'), isCsv);
  },
});

// /staff 하위 전체에 대학관계자(승인 완료) 권한 적용
router.use(requireStaff);

router.get('/lectures', controller.getLecturePage);
router.post('/lectures', controller.postLecture);
router.post('/lectures/csv', (req, res, next) => {
  upload.single('csvFile')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.postLectureCsv);
router.delete('/lectures/:id', controller.deleteLecture);

module.exports = router;
