const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { aiQuizLimiter } = require('../middleware/rateLimiter');
const { uploadQuizPdf } = require('../config/upload');
const studyController = require('../controllers/studyController');

router.get('/', requireLogin, studyController.getStudyPage);
router.post('/quiz/generate', requireLogin, aiQuizLimiter, ...uploadQuizPdf, studyController.generateQuiz);

module.exports = router;
