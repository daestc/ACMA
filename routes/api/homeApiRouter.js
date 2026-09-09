const express = require('express');
const router = express.Router();
const landingController = require('../../controllers/landingController');
const { isLoggedIn } = require('../../middleware/auth');

router.get('/', isLoggedIn, landingController.getHomeApi);

module.exports = router;
