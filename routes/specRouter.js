// routes/spec.js
const router = require('express').Router();
const ctrl = require('../controllers/specController');

router.post('/award', ctrl.addAward);
router.post('/language', ctrl.addLanguage);
router.post('/experience', ctrl.addExperience);
router.get('/mine', ctrl.getMySpecs);

module.exports = router;