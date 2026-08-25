const express    = require('express');
const router     = express.Router();
const { requireLogin } = require('../middleware/auth');
const controller = require('../controllers/paymentController');

router.get('/',                  requireLogin, controller.getPlansPage);
// 플랜 페이지 데이터 JSON (React SPA용, getPlanData 주석 참고)
router.get('/plan-data',         requireLogin, controller.getPlanData);
router.post('/checkout/premium', requireLogin, controller.checkoutPremium);
router.post('/checkout/point',   requireLogin, controller.checkoutPoint);
router.get('/success',           requireLogin, controller.getSuccessPage);
router.get('/fail',              requireLogin, controller.getFailPage);
router.get('/history',           requireLogin, controller.getHistoryPage);
// 결제 내역 JSON (React SPA용, getHistoryData 주석 참고)
router.get('/history/data',      requireLogin, controller.getHistoryData);

// 토스페이먼츠 리다이렉트 (인증 없이 접근 가능해야 함 — 세션은 쿠키로 유지됨)
router.get('/confirm',                        controller.confirmPayment);

module.exports = router;
