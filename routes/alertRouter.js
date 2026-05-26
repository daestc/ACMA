// routes/alertRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController'); // 단수형 controller 반영 완료

const injectMockUser = (req, res, next) => {
    req.user = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1', // 가짜 테스트 유저 ID
        name: '김민준',
        major: '컴퓨터공학과',
        grade: 4
    };
    next();
};

router.get('/api/banner', notificationController.injectMockUser, notificationController.getNotifications); 

module.exports = router;