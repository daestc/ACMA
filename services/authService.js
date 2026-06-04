const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const logger = require('../config/logger');

// ── 로그인 검증 ───────────────────────────────────────────
async function loginUser(email, password) {
  const user = await User.findOne({ email });

  if (!user || user.provider !== 'local') {
    const err = new Error('계정 없음 또는 소셜 계정');
    err.code = 'NO_USER';
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error('비밀번호 불일치');
    err.code = 'WRONG_PASSWORD';
    throw err;
  }

  return user;
}

// ── 회원가입 ──────────────────────────────────────────────
async function registerUser({ name, email, university, major, password }) {
  const exists = await User.findOne({ email });
  if (exists) {
    const err = new Error('이미 사용 중인 이메일입니다.');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user   = await User.create({
    name: name.trim(),
    email,
    university: university?.trim() || null,
    major:      major?.trim()      || null,
    password:   hashed,
    provider:   'local',
  });

  return user;
}

// ── 이메일 중복 확인 ──────────────────────────────────────
async function checkEmailExists(email) {
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  return !!user;
}

// ── 소셜 유저 조회 or 신규 생성 (passport에서 이동) ──────
async function findOrCreateSocialUser({ provider, providerId, name, email }) {
  let user = await User.findOne({ provider, providerId });
  if (user) return { user, isNew: false };

  if (email) {
    const conflict = await User.findOne({ email, provider: 'local' });
    if (conflict) {
      const err = new Error('이미 이메일로 가입된 계정입니다. 일반 로그인을 이용해주세요.');
      err.code = 'EMAIL_CONFLICT';
      throw err;
    }
  }

  user = await User.create({
    provider,
    providerId,
    name,
    email: email || `${provider}_${providerId}@acma.local`,
  });

  return { user, isNew: true };
}

// ── 비밀번호 변경 ─────────────────────────────────────────
async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('존재하지 않는 계정입니다.');
    err.code = 'NO_USER';
    throw err;
  }
  if (user.provider !== 'local') {
    const err = new Error('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.');
    err.code = 'NOT_LOCAL';
    throw err;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    const err = new Error('현재 비밀번호가 올바르지 않습니다.');
    err.code = 'WRONG_PASSWORD';
    throw err;
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  if (!newPassword || newPassword.length < 8 || !hasLetter || !hasNumber) {
    const err = new Error('비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await User.updateOne({ _id: userId }, { password: hashed });
}

// ── 회원 탈퇴 ────────────────────────────────────────────
async function withdrawUser({ userId, provider, password }) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('존재하지 않는 계정입니다.');
    err.code = 'NO_USER';
    throw err;
  }

  if (provider === 'local') {
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('비밀번호가 올바르지 않습니다.');
      err.code = 'WRONG_PASSWORD';
      throw err;
    }
  }

  await User.deleteOne({ _id: userId });
  return { provider: user.provider };
}

module.exports = { loginUser, registerUser, checkEmailExists, findOrCreateSocialUser, changePassword, withdrawUser };
