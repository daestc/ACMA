const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/adminController');

const router = express.Router();

// /admin 하위 전체에 관리자 권한 적용
router.use(requireAdmin);

router.get('/staff', controller.getStaffApprovalPage);
router.get('/staff/:id/verification', controller.getVerificationImage);
router.post('/staff/:id/approve', controller.approveStaff);
router.post('/staff/:id/reject', controller.rejectStaff);

module.exports = router;
