const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {requireLogin} = require('../middleware/auth');

// Todo 추가 요청
router.post('/addTodo', requireLogin, userController.addTodo);

// Todo 삭제 요청
router.post('/deleteTodo', requireLogin, userController.deleteTodo);

// Habit 추가 요청
router.post('/addHabit', requireLogin, userController.addHabit);

// Habit 수정 요청
router.post('/editHabit', requireLogin, userController.editHabit);

// Habit 삭제 요청
router.post('/deleteHabit', requireLogin, userController.deleteHabit);

// IsCompleted 변동 사항 저장
router.post('/saveIsCompleted', requireLogin, userController.saveIsCompleted);

// Mypage 학사정보 업데이트
router.post('/updateProfile', requireLogin, userController.updateProfile);
// user 정보 가져오기
router.get('/profile', requireLogin, userController.getProfile);
// 수상경력 정보 가져오기
router.get('/my-awards', requireLogin, userController.getMyAwards);


module.exports = router;