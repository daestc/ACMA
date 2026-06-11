const passport    = require('../config/passport');
const authService = require('../services/authService');
const logger      = require('../config/logger');

// ── 페이지 ────────────────────────────────────────────────

exports.getLogin = (req, res) => {
  if (req.session.user) return res.redirect('/home');
  const error = req.query.expired === '1'
    ? '세션이 만료되었습니다. 다시 로그인해주세요.'
    : req.session.authError || null;
  delete req.session.authError;
  res.render('pages/login', { title: '로그인', error });
};

exports.getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.render('pages/register', { title: '회원가입', error: null });
};

// ── 일반 로그인 ───────────────────────────────────────────

exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await authService.loginUser(email, password);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        studentId: user.studentId,
        university: user.university,
        major:    user.major,
        grade:    user.grade,
        provider: user.provider,
      };
      req.session.save((err) => {
        if (err) return next(err);
        logger.info(`로그인 성공 | userId=${user._id} | email=${email} | ip=${ip}`);
        res.redirect('/home');
      });
    });

  } catch (err) {
    if (err.code === 'NO_USER' || err.code === 'WRONG_PASSWORD') {
      const reason = err.code === 'WRONG_PASSWORD' ? '비밀번호 불일치' : '계정 없음 또는 소셜 계정';
      logger.warn(`로그인 실패 | email=${email} | 사유=${reason} | ip=${ip}`);
      return res.render('pages/login', { title: '로그인', error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    logger.warn(`로그인 오류 | email=${email} | ip=${ip} | ${err.message}`);
    res.render('pages/login', { title: '로그인', error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
};

// ── 이메일 중복 확인 ──────────────────────────────────────

exports.checkEmail = async (req, res) => {
  const { email } = req.query;
  const regex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/;
  if (!email || !regex.test(email)) return res.json({ exists: false });

  try {
    const exists = await authService.checkEmailExists(email);
    res.json({ exists });
  } catch {
    res.json({ exists: false });
  }
};

// ── 회원가입 ──────────────────────────────────────────────

exports.postRegister = async (req, res) => {
  const { name, email, university, major, password, passwordConfirm } = req.body;
  const ip = req.ip;

  // 입력값 형식 검증 (controller 책임)
  const emailRegex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/;
  const hasLetter  = /[a-zA-Z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);

  if (!name?.trim() || name.trim().length < 2)
    return res.render('pages/register', { title: '회원가입', error: '이름은 2자 이상 입력해주세요.' });
  if (!email || !emailRegex.test(email))
    return res.render('pages/register', { title: '회원가입', error: '유효하지 않은 이메일 형식입니다.' });
  if (!university?.trim() || !major?.trim())
    return res.render('pages/register', { title: '회원가입', error: '대학교와 전공을 입력해주세요.' });
  if (!password || password.length < 8 || !hasLetter || !hasNumber)
    return res.render('pages/register', { title: '회원가입', error: '비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.' });
  if (password !== passwordConfirm)
    return res.render('pages/register', { title: '회원가입', error: '비밀번호가 일치하지 않습니다.' });

  try {
    const user = await authService.registerUser({ name, email, university, major, password });
    logger.info(`회원가입 | userId=${user._id} | email=${email} | ip=${ip}`);

    req.session.regenerate((err) => {
      if (err) return res.redirect('/auth/login');
      req.session.user = {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        studentId: user.studentId,
        university: user.university,
        major:    user.major,
        grade:    user.grade,
        provider: user.provider,
      };
      req.session.save((err) => {
        if (err) return res.redirect('/auth/login');
        logger.info(`회원가입 자동 로그인 | userId=${user._id} | ip=${ip}`);
        res.redirect('/home');
      });
    });

  } catch (err) {
    if (err.code === 'EMAIL_EXISTS') {
      logger.warn(`회원가입 실패 | email=${email} | 사유=이메일 중복 | ip=${ip}`);
      return res.render('pages/register', { title: '회원가입', error: err.message });
    }
    logger.warn(`회원가입 오류 | email=${email} | ip=${ip} | ${err.message}`);
    res.render('pages/register', { title: '회원가입', error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
};

// ── 로그아웃 ──────────────────────────────────────────────

exports.postLogout = (req, res) => {
  const userId = req.session.user?.id;
  const ip     = req.ip;
  req.session.destroy(() => {
    logger.info(`로그아웃 | userId=${userId} | ip=${ip}`);
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
};

// ── 비밀번호 변경 ─────────────────────────────────────────

exports.postChangePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { id: userId } = req.session.user;
  const ip = req.ip;

  try {
    await authService.changePassword({ userId, currentPassword, newPassword });
    logger.info(`비밀번호 변경 | userId=${userId} | ip=${ip}`);
    res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });

  } catch (err) {
    if (['WRONG_PASSWORD', 'NOT_LOCAL', 'INVALID_PASSWORD'].includes(err.code)) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    logger.warn(`비밀번호 변경 실패 | userId=${userId} | ip=${ip} | ${err.message}`);
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
};

// ── 세션 정보 조회 (클라이언트 provider 확인용) ──────────

exports.getMe = (req, res) => {
  if (!req.session?.user) return res.status(401).json({ ok: false });
  res.json({ ok: true, provider: req.session.user.provider });
};

// ── 회원 탈퇴 ────────────────────────────────────────────

exports.postWithdraw = async (req, res) => {
  const { password } = req.body;
  const { id: userId, provider } = req.session.user;
  const ip = req.ip;

  try {
    const result = await authService.withdrawUser({ userId, provider, password });

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      logger.info(`회원탈퇴 | provider=${result.provider} | userId=${userId} | ip=${ip}`);
      res.json({ ok: true });
    });

  } catch (err) {
    if (err.code === 'WRONG_PASSWORD') {
      return res.status(400).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
    }
    logger.warn(`회원탈퇴 실패 | provider=${provider} | userId=${userId} | ip=${ip} | ${err.message}`);
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
};

// ── 소셜 로그인 콜백 ──────────────────────────────────────

exports.oauthCallback = (provider) => {
  return (req, res, next) => {
    const ip = req.ip;

    if (req.query.error === 'access_denied') {
      logger.info(`소셜 로그인 취소 | provider=${provider} | ip=${ip}`);
      return res.redirect('/auth/login');
    }

    passport.authenticate(provider, { session: false }, async (err, result) => {
      if (err || !result) {
        const reason = err?.code === 'EMAIL_CONFLICT' ? '이메일 충돌' : err?.message ?? '알 수 없음';
        logger.warn(`${provider} 로그인 실패 | 사유=${reason} | ip=${ip}`);
        req.session.authError = err?.code === 'EMAIL_CONFLICT'
          ? err.message
          : '소셜 로그인에 실패했습니다. 다시 시도해주세요.';
        return res.redirect('/auth/login');
      }

      const { user, isNew } = result;

      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.session.user = {
          id:       user._id,
          name:     user.name,
          email:    user.email,
          major:    user.major,
          grade:    user.grade,
          provider: user.provider,
        };
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          if (isNew) {
            logger.info(`${provider} 신규 가입 | userId=${user._id} | ip=${ip}`);
          } else {
            logger.info(`${provider} 로그인 성공 | userId=${user._id} | ip=${ip}`);
          }
          res.redirect('/home');
        });
      });
    })(req, res, next);
  };
};
