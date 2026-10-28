// routes/notificationRouter.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/list', notificationController.getNotifications);
router.delete('/clear', notificationController.deleteNotifications);

module.exports = router;