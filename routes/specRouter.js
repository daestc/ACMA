// routes/spec.js
const router = require('express').Router();
const ctrl = require('../controllers/specController');
const { isLoggedIn } = require('../middleware/auth');

// MyStatus 화면이 fetch로 부르는 JSON API라 302(requireLogin) 대신 401 JSON을 주는 isLoggedIn을 쓴다.
router.use(isLoggedIn);

// routes/spec.js
router.post('/award', ctrl.addAward);
router.put('/award/:id', ctrl.updateAward);
router.delete('/award/:id', ctrl.deleteAward);

router.post('/language', ctrl.addLanguage);
router.put('/language/:id', ctrl.updateLanguage);
router.delete('/language/:id', ctrl.deleteLanguage);

router.post('/experience', ctrl.addExperience);
router.put('/experience/:id', ctrl.updateExperience);
router.delete('/experience/:id', ctrl.deleteExperience);

router.post('/skill', ctrl.addSkill);
router.put('/skill/:id', ctrl.updateSkill);
router.delete('/skill/:id', ctrl.deleteSkill);

router.get('/mine', ctrl.getMySpecs);

module.exports = router;