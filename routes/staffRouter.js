const express = require('express');
const { requireStaff } = require('../middleware/auth');
const { uploadLectureCsv } = require('../config/upload');
const lectureController = require('../controllers/lectureAdminController');
const staffController = require('../controllers/staffController');
const suggestionController = require('../controllers/suggestionController');

const router = express.Router();

router.use(requireStaff);

router.get('/home', staffController.getHomePage);// 대학관계자 홈 페이지

router.get('/lectures', lectureController.getLecturePage);// 강의 관리 페이지
router.post('/lectures', lectureController.postLecture);// 강의 등록
router.post('/lectures/csv', ...uploadLectureCsv, lectureController.postLectureCsv);// 강의 엑셀 업로드
router.delete('/lectures/:id', lectureController.deleteLecture);// 강의 삭제

router.get('/schedules', staffController.getSchedulePage);// 일정 관리 페이지
router.post('/schedules', staffController.postSchedule);// 일정 등록
router.delete('/schedules/:id', staffController.deleteSchedule);// 일정 삭제

router.get('/graduation', staffController.getGraduationPage);// 졸업요건 관리 페이지
router.post('/graduation', staffController.saveGraduation);// 졸업요건 저장
router.get('/graduation/majors', staffController.getMajorList);// 전공 목록 조회
router.get('/graduation/majors/:major', staffController.getMajorGraduation);// 전공 졸업요건 조회
router.post('/graduation/majors', staffController.saveMajorGraduation);// 전공 졸업요건 저장

router.get('/suggestions', suggestionController.getStaffPage);// 학생 건의 관리
router.get('/suggestions/:id', suggestionController.getStaffSuggestionDetail);// 건의 상세
router.post('/suggestions/:id/reply', suggestionController.replySuggestion);// 건의 답변

module.exports = router;
