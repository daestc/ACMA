const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');


// MyStatus 페이지
router.get('/', requireLogin, (req, res) => {
  res.render('pages/mystatus', {
    title:       'MyStatus',
    currentPage: 'mystatus',
    pageTitle:   '⭐ MyStatus',
    user:        req.user,
  });
});

module.exports = router;