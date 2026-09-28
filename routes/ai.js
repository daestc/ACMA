const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireLogin } = require('../middleware/auth');

router.get('/test', requireLogin, aiController.renderTestPage);
router.get('/readiness-summary', requireLogin, aiController.getReadinessSummary);

router.post('/weekly-plan', requireLogin, aiController.requestWeeklyPlan);
router.get('/weekly-plan/current', requireLogin, aiController.getCurrentWeeklyPlan);
router.get('/weekly-plan/history', requireLogin, aiController.getWeeklyPlanHistory);
router.get('/weekly-plan/stats', requireLogin, aiController.getWeeklyPlanStats);
router.get('/weekly-plan/today', requireLogin, aiController.getTodayChecklist);
router.get('/weekly-plan/:id', requireLogin, aiController.getWeeklyPlan);
router.post('/weekly-plan/:id/distribute', requireLogin, aiController.redistributeWeeklyPlan);
router.get('/weekly-plan/:id/checklist', requireLogin, aiController.getWeeklyPlanChecklist);
router.post('/weekly-plan/checklist/:itemId/toggle', requireLogin, aiController.toggleChecklistItem);

router.get('/portfolio/readiness', requireLogin, aiController.getPortfolioReadiness);
router.get('/portfolio/latest', requireLogin, aiController.getLatestPortfolio);
router.post('/portfolio', requireLogin, aiController.requestPortfolio);
router.get('/portfolio/:id', requireLogin, aiController.getPortfolio);
router.get('/portfolio/:id/print', requireLogin, aiController.renderPortfolioPrintPage);

router.get('/diagnosis/scores', requireLogin, aiController.getDiagnosisScores);
router.get('/diagnosis/latest', requireLogin, aiController.getLatestDiagnosis);
router.post('/diagnosis', requireLogin, aiController.requestDiagnosis);
router.get('/diagnosis/:id', requireLogin, aiController.getDiagnosis);
router.post('/diagnosis/:id/gaps/:gapId/to-plan', requireLogin, aiController.addGapToWeeklyPlan);

// /form, /latest는 /:id보다 먼저 와야 한다 — 뒤에 두면 "form"이 id로 해석된다.
router.get('/recommendation/form', requireLogin, aiController.getRecommendationForm);
router.post('/recommendation', requireLogin, aiController.requestRecommendation);
router.get('/recommendation/latest', requireLogin, aiController.getLatestRecommendation);
router.get('/recommendation/:id', requireLogin, aiController.getRecommendation);
router.post('/recommendation/:id/select', requireLogin, aiController.selectRecommendation);

module.exports = router;
