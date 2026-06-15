const express = require('express');
const { requireStaff } = require('../middleware/auth');
const { uploadLectureCsv } = require('../config/upload');
const lectureController = require('../controllers/lectureAdminController');
const staffController = require('../controllers/staffController');

const router = express.Router();

router.use(requireStaff);

router.get('/lectures', lectureController.getLecturePage);
router.post('/lectures', lectureController.postLecture);
router.post('/lectures/csv', ...uploadLectureCsv, lectureController.postLectureCsv);
router.delete('/lectures/:id', lectureController.deleteLecture);

router.get('/schedules', staffController.getSchedulePage);
router.post('/schedules', staffController.postSchedule);
router.delete('/schedules/:id', staffController.deleteSchedule);

router.get('/graduation', staffController.getGraduationPage);
router.post('/graduation', staffController.saveGraduation);

module.exports = router;
