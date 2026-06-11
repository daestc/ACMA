// routes/notificationRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController');

// 알림 목록 조회 및 삭제 (테스트용으로 미들웨어 injectMockUser 배치)
router.get('/list', notificationController.injectMockUser, notificationController.getNotifications);
router.delete('/clear', notificationController.injectMockUser, notificationController.deleteNotifications);

module.exports = router;