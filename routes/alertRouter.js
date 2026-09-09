// routes/alertRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController'); // 단수형 controller 반영 완료


router.get('/list', notificationController.getNotifications);
router.delete('/clear', notificationController.deleteNotifications);

module.exports = router;