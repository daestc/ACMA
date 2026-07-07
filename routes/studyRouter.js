const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

// 공부 페이지
router.get('/', requireLogin, (req, res) => {
  res.render('pages/study', {
    title:       '공부',
    currentPage: 'study',
    pageTitle:   '📖 공부',
    user:        req.user,
  });
});

module.exports = router;