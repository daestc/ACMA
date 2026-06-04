/**
 * 공용 인증 미들웨어
 *
 * 사용법: const { requireLogin } = require('../middleware/auth');
 *
 * req.user 구조:
 *   { id, name, email, major, grade }
 */

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    req.session.authError = '세션이 만료되었습니다. 다시 로그인해주세요.';
    return res.redirect('/auth/login');
  }
  req.user = req.session.user;
  next();
}

module.exports = { requireLogin };
