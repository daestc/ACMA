// routes/notificationRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController');

// 알림 목록 조회 및 삭제 
router.get('/list', notificationController.getNotifications);
router.delete('/clear', notificationController.deleteNotifications);

module.exports = router;