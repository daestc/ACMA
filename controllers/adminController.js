const path = require('path');
const User = require('../models/User'); const logger = require('../config/logger');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function verificationFilePath(relativePath) {
  if (relativePath.startsWith('uploads/')) {
    return path.join(ROOT_DIR, relativePath);
  }
  return path.join(PUBLIC_DIR, relativePath);
}

// 대학관계자 가입 승인 페이지
exports.getStaffApprovalPage = async (req, res, next) => {
  try {
    const [pendingStaff, processedStaff] = await Promise.all([
      User.find({ role: 'staff', staffStatus: 'pending' })
        .select('name email university createdAt verificationImage')
        .sort({ createdAt: 1 })
        .lean(),
      User.find({ role: 'staff', staffStatus: { $in: ['approved', 'rejected'] } })
        .select('name email university staffStatus updatedAt')
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean(),
    ]);

    res.render('pages/adminStaff', {
      user: req.user,
      pageTitle: '가입 승인',
      pendingStaff,
      processedStaff,
    });
  } catch (err) {
    next(err);
  }
};

// 승인 / 거절 
async function updateStaffStatus(req, res, status) {
  try {
    const target = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'staff' },
      { staffStatus: status },
      { returnDocument: 'after' }
    );

    if (!target) {
      return res.status(404).json({ ok: false, message: '대상 계정을 찾을 수 없습니다.' });
    }

    logger.info(`대학관계자 ${status === 'approved' ? '승인' : '거절'} | target=${target.email} | by=${req.user.email}`);
    res.json({ ok: true });
  } catch (err) {
    logger.warn(`대학관계자 상태 변경 실패 | targetId=${req.params.id} | ${err.message}`);
    res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
}

exports.approveStaff = (req, res) => updateStaffStatus(req, res, 'approved');
exports.rejectStaff = (req, res) => updateStaffStatus(req, res, 'rejected');

// 인증 사진 열람 (관리자 전용) 
exports.getVerificationImage = async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('verificationImage').lean();
    if (!target?.verificationImage) {
      return res.status(404).send('인증 사진이 없습니다.');
    }
    res.sendFile(verificationFilePath(target.verificationImage));
  } catch {
    res.status(500).send('이미지를 불러올 수 없습니다.');
  }
};
