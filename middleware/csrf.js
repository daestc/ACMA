const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// OAuth 콜백은 외부 서버에서 오는 리다이렉트이므로 세션 토큰 검증 불가 — 면제
const EXEMPT_PREFIXES = [
  '/auth/kakao/callback',
  '/auth/naver/callback',
  '/auth/google/callback',
];

// 세션에 CSRF 토큰이 없으면 생성하고 res.locals에 주입 (모든 요청에 적용)
function attachCsrfToken(req, res, next) {
  if (!req.session) return next();
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// POST/PUT/DELETE/PATCH 요청에서 토큰 검증
function validateCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PREFIXES.some(p => req.originalUrl.startsWith(p))) return next();

  const sessionToken = req.session?.csrfToken;
  const requestToken = req.body?._csrf || req.headers['x-csrf-token'];

  if (!sessionToken || !requestToken || sessionToken !== requestToken) {
    const isJson = (req.headers['content-type'] || '').includes('application/json')
                || req.headers['accept']?.includes('application/json');
    if (isJson) {
      return res.status(403).json({ success: false, message: '요청이 유효하지 않습니다. 페이지를 새로고침 후 다시 시도해주세요.' });
    }
    return res.status(403).send('요청이 유효하지 않습니다. 페이지를 새로고침 후 다시 시도해주세요.');
  }
  next();
}

module.exports = { attachCsrfToken, validateCsrf };
