const { WeeklyPlan, CareerPortfolio, CareerDiagnosis } = require('../models/Ai');
const { DailyChecklist } = require('../models/Calendar');
const contextBuilder = require('../services/ai/contextBuilder');
const readinessService = require('../services/ai/readinessService');
const missingAnalyzer = require('../services/ai/missingAnalyzer');
const planService = require('../services/ai/planService');
const portfolioService = require('../services/ai/portfolioService');
const diagnosisService = require('../services/ai/diagnosisService');
const kstDate = require('../utils/kstDate');
const logger = require('../config/logger');

// gap.actionType → WeeklyPlan.items.category 매핑. WeeklyPlan 쪽 enum엔 'experience'가
// 없어 'other'로 흡수한다.
const GAP_ACTION_TYPE_TO_CATEGORY = {
  cert: 'cert',
  project: 'project',
  course: 'course',
  language: 'language',
  experience: 'other',
  none: 'other',
};

// weekStart 미지정 시 기본값: 오늘이 KST 기준 일·월이면 이번 주(이미 진행 중이어도
// 아직 초반), 그 외엔 이번 주가 진행 중일 가능성이 커서 다음 주 일요일을 기본으로 한다.
function resolveWeekStart(requestedWeekStart) {
  if (requestedWeekStart) {
    return kstDate.getWeekStart(kstDate.fromKstDateString(requestedWeekStart));
  }

  const today = new Date();
  const dow = kstDate.getKstDayOfWeek(today);
  const thisWeekStart = kstDate.getWeekStart(today);
  if (dow === 0 || dow === 1) return thisWeekStart;

  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  return nextWeekStart;
}

