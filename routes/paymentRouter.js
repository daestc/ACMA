const express    = require('express');
const router     = express.Router();
const { requireLogin } = require('../middleware/auth');
const controller = require('../controllers/paymentController');

router.get('/',        requireLogin, controller.getPlansPage);
router.get('/history', requireLogin, controller.getHistoryPage);

module.exports = router;
