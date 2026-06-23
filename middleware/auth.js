/**
 * 공용 인증 미들웨어
 *
 * 사용법: const { requireLogin } = require('../middleware/auth');
 *
 * req.user 구조:
 *   { id, name, email, major, grade }
 */

const User = require('../models/User');

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    res.redirect('/auth/login?expired=1');
    return;
  }
  req.user = req.session.user;
  next();
}

/**
 * 대학관계자(승인 완료) 전용
 * - DB에서 최신 상태를 조회하므로 관리자가 승인하면 재로그인 없이 바로 접근 가능
 * - 승인 대기 중이면 안내 페이지 표시
 */
async function requireStaff(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login?expired=1');
  }

  try {
    const user = await User.findById(req.session.user.id).lean();
    if (!user) return res.redirect('/auth/login?expired=1');

    if (user.role === 'staff' && user.staffStatus === 'approved') {
      if (!user.university?.trim()) {
        return res.status(403).render('pages/error', {
          title: '소속 대학 정보 없음',
          status: 403,
          error: '강의 관리를 사용하려면 소속 대학 정보가 필요합니다.',
        });
      }

      req.session.user = {
        ...req.session.user,
        role: user.role,
        staffStatus: user.staffStatus,
        university: user.university,
      };
      req.user = req.session.user;
      return next();
    }
    if (user.role === 'staff' && user.staffStatus === 'pending') {
      return res.render('pages/staffPending', { user: req.session.user });
    }
    // 학생/거절된 계정 등은 접근 불가
    return res.redirect('/home');
  } catch (err) {
    next(err);
  }
}

// 관리자 전용
async function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login?expired=1');
  }

  try {
    const user = await User.findById(req.session.user.id).lean();
    if (!user || user.role !== 'admin') {
      return res.redirect('/home');
    }
    req.user = { ...req.session.user, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// 세션의 일일 사용량을 오늘 날짜 기준으로 리셋 (자정 쿨타임)
function refreshDailyUsage(req, res, next) {
  if (!req.session?.user) return next();
  const today = new Date().toISOString().slice(0, 10);
  const u = req.session.user;

  if (!u.dailyUsage) {
    u.dailyUsage = {
      quiz:    { count: 0, date: today },
      summary: { count: 0, date: today },
    };
    return req.session.save(() => next());
  }

  let changed = false;
  if (u.dailyUsage.quiz?.date    !== today) { u.dailyUsage.quiz    = { count: 0, date: today }; changed = true; }
  if (u.dailyUsage.summary?.date !== today) { u.dailyUsage.summary = { count: 0, date: today }; changed = true; }
  if (changed) return req.session.save(() => next());
  next();
}

module.exports = { requireLogin, requireStaff, requireAdmin, refreshDailyUsage };
