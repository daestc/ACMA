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
    res.redirect('/auth/login?expired=1');
    return;
  }
  req.user = req.session.user;
  next();
}

module.exports = { requireLogin };
