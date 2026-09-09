const subscriptionService = require('../services/subscriptionService');

function checkAiQuota(count = 1) {
  return (req, res, next) => {
    try {
      req.aiQuotaStatus = subscriptionService.consumeAiQuota(req.session, count);
      next();
    } catch (err) {
      if (err.code === 'AI_LIMIT_EXCEEDED') {
        return res.status(429).json({
          ok: false,
          code: err.code,
          message: err.message,
          status: err.status,
        });
      }
      next(err);
    }
  };
}

function attachAiQuotaStatus(req, res, next) {
  req.aiQuotaStatus = subscriptionService.getSubscriptionStatus(req.session);
  next();
}

module.exports = {
  checkAiQuota,
  attachAiQuotaStatus,
};
