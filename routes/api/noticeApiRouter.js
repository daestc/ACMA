const express = require('express');
const router = express.Router();
const noticeController = require('../../controller/noticeController');

router.get('/', noticeController.getNoticesApi);

module.exports = router;
