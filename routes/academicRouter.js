const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const { requireLogin } = require('../middleware/auth');


// 학사관리 페이지 
router.get('/', requireLogin, (req, res) => {
  res.render('pages/academic', {
    title:       '학사관리',
    currentPage: 'academic',
    pageTitle:   '🎓 학사관리',
    user:        req.user,
  });
});
// GPA 계산 과목들 저장
router.post('/addCourse', requireLogin, academicController.addCourse); // GPA 계산 과목들 저장
router.post('/editCourse', requireLogin, academicController.editCourse); // GPA 계산기 강의 수정
router.post('/updateBulkGrades', requireLogin, academicController.updateBulkGrades); // 과목 일괄 성적 업데이트
router.post('/deleteCourse', requireLogin, academicController.deleteCourse); // GPA 계산기 강의 삭제
router.post('/closeSemester', requireLogin, academicController.closeSemester); // 학기 마감
router.post('/reopenSemester', requireLogin, academicController.reopenSemester); // 학기 마감 취소
router.get('/record/:semester', requireLogin, academicController.getSemesterRecord); // 특정 학기 레코드 조회
router.get('/all-gpa', requireLogin, academicController.getSemesterGPA);//모든 학기 gpa 값 조회
router.get('/progress', requireLogin, academicController.getProgress); // 이수 학점 진도 집계
router.get('/graduation-requirements', requireLogin, academicController.getGraduationRequirements); // 졸업요건 조회
router.post('/graduation-requirements', requireLogin, academicController.saveGraduationRequirements); // 졸업요건 저장

module.exports = router;