const express = require('express');
const router = express.Router();
const landingController = require('../controllers/landingController');
const { requireLogin } = require('../middleware/auth');

// 베너 페이지
router.get('/', (req, res) => {
  res.render('pages/landing', { title: 'AcadMe' });
});

// 메인 페이지
router.get('/home', requireLogin, landingController.getHomePage);

module.exports = router;