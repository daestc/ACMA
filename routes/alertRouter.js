// routes/alertRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireLogin } = require('../middleware/auth');

router.get('/list', requireLogin, notificationController.getNotifications);
router.delete('/clear', requireLogin, notificationController.deleteNotifications);

module.exports = router;