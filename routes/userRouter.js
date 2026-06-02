const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

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
// Todo 추가 요청
router.post('/addTodo', userController.addTodo);

// Todo 삭제 요청
router.post('/deleteTodo', userController.deleteTodo);

// Habit 추가 요청
router.post('/addHabit', userController.addHabit);

// Habit 수정 요청
router.post('/editHabit', userController.editHabit);

// Habit 삭제 요청
router.post('/deleteHabit', userController.deleteHabit);

// IsCompleted 변동 사항 저장
router.post('/saveIsCompleted', userController.saveIsCompleted);




module.exports = router;