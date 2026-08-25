const express = require('express');
const router = express.Router();
const suggestionController = require('../../controllers/suggestionController');
const { isLoggedIn } = require('../../middleware/auth');
const { uploadSuggestionImages } = require('../../config/upload');

router.get('/', isLoggedIn, suggestionController.getSuggestionsApi);
router.post('/', isLoggedIn, ...uploadSuggestionImages, suggestionController.createSuggestion);
router.get('/:id', isLoggedIn, suggestionController.getStudentSuggestionDetail);

module.exports = router;
