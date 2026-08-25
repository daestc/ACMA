const fs          = require('fs');
const passport    = require('../config/passport');
const authService = require('../services/authService');
const logger      = require('../config/logger');

// 역할별 로그인 후 이동 경로(학생이면 home, 대학관계자이면 staff/lectures, 관리자이면 admin/staff)
function homeByRole(role) {
  if (role === 'staff') return '/staff/home';
  if (role === 'admin') return '/admin/staff';
  return '/home';
}

// postLogin/postLoginApi, postRegister/postRegisterApi가 공유하는 헬퍼.
// React 로그인/회원가입 API를 추가하면서(2026-08) EJS 버전과 세션 구성 로직이
// 갈라지지 않도록 뽑아냈다 — 필드 하나 추가/변경 시 한 곳만 고치면 됨.
function buildSessionUser(user) {
  return {
    id:               user._id,
    name:             user.name,
    email:            user.email,
    studentId:        user.studentId,
    university:       user.university,
    major:            user.major,
    grade:            user.grade,
    provider:         user.provider,
    role:             user.role || 'student',
    // 버그 수정: staffStatus가 원래 세션에 안 들어가 있었다 — middleware/auth.js의
    // requireStaff(SSR 라우트 전용 미들웨어)가 처음 요청이 올 때만 세션에 채워 넣는
    // 방식이었는데, staff 페이지들을 React SPA로 옮기면서 클라이언트 라우팅만으로는
    // requireStaff를 절대 거치지 않게 됐다. 그 결과 로그인 직후 GET /auth/me가
    // staffStatus 없는 세션을 그대로 내려줘서 RequireStaff 가드가 판단할 수 없었다.
    // 로그인 시점에 바로 채워 넣도록 고쳤다 (getMe에서도 staff 계정은 최신값으로
    // 다시 갱신함 — 관리자 승인 이후 상태가 바뀌는 경우까지 커버하기 위해).
    staffStatus:      user.staffStatus || null,
    enrollmentStatus: user.enrollmentStatus || '재학',
    accountStatus:    user.accountStatus    || 'active',
    planType:         user.planType         || 'free',
    pointBalance:     user.pointBalance     || 0,
    dailyUsage:       user.dailyUsage       || { quiz: { count: 0, date: '' }, summary: { count: 0, date: '' } },
  };
}

// 세션 고정 공격 방지를 위해 regenerate 후 session.user를 다시 세팅하고 저장한다.
// (기존 콜백 스타일 그대로 두되 Promise로 감싸 async/await에서 쓸 수 있게 함)
function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = buildSessionUser(user);
      req.session.save((err2) => {
        if (err2) return reject(err2);
        resolve(req.session.user);
      });
    });
  });
}

// ── 페이지 ────────────────────────────────────────────────

exports.getLogin = (req, res) => {
  if (req.session.user) return res.redirect(homeByRole(req.session.user.role));
  const error = req.query.suspended === '1'
    ? '계정이 정지되었습니다. 관리자에게 문의하세요.'
    : req.query.expired === '1'
    ? '세션이 만료되었습니다. 다시 로그인해주세요.'
    : req.session.authError || null;
  delete req.session.authError;
  res.render('pages/login', { title: '로그인', error });
};

exports.getRegister = (req, res) => {
  if (req.session.user) return res.redirect(homeByRole(req.session.user.role));
  res.render('pages/register', { title: '회원가입', error: null });
};

// ── 일반 로그인 ───────────────────────────────────────────

exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await authService.loginUser(email, password);

    // 로그인 시각 및 접속 기록 저장
    const now = new Date();
    const User = require('../models/User');
    User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastLoginAt: now,
      $push: { loginHistory: { $each: [{ action: 'login', at: now, ip }], $slice: -20 } },
    }).catch(err => logger.warn(`isOnline 업데이트 실패 | userId=${user._id} | ${err.message}`));

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id:               user._id,
        name:             user.name,
        email:            user.email,
        studentId:        user.studentId,
        university:       user.university,
        major:            user.major,
        grade:            user.grade,
        provider:         user.provider,
        role:             user.role || 'student',
        enrollmentStatus: user.enrollmentStatus || '재학',
        accountStatus:    user.accountStatus    || 'active',
        planType:         user.planType         || 'free',
        pointBalance:     user.pointBalance     || 0,
        dailyUsage:       user.dailyUsage       || { quiz: { count: 0, date: '' }, summary: { count: 0, date: '' } },
      };
      req.session.save((err) => {
        if (err) return next(err);
        logger.info(`로그인 성공 | userId=${user._id} | email=${email} | ip=${ip}`);
        res.redirect(homeByRole(user.role));
      });
    });
    //세션에 대학정보, 역할 정보 추가

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

