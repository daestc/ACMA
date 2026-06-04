const rateLimit = require('express-rate-limit');

// 로그인: 15분에 10회 실패 초과 시 차단 (성공은 카운트 제외)
const loginLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders  : false,
  handler(req, res) {
    // JSON 날것 대신 로그인 페이지에 에러 메시지로 표시
    res.status(429).render('pages/login', {
      title: '로그인',
      error : '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
    });
  },
});

// 회원가입: 1시간에 20회 초과 시 차단
const registerLimiter = rateLimit({
  windowMs : 60 * 60 * 1000,
  max      : 20,
  standardHeaders: true,
  legacyHeaders  : false,
  handler(req, res) {
    res.status(429).render('pages/register', {
      title: '회원가입',
      error : '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  },
});

module.exports = { loginLimiter, registerLimiter };
