// routes/noticeRouter.js
const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const notificationController = require('../controllers/notificationController');

// 📋 공지사항 웹 화면 렌더링
router.get('/', noticeController.getNoticePage);

/**
 * 🔔 프론트엔드가 어떤 주소로 알림을 노크하든 상관없이 알림 컨트롤러로 토스!
 */
router.get('/urgent', notificationController.getUrgentNoticesApi);        
router.get('/api/urgent', notificationController.getUrgentNoticesApi);       
router.get('/home/api/urgent', notificationController.getUrgentNoticesApi);   

module.exports = router;