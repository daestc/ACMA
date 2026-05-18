const express = require('express');
const router = express.Router();
const noticeController = require('../controller/noticeController');


router.get('/home', noticeController.getHomePage); 
router.get('/notice', noticeController.getNoticePage);



module.exports = router;