// ── 일반 로그인 (React용 JSON) ────────────────────────────
// postLogin과 동일한 authService.loginUser + buildSessionUser/regenerateSession을
// 쓰되, res.render/res.redirect 대신 JSON으로 응답한다.
exports.postLoginApi = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await authService.loginUser(email, password);

    const now = new Date();
    const User = require('../models/User');
    User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastLoginAt: now,
      $push: { loginHistory: { $each: [{ action: 'login', at: now, ip }], $slice: -20 } },
    }).catch(err => logger.warn(`isOnline 업데이트 실패 | userId=${user._id} | ${err.message}`));

    const sessionUser = await regenerateSession(req, user);
    logger.info(`로그인 성공(API) | userId=${user._id} | email=${email} | ip=${ip}`);
    res.json({ success: true, user: sessionUser, redirectTo: homeByRole(user.role) });
  } catch (err) {
    if (err.code === 'NO_USER' || err.code === 'WRONG_PASSWORD') {
      const reason = err.code === 'WRONG_PASSWORD' ? '비밀번호 불일치' : '계정 없음 또는 소셜 계정';
      logger.warn(`로그인 실패(API) | email=${email} | 사유=${reason} | ip=${ip}`);
      return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    logger.warn(`로그인 오류(API) | email=${email} | ip=${ip} | ${err.message}`);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
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
  // 가입 유형: 'staff'(대학관계자) 외의 값은 모두 학생으로 처리
  const role = req.body.role === 'staff' ? 'staff' : 'student';

  // 가입 실패 시 업로드된 인증 사진을 지우고 에러 표시
  const fail = (message) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.render('pages/register', { title: '회원가입', error: message });
  };

  // 입력값 형식 검증 (controller 책임)
  const emailRegex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/;
  const hasLetter  = /[a-zA-Z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);

  if (!name?.trim() || name.trim().length < 2)
    return fail('이름은 2자 이상 입력해주세요.');
  if (!email || !emailRegex.test(email))
    return fail('유효하지 않은 이메일 형식입니다.');
  if (!university?.trim())
    return fail('대학교를 입력해주세요.');
  // 전공은 학생만 필수 (대학관계자는 입력하지 않음)
  if (role === 'student' && !major?.trim())
    return fail('전공을 입력해주세요.');
  // 대학관계자는 인증 사진 필수
  if (role === 'staff' && !req.file)
    return fail('관계자 인증 사진(재직증명서, 교직원증 등)을 첨부해주세요.');
  if (!password || password.length < 8 || !hasLetter || !hasNumber)
    return fail('비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.');
  if (password !== passwordConfirm)
    return fail('비밀번호가 일치하지 않습니다.');

  // 학생이 실수로 첨부한 파일은 저장하지 않고 제거
  if (role === 'student' && req.file) fs.unlink(req.file.path, () => {});

  const verificationImage = role === 'staff' && req.file
    ? `upload/${req.file.filename}`
    : null;

  try {
    const user = await authService.registerUser({ name, email, university, major, password, role, verificationImage });
    logger.info(`회원가입 | userId=${user._id} | email=${email} | role=${role} | ip=${ip}`);

    req.session.regenerate((err) => {
      if (err) return res.redirect('/auth/login');
      req.session.user = {
        id:               user._id,
        name:             user.name,
        email:            user.email,
        studentId:        user.studentId,
        university:       user.university,
        major:            user.major,
        grade:            user.grade,
        provider:         user.provider,
        role:             user.role,
        enrollmentStatus: user.enrollmentStatus || '재학',
        accountStatus:    user.accountStatus    || 'active',
        planType:         user.planType         || 'free',
        pointBalance:     user.pointBalance     || 0,
        dailyUsage:       user.dailyUsage       || { quiz: { count: 0, date: '' }, summary: { count: 0, date: '' } },
      };
      // user.role: student(학생) 또는 staff(대학관계자) 추가

      req.session.save((err) => {
        if (err) return res.redirect('/auth/login');
        logger.info(`회원가입 자동 로그인 | userId=${user._id} | ip=${ip}`);
        // staff는 강의 관리 페이지로 이동 -> 승인 전이면 안내 페이지가 표시됨
        res.redirect(homeByRole(user.role));
      });
    });

  } catch (err) {
    if (err.code === 'EMAIL_EXISTS') {
      logger.warn(`회원가입 실패 | email=${email} | 사유=이메일 중복 | ip=${ip}`);
      return fail(err.message);
    }
    logger.warn(`회원가입 오류 | email=${email} | ip=${ip} | ${err.message}`);
    fail('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
};

// ── 회원가입 (React용 JSON) ───────────────────────────────
// multer(verifyUpload)는 routes/api/authApiRouter.js에서 별도로 감싸서 붙인다
// (기존 handleVerifyUpload는 실패 시 EJS를 렌더하기 때문에 그대로 재사용할 수 없음).
exports.postRegisterApi = async (req, res) => {
  const { name, email, university, major, password, passwordConfirm } = req.body;
  const ip = req.ip;
  const role = req.body.role === 'staff' ? 'staff' : 'student';

  const fail = (status, message) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(status).json({ success: false, message });
  };

  const emailRegex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/;
  const hasLetter  = /[a-zA-Z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);

  if (!name?.trim() || name.trim().length < 2)
    return fail(400, '이름은 2자 이상 입력해주세요.');
  if (!email || !emailRegex.test(email))
    return fail(400, '유효하지 않은 이메일 형식입니다.');
  if (!university?.trim())
    return fail(400, '대학교를 입력해주세요.');
  if (role === 'student' && !major?.trim())
    return fail(400, '전공을 입력해주세요.');
  if (role === 'staff' && !req.file)
    return fail(400, '관계자 인증 사진(재직증명서, 교직원증 등)을 첨부해주세요.');
  if (!password || password.length < 8 || !hasLetter || !hasNumber)
    return fail(400, '비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.');
  if (password !== passwordConfirm)
    return fail(400, '비밀번호가 일치하지 않습니다.');

  if (role === 'student' && req.file) fs.unlink(req.file.path, () => {});

  const verificationImage = role === 'staff' && req.file
    ? `upload/${req.file.filename}`
    : null;

  try {
    const user = await authService.registerUser({ name, email, university, major, password, role, verificationImage });
    logger.info(`회원가입(API) | userId=${user._id} | email=${email} | role=${role} | ip=${ip}`);

    const sessionUser = await regenerateSession(req, user);
    logger.info(`회원가입 자동 로그인(API) | userId=${user._id} | ip=${ip}`);
    res.json({ success: true, user: sessionUser, redirectTo: homeByRole(user.role) });
  } catch (err) {
    if (err.code === 'EMAIL_EXISTS') {
      logger.warn(`회원가입 실패(API) | email=${email} | 사유=이메일 중복 | ip=${ip}`);
      return fail(409, err.message);
    }
    logger.warn(`회원가입 오류(API) | email=${email} | ip=${ip} | ${err.message}`);
    fail(500, '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
};

// ── 로그아웃 ──────────────────────────────────────────────

exports.postLogout = (req, res) => {
  const userId = req.session.user?.id;
  const ip     = req.ip;

  if (userId) {
    const now = new Date();
    const User = require('../models/User');
    User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastLogoutAt: now,
      $push: { loginHistory: { $each: [{ action: 'logout', at: now, ip }], $slice: -20 } },
    }).catch(err => logger.warn(`isOnline 업데이트 실패 | userId=${userId} | ${err.message}`));
  }

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

exports.getMe = async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ ok: false });

  // staff 계정은 승인 상태(staffStatus)/소속 대학이 바뀔 수 있는데, React SPA에서는
  // middleware/auth.js의 requireStaff(SSR 전용)를 거치지 않아 세션이 갱신될 기회가
  // 없다 — 그래서 여기서 매번 최신값으로 다시 확인해서 세션에 반영한다. RequireStaff
  // 가드가 항상 최신 승인 상태를 보고 판단할 수 있도록 하기 위한 보강.
  if (req.session.user.role === 'staff') {
    try {
      const User = require('../models/User');
      const fresh = await User.findById(req.session.user.id).select('staffStatus university accountStatus').lean();
      if (fresh) {
        req.session.user = {
          ...req.session.user,
          staffStatus: fresh.staffStatus || null,
          university: fresh.university,
          accountStatus: fresh.accountStatus || 'active',
        };
      }
    } catch {
      // 조회 실패해도 기존 세션값으로 계속 진행 (요청 자체를 막지는 않음)
    }
  }

  // user: React AppShell(사이드바/탑바)이 필요로 하는 세션 유저 전체.
  // 기존 { ok, provider } 응답 형태는 다른 곳에서 쓰고 있을 수 있어 그대로 두고 추가만 함.
  res.json({ ok: true, provider: req.session.user.provider, user: req.session.user });
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

      // 버그 수정: 원래 여기서 req.session.user를 buildSessionUser()를 안 쓰고
      // 직접 손으로 다시 만들고 있었다 — buildSessionUser()와 필드가 하나씩 다 같았는데
      // staffStatus만 빠져 있었다(예전에 buildSessionUser()에 staffStatus를 추가할 때
      // 이 중복 코드는 놓친 것으로 보임). 그 결과 카카오/네이버/구글 소셜 로그인으로
      // 들어온 교직원 계정은 세션에 staffStatus가 없어서 RequireStaff.jsx가 "승인 안 됨"
      // 으로 잘못 판단해 /home으로 튕겨나가는 문제가 있었다(이메일/비밀번호 로그인은
      // buildSessionUser()를 쓰는 regenerateSession()을 통해서 이미 고쳐져 있었음).
      // 중복 정의 대신 같은 세션 재생성 로직을 쓰는 regenerateSession()을 재사용해서
      // buildSessionUser()로 통일한다 — 이제 두 로그인 경로가 항상 같은 세션 모양을 갖는다.
      regenerateSession(req, user)
        .then(() => {
          if (isNew) {
            logger.info(`${provider} 신규 가입 | userId=${user._id} | ip=${ip}`);
          } else {
            logger.info(`${provider} 로그인 성공 | userId=${user._id} | ip=${ip}`);
          }
          res.redirect(homeByRole(user.role || 'student'));
        })
        .catch(next);
    })(req, res, next);
  };
};
