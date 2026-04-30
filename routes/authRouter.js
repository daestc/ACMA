const express = require('express');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  res.render('pages/login', { title: '로그인' });
});

// GET /register
router.get('/register', (req, res) => {
  res.render('pages/register', { title: '회원가입' });
});

module.exports = router;