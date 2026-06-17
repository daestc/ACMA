const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { uploadSuggestionImages } = require('../config/upload');
const suggestionController = require('../controllers/suggestionController');

const router = express.Router();

router.get('/', requireLogin, suggestionController.getStudentPage);
router.post('/', requireLogin, ...uploadSuggestionImages, suggestionController.createSuggestion);
router.get('/:id', requireLogin, suggestionController.getStudentSuggestionDetail);

module.exports = router;
