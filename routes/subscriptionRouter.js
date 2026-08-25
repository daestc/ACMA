const express = require('express');
const { requireLogin } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

function blockStaff(req, res, next) {
  if (req.user?.role === 'staff') {
    return res.redirect('/staff/home');
  }
  next();
}

router.use(requireLogin, blockStaff);

router.get('/', subscriptionController.getSubscriptionPage);
router.get('/status', subscriptionController.getSubscriptionStatus);
router.post('/checkout', subscriptionController.createCheckout);
router.get('/success', subscriptionController.confirmSubscriptionPayment);
router.get('/fail', subscriptionController.renderFailPage);
router.post('/ai/use', subscriptionController.useAiQuota);
router.post('/cancel', subscriptionController.cancelSubscription);

module.exports = router;
