const express = require('express');
const { requireStaff } = require('../middleware/auth');
const { uploadLectureCsv } = require('../config/upload');
const controller = require('../controllers/lectureAdminController');

const router = express.Router();

// /staff 하위 전체에 대학관계자(승인 완료) 권한 적용
router.use(requireStaff);

router.get('/lectures', controller.getLecturePage);
router.post('/lectures', controller.postLecture);
router.post('/lectures/csv', ...uploadLectureCsv, controller.postLectureCsv);
router.delete('/lectures/:id', controller.deleteLecture);

module.exports = router;
