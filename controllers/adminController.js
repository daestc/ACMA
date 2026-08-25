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
// 대학관계자 가입 승인 목록 JSON (React SPA용)
// 원본 getStaffApprovalPage는 SSR 전용이었다 — 쿼리 로직은 완전히 동일하게 맞추고
// res.json으로만 바꿨다.
exports.getStaffApprovalData = async (req, res, next) => {
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
    res.json({ ok: true, pendingStaff, processedStaff });
  } catch (err) {
    next(err);
  }
};

// 관리자 통계 페이지
exports.getAdminStatistics = async (req, res, next) => {
  try {
    const [totalStudents, totalStaff, universities] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'staff' }),
      User.aggregate([
        { $match: { role: 'student', university: { $ne: null } } },
        { $group: { _id: '$university', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, name: '$_id', studentCount: '$count' } }
      ])
    ]);
    res.render('pages/adminStatistics', {
      user: req.user,
      pageTitle: '통계',
      stats: {
        totalStudents,
        totalStaff,
        totalUniversities: universities.length,
        universities,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 관리자 통계 JSON (React SPA용) — getAdminStatistics와 동일 쿼리, res.json으로만 응답.
exports.getAdminStatisticsData = async (req, res, next) => {
  try {
    const [totalStudents, totalStaff, universities] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'staff' }),
      User.aggregate([
        { $match: { role: 'student', university: { $ne: null } } },
        { $group: { _id: '$university', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, name: '$_id', studentCount: '$count' } }
      ])
    ]);
    res.json({
      ok: true,
      stats: {
        totalStudents,
        totalStaff,
        totalUniversities: universities.length,
        universities,
      },
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
      { new: true }
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
exports.rejectStaff  = (req, res) => updateStaffStatus(req, res, 'rejected');

// ── 전체 사용자 관리 페이지 ─────────────────────────────

exports.getUsersData = async (req, res, next) => {
  try {
    const [staffList, studentList] = await Promise.all([
      User.find({ role: 'staff', staffStatus: 'approved' })
        .select('name email university isOnline lastLoginAt accountStatus')
        .sort({ university: 1, name: 1 })
        .lean(),
      User.find({ role: 'student' })
        .select('name email studentId major university enrollmentStatus isOnline lastLoginAt accountStatus')
        .sort({ university: 1, isOnline: -1, lastLoginAt: -1 })
        .lean(),
    ]);

    const univSet = new Set([
      ...staffList.map(u => u.university).filter(Boolean),
      ...studentList.map(u => u.university).filter(Boolean),
    ]);
    const universities = [...univSet].sort();

    const onlineCount = [...staffList, ...studentList].filter(u => u.isOnline).length;

    res.json({
      ok: true,
      universities,
      staffList,
      studentList,
      stats: {
        univCount:    universities.length,
        staffCount:   staffList.length,
        studentCount: studentList.length,
        onlineCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsersPage = async (req, res, next) => {
  try {
    const [staffList, studentList] = await Promise.all([
      User.find({ role: 'staff', staffStatus: 'approved' })
        .select('name email university isOnline lastLoginAt accountStatus')
        .sort({ university: 1, name: 1 })
        .lean(),
      User.find({ role: 'student' })
        .select('name email studentId major university enrollmentStatus isOnline lastLoginAt accountStatus')
        .sort({ university: 1, isOnline: -1, lastLoginAt: -1 })
        .lean(),
    ]);

    const univSet = new Set([
      ...staffList.map(u => u.university).filter(Boolean),
      ...studentList.map(u => u.university).filter(Boolean),
    ]);
    const universities = [...univSet].sort();

    const onlineCount = [...staffList, ...studentList].filter(u => u.isOnline).length;

    res.render('pages/adminUsers', {
      user: req.user,
      pageTitle: '사용자 관리',
      currentPage: 'adminUsers',
      universities,
      staffList,
      studentList,
      stats: {
        univCount:    universities.length,
        staffCount:   staffList.length,
        studentCount: studentList.length,
        onlineCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 사용자 상세 조회 (JSON)
exports.getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email studentId major university enrollmentStatus role staffStatus isOnline lastLoginAt lastLogoutAt accountStatus loginHistory createdAt')
      .lean();
    if (!user) return res.status(404).json({ ok: false, message: '계정을 찾을 수 없습니다.' });

    const history = (user.loginHistory || []).slice().reverse().slice(0, 10);
    res.json({ ok: true, user: { ...user, loginHistory: history } });
  } catch (err) {
    next(err);
  }
};

// 역할 변경 (student ↔ staff)
exports.changeUserRole = async (req, res, next) => {
  try {
    const { targetRole } = req.body;
    if (!['student', 'staff'].includes(targetRole)) {
      return res.status(400).json({ ok: false, message: '유효하지 않은 역할입니다.' });
    }

    const target = await User.findById(req.params.id).lean();
    if (!target) return res.status(404).json({ ok: false, message: '계정을 찾을 수 없습니다.' });
    if (target.role === 'admin') return res.status(403).json({ ok: false, message: '최고관리자 계정은 변경할 수 없습니다.' });

    if (targetRole === 'staff' && !target.university?.trim()) {
      return res.status(400).json({ ok: false, message: '소속 대학교 정보가 없어 학교관리자로 승격할 수 없습니다.' });
    }

    const update = targetRole === 'staff'
      ? { role: 'staff', staffStatus: 'approved' }
      : { role: 'student', staffStatus: null };

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    logger.info(`역할변경 | target=${updated.email} | ${target.role} → ${targetRole} | by=${req.user.email}`);
    res.json({ ok: true, role: updated.role });
  } catch (err) {
    next(err);
  }
};

// 계정 상태 변경
exports.adminChangeStatus = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['active', 'dormant', 'suspended'].includes(action)) {
      return res.status(400).json({ ok: false, message: '유효하지 않은 상태입니다.' });
    }
    const target = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: 'admin' } },
      { accountStatus: action },
      { new: true },
    ).lean();
    if (!target) return res.status(404).json({ ok: false, message: '계정을 찾을 수 없습니다.' });
    logger.info(`계정상태변경 | target=${target.email} | action=${action} | by=${req.user.email}`);
    res.json({ ok: true, accountStatus: target.accountStatus });
  } catch (err) {
    next(err);
  }
};

// 비밀번호 초기화
exports.adminResetPassword = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const tempPw = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPw, 12);
    const target = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: 'admin' } },
      { password: hashed },
    ).lean();
    if (!target) return res.status(404).json({ ok: false, message: '계정을 찾을 수 없습니다.' });
    logger.info(`비밀번호초기화 | target=${target.email} | by=${req.user.email}`);
    res.json({ ok: true, tempPassword: tempPw });
  } catch (err) {
    next(err);
  }
};

// 계정 삭제
exports.adminDeleteUser = async (req, res, next) => {
  try {
    const target = await User.findOneAndDelete({ _id: req.params.id, role: { $ne: 'admin' } }).lean();
    if (!target) return res.status(404).json({ ok: false, message: '계정을 찾을 수 없습니다.' });
    logger.info(`계정삭제 | target=${target.email} | by=${req.user.email}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

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
