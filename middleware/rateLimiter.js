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

// 비용이 발생하는 AI 생성 API의 짧은 시간 내 반복 호출 방지
const aiQuizLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return String(req.user.id);
  },
  handler(_req, res) {
    res.status(429).json({
      ok: false,
      code: 'TOO_MANY_REQUESTS',
      message: '퀴즈 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    });
  },
});

// OpenAI를 부르는 AI 생성 API 4개(주간 계획·포트폴리오·진단·추천)가 카운터 하나를 공유한다 —
// 인스턴스 하나를 네 라우트에 걸면 같은 저장소·같은 키를 쓴다. pending 409는 동시 생성만 막아
// 끝날 때마다 다시 누르면 비용이 무제한이었다. 키가 req.user.id라 requireLogin 뒤에 걸어야 한다.
const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return String(req.user.id);
  },
  handler(_req, res) {
    res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: 'AI 생성 요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.',
    });
  },
});

module.exports = { loginLimiter, registerLimiter, aiQuizLimiter, aiGenerateLimiter };
