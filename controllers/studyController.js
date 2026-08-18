const User = require('../models/User');
const logger = require('../config/logger');
const studyQuizService = require('../services/studyQuizService');

const FREE_DAILY_QUIZ_LIMIT = 10;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getStudyPage(req, res) {
  res.render('pages/study', {
    title: '공부',
    currentPage: 'study',
    pageTitle: '📖 공부',
    user: req.user,
  });
}

async function getQuizUsage(userId) {
  const user = await User.findById(userId).select('planType dailyUsage').lean();
  if (!user) {
    const error = new Error('사용자 정보를 찾을 수 없습니다.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const today = todayKey();
  const count = user.dailyUsage?.quiz?.date === today
    ? user.dailyUsage.quiz.count || 0
    : 0;
  return { user, today, count };
}

async function recordQuizUsage(userId, today, currentCount) {
  const nextCount = currentCount + 1;
  await User.findByIdAndUpdate(userId, {
    $set: {
      'dailyUsage.quiz.date': today,
      'dailyUsage.quiz.count': nextCount,
    },
  });
  return nextCount;
}

async function saveUsageToSession(req, today, count) {
  if (!req.session?.user) return;
  if (!req.session.user.dailyUsage) req.session.user.dailyUsage = {};
  req.session.user.dailyUsage.quiz = { date: today, count };
  await new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function generateQuiz(req, res) {
  try {
    const { user, today, count } = await getQuizUsage(req.user.id);
    if (user.planType !== 'premium' && count >= FREE_DAILY_QUIZ_LIMIT) {
      return res.status(429).json({
        ok: false,
        code: 'DAILY_LIMIT',
        message: `무료 플랜의 하루 퀴즈 생성 ${FREE_DAILY_QUIZ_LIMIT}회를 모두 사용했습니다.`,
      });
    }

    const result = await studyQuizService.generateQuizFromPdf(req.file.buffer, req.body.count);
    const used = await recordQuizUsage(req.user.id, today, count);
    await saveUsageToSession(req, today, used);

    logger.info(`AI PDF 퀴즈 생성 | userId=${req.user.id} | count=${result.quiz.length}`);
    return res.json({
      ok: true,
      quiz: result.quiz,
      meta: {
        filename: req.file.originalname,
        count: result.quiz.length,
        model: result.model,
        extraction: result.extraction && {
          pageCount: result.extraction.page_count,
          extractedChars: result.extraction.extracted_chars,
          usedChars: result.extraction.used_chars,
          truncated: result.extraction.truncated,
        },
        dailyUsage: user.planType === 'premium'
          ? null
          : { used, limit: FREE_DAILY_QUIZ_LIMIT },
      },
    });
  } catch (error) {
    const knownStatus = error.status && error.status >= 400 && error.status < 600;
    const status = knownStatus ? error.status : 500;
    const message = knownStatus ? error.message : '퀴즈 생성 중 서버 오류가 발생했습니다.';
    const diagnostic = error.diagnostic ? ` | python=${error.diagnostic}` : '';
    logger.error(`AI PDF 퀴즈 생성 실패 | userId=${req.user?.id || '-'} | code=${error.code || 'UNKNOWN'} | ${error.message}${diagnostic}`);
    return res.status(status).json({ ok: false, code: error.code || 'SERVER_ERROR', message });
  }
}

module.exports = { getStudyPage, generateQuiz };
