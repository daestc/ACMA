const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  req.user = {
    name: '김민준',
    major: '컴퓨터공학과',
    grade: 3,
    email: 'minkim@korea.ac.kr',
  };
  next();
}

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
router.post('/deleteCourse', requireLogin, academicController.deleteCourse); // GPA 계산기 강의 삭제
router.get('/record/:semester', requireLogin, academicController.getSemesterRecord); // 특정 학기 레코드 조회
router.get('/all-gpa', requireLogin, academicController.getSemesterGPA);//모든 학기 gpa 값 조회
router.get('/graduation-requirements', requireLogin, academicController.getGraduationRequirements); // 졸업요건 조회
router.post('/graduation-requirements', requireLogin, academicController.saveGraduationRequirements); // 졸업요건 저장

module.exports = router;