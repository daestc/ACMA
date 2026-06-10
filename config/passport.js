const passport       = require('passport');
const KakaoStrategy  = require('passport-kakao').Strategy;
const NaverStrategy  = require('passport-naver-v2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService    = require('../services/authService');
const logger         = require('./logger');

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(id).select('name email major grade provider');
    if (!user) logger.warn(`세션 복원 실패 | userId=${id} | 사유=유저 없음`);
    done(null, user);
  } catch (err) {
    logger.warn(`세션 복원 오류 | userId=${id} | ${err.message}`);
    done(err);
  }
});

// ── 카카오 ───────────────────────────────────────────────
if (process.env.KAKAO_CLIENT_ID) {
  passport.use(new KakaoStrategy(
    {
      clientID    : process.env.KAKAO_CLIENT_ID,
      callbackURL : '/auth/kakao/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await authService.findOrCreateSocialUser({
          provider   : 'kakao',
          providerId : String(profile.id),
          name       : profile.displayName || profile.username,
          email      : profile._json?.kakao_account?.email,
        });
        done(null, result);
      } catch (err) {
        done(err); // 로그는 controller에서 일괄 처리
      }
    }
  ));
}

// ── 네이버 ───────────────────────────────────────────────
if (process.env.NAVER_CLIENT_ID) {
  passport.use(new NaverStrategy(
    {
      clientID    : process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      callbackURL : '/auth/naver/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await authService.findOrCreateSocialUser({
          provider   : 'naver',
          providerId : String(profile.id),
          name       : profile.displayName,
          email      : profile.email,
        });
        done(null, result);
      } catch (err) {
        done(err);
      }
    }
  ));
}

// ── 구글 ─────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy(
    {
      clientID    : process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL : '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await authService.findOrCreateSocialUser({
          provider   : 'google',
          providerId : profile.id,
          name       : profile.displayName,
          email      : profile.emails?.[0]?.value,
        });
        done(null, result);
      } catch (err) {
        done(err);
      }
    }
  ));
}

module.exports = passport;