// weekStart(일요일 00:00 KST)로부터 토요일 23:59:59.999 KST를 구한다.
function computeWeekEnd(weekStart) {
  const weekDates = kstDate.getWeekDateStrings(weekStart);
  const lastDayStart = kstDate.fromKstDateString(weekDates[6]);
  return new Date(lastDayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// ── 주간 계획 ─────────────────────────────────────────

async function requestWeeklyPlan(req, res) {
  try {
    const userId = req.user.id;

    const existingPending = await WeeklyPlan.findOne({ userId, status: 'pending' }).lean();
    if (existingPending) {
      return res.status(409).json({ success: false, message: '이미 생성 중인 주간 계획이 있습니다.' });
    }

    const weekStart = resolveWeekStart(req.body?.weekStart);
    const weekEnd = computeWeekEnd(weekStart);

    const doc = await WeeklyPlan.findOneAndUpdate(
      { userId, weekStart },
      { userId, weekStart, weekEnd, status: 'pending', errorMessage: null },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(202).json({ id: doc._id, status: 'pending' });

    setImmediate(() => {
      planService.generateWeeklyPlan(doc._id, userId, weekStart).catch(error => {
        logger.error(`[ai] weekly-plan background crash (docId=${doc._id}): ${error.message}`);
      });
    });
  } catch (error) {
    logger.error(`[ai] requestWeeklyPlan error: ${error.message}`);
    res.status(500).json({ success: false, message: '요청 처리에 실패했습니다.' });
  }
}

async function getWeeklyPlan(req, res) {
  try {
    const doc = await WeeklyPlan.findById(req.params.id).lean();
    if (!doc || String(doc.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false });
    }

    if (doc.status !== 'done') {
      return res.json({ status: doc.status, errorMessage: doc.errorMessage || null });
    }
    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getWeeklyPlan error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function getCurrentWeeklyPlan(req, res) {
  try {
    const weekStart = kstDate.getWeekStart(new Date());
    const doc = await WeeklyPlan.findOne({ userId: req.user.id, weekStart }).lean();
    if (!doc) return res.status(404).json({ success: false });

    if (doc.status !== 'done') {
      return res.json({ status: doc.status, errorMessage: doc.errorMessage || null });
    }
    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getCurrentWeeklyPlan error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function redistributeWeeklyPlan(req, res) {
  try {
    const doc = await WeeklyPlan.findById(req.params.id).lean();
    if (!doc || String(doc.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false });
    }
    if (doc.status !== 'done') {
      return res.status(409).json({ success: false, message: '완료된 주간계획만 재분배할 수 있습니다.' });
    }

    const result = await planService.runDistribution(doc);
    return res.json({ dayCount: result.dayCount, itemCount: result.itemCount, errors: result.errors });
  } catch (error) {
    logger.error(`[ai] redistributeWeeklyPlan error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

// 해당 주간계획이 실제로 만든 DailyChecklist 항목을 날짜별로 보여준다 (확인/테스트용)
async function getWeeklyPlanChecklist(req, res) {
  try {
    const plan = await WeeklyPlan.findById(req.params.id).select('userId weekStart').lean();
    if (!plan || String(plan.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false });
    }

    const weekDates = kstDate.getWeekDateStrings(plan.weekStart);
    const checklists = await DailyChecklist.find({ userId: req.user.id, date: { $in: weekDates } })
      .select('date items')
      .lean();

    const days = weekDates.map(date => {
      const doc = checklists.find(c => c.date === date);
      const items = (doc?.items || []).filter(
        item => item.source === 'ai' && String(item.weeklyPlanId) === String(plan._id),
      );
      return { date, items };
    });

    return res.json({ success: true, days });
  } catch (error) {
    logger.error(`[ai] getWeeklyPlanChecklist error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

// 구현 확인용 테스트 페이지
function renderTestPage(req, res) {
  res.render('pages/aiTest', { user: req.user, pageTitle: 'AI 기능 테스트' });
}

// ── 진로 포트폴리오 ────────────────────────────────────

// LLM을 부르지 않는 사전 확인 — 포트폴리오 화면 진입 시 먼저 호출해 생성 버튼
// 활성화 여부를 결정한다.
async function getPortfolioReadiness(req, res) {
  try {
    const context = await contextBuilder.buildPortfolioContext(req.user.id);
    const readiness = readinessService.checkReadiness(context);
    const missing = missingAnalyzer.analyzeMissing(context);
    return res.json({
      ready: readiness.ready,
      total: readiness.total,
      breakdown: readiness.breakdown,
      blockers: readiness.blockers,
      missing,
    });
  } catch (error) {
    logger.error(`[ai] getPortfolioReadiness error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function requestPortfolio(req, res) {
  try {
    const userId = req.user.id;

    const existingPending = await CareerPortfolio.findOne({ userId, status: 'pending' }).lean();
    if (existingPending) {
      return res.status(409).json({ success: false, message: '이미 생성 중인 포트폴리오가 있습니다.' });
    }

    const context = await contextBuilder.buildPortfolioContext(userId);
    const readiness = readinessService.checkReadiness(context);

    if (!readiness.ready) {
      const missing = missingAnalyzer.analyzeMissing(context);
      return res.status(400).json({ success: false, blockers: readiness.blockers, missing });
    }

    const doc = await CareerPortfolio.create({ userId, status: 'pending' });

    res.status(202).json({ id: doc._id, status: 'pending' });

    setImmediate(() => {
      portfolioService.generatePortfolio(doc._id, userId, context).catch(error => {
        logger.error(`[ai] portfolio background crash (docId=${doc._id}): ${error.message}`);
      });
    });
  } catch (error) {
    logger.error(`[ai] requestPortfolio error: ${error.message}`);
    res.status(500).json({ success: false, message: '요청 처리에 실패했습니다.' });
  }
}

async function getPortfolio(req, res) {
  try {
    const doc = await CareerPortfolio.findById(req.params.id).lean();
    if (!doc || String(doc.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false });
    }

    if (doc.status !== 'done') {
      return res.json({ status: doc.status, errorMessage: doc.errorMessage || null, missing: doc.missing || [] });
    }
    // missing은 doc 안에 이미 있으므로(= data.missing) 최상위에 중복해서 넣지 않는다.
    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getPortfolio error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function getLatestPortfolio(req, res) {
  try {
    const doc = await CareerPortfolio.findOne({ userId: req.user.id, status: 'done' })
      .sort({ createdAt: -1 })
      .lean();
    if (!doc) return res.status(404).json({ success: false });

    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getLatestPortfolio error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

// 인쇄용 뷰 — 본인 문서가 아니거나 아직 완료되지 않았으면 403이 아니라 404로
// 존재 여부 자체를 숨긴다. evidence/missing/readinessScore는 이 화면에 절대
// 노출하지 않는다 (portfolioPrint.ejs 참고). 4-B-2 PDF 렌더가 이 뷰와
// public/css/portfolio-print.css를 그대로 재사용한다.
async function renderPortfolioPrintPage(req, res) {
  try {
    let doc;
    try {
      doc = await CareerPortfolio.findById(req.params.id).lean();
    } catch (castError) {
      if (castError.name !== 'CastError') throw castError;
      doc = null; // 형식이 잘못된 id(예: 콜론이 섞여 들어온 경우) — 조회 실패와 동일하게 404
    }

    if (!doc || String(doc.userId) !== String(req.user.id) || doc.status !== 'done') {
      return res.status(404).render('pages/error', { title: '포트폴리오를 찾을 수 없음', status: 404, error: null });
    }

    return res.render('pages/portfolioPrint', {
      title: `진로 포트폴리오 · ${req.user.name}`,
      user: req.user,
      portfolio: doc,
      createdAtStr: kstDate.toKstDateString(doc.createdAt),
    });
  } catch (error) {
    logger.error(`[ai] renderPortfolioPrintPage error: ${error.message}`);
    res.status(500).render('pages/error', { title: '오류가 발생했습니다', status: 500, error: null });
  }
}

// ── 진로 진단 (본인용) ──────────────────────────────────

// LLM을 부르지 않는 사전 확인 — 점수/미입력 목록은 즉시, ready는 진단 전용 게이트
// (목표 직무만 있으면 됨 — 포트폴리오보다 문턱이 훨씬 낮다).
async function getDiagnosisScores(req, res) {
  try {
    const context = await contextBuilder.buildPortfolioContext(req.user.id);
    const diagnosisReadiness = readinessService.checkDiagnosisReadiness(context);
    const scores = readinessService.checkReadiness(context);
    const missing = missingAnalyzer.analyzeMissing(context);
    return res.json({
      ready: diagnosisReadiness.ready,
      blockers: diagnosisReadiness.blockers,
      total: scores.total,
      breakdown: scores.breakdown,
      missing,
    });
  } catch (error) {
    logger.error(`[ai] getDiagnosisScores error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function requestDiagnosis(req, res) {
  try {
    const userId = req.user.id;

    const existingPending = await CareerDiagnosis.findOne({ userId, status: 'pending' }).lean();
    if (existingPending) {
      return res.status(409).json({ success: false, message: '이미 생성 중인 진단이 있습니다.' });
    }

    const context = await contextBuilder.buildPortfolioContext(userId);
    const readiness = readinessService.checkDiagnosisReadiness(context);

    if (!readiness.ready) {
      const missing = missingAnalyzer.analyzeMissing(context);
      return res.status(400).json({ success: false, blockers: readiness.blockers, missing });
    }

    const doc = await CareerDiagnosis.create({ userId, status: 'pending' });

    res.status(202).json({ id: doc._id, status: 'pending' });

    setImmediate(() => {
      diagnosisService.generateDiagnosis(doc._id, userId, context).catch(error => {
        logger.error(`[ai] diagnosis background crash (docId=${doc._id}): ${error.message}`);
      });
    });
  } catch (error) {
    logger.error(`[ai] requestDiagnosis error: ${error.message}`);
    res.status(500).json({ success: false, message: '요청 처리에 실패했습니다.' });
  }
}

async function getDiagnosis(req, res) {
  try {
    const doc = await CareerDiagnosis.findById(req.params.id).lean();
    if (!doc || String(doc.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false });
    }

    if (doc.status !== 'done') {
      return res.json({ status: doc.status, errorMessage: doc.errorMessage || null, missing: doc.missing || [] });
    }
    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getDiagnosis error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

async function getLatestDiagnosis(req, res) {
  try {
    const doc = await CareerDiagnosis.findOne({ userId: req.user.id, status: 'done' })
      .sort({ createdAt: -1 })
      .lean();
    if (!doc) return res.status(404).json({ success: false });

    return res.json({ status: doc.status, data: doc });
  } catch (error) {
    logger.error(`[ai] getLatestDiagnosis error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

// 진단의 gap 하나를 대상 주 WeeklyPlan의 항목으로 옮긴다. 빈 WeeklyPlan을 대신
// 만들어주지 않는다 — Phase 3의 가용시간 검증을 우회하게 되기 때문.
async function addGapToWeeklyPlan(req, res) {
  try {
    const userId = req.user.id;
    const diagnosis = await CareerDiagnosis.findById(req.params.id).lean();
    if (!diagnosis || String(diagnosis.userId) !== String(userId)) {
      return res.status(404).json({ success: false });
    }

    const gap = (diagnosis.gaps || []).find(g => String(g._id) === req.params.gapId);
    if (!gap) {
      return res.status(404).json({ success: false, message: '해당 gap을 찾을 수 없습니다.' });
    }

    const weekStart = resolveWeekStart(req.body?.weekStart);
    const plan = await WeeklyPlan.findOne({ userId, weekStart });
    if (!plan) {
      return res.status(404).json({ success: false, message: '먼저 주간 계획을 생성해 주세요.' });
    }

    const alreadyExists = plan.items.some(item => item.title === gap.item);
    if (alreadyExists) {
      return res.status(409).json({ success: false, message: '이미 이번 주 계획에 추가된 항목입니다.' });
    }

    plan.items.push({
      title: gap.item,
      category: GAP_ACTION_TYPE_TO_CATEGORY[gap.actionType] || 'other',
      estimatedHours: 3,
      priority: 3,
      isDeadline: false,
      reason: gap.reason,
      relatedType: 'CareerDiagnosis',
      relatedId: diagnosis._id,
    });
    await plan.save();

    return res.json({ weeklyPlanId: plan._id, itemIndex: plan.items.length - 1 });
  } catch (error) {
    logger.error(`[ai] addGapToWeeklyPlan error: ${error.message}`);
    res.status(500).json({ success: false });
  }
}

module.exports = {
  requestWeeklyPlan,
  getWeeklyPlan,
  getCurrentWeeklyPlan,
  redistributeWeeklyPlan,
  getWeeklyPlanChecklist,
  renderTestPage,
  getPortfolioReadiness,
  requestPortfolio,
  getPortfolio,
  getLatestPortfolio,
  renderPortfolioPrintPage,
  getDiagnosisScores,
  requestDiagnosis,
  getDiagnosis,
  getLatestDiagnosis,
  addGapToWeeklyPlan,
};
