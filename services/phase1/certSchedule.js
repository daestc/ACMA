const { UserCertification } = require('../../models/Certifications_jobs');
const Notice = require('../../models/Notice');
const dateCaculate = require('../../service/dateCaculateService');

// 목표(target) 자격증이 걸린 다가오는 Q-net 일정 (결과발표 제외)
async function getUpcomingCertSchedule(userId, limit = 12) {
  const targets = await UserCertification.find({ userId, status: 'target' })
    .populate('certificationId', 'jmcd name')
    .lean();

  const jmcds = targets.map(c => c.certificationId?.jmcd).filter(Boolean);
  if (!jmcds.length) return [];

  const notices = await Notice.find({
    category: 'certification',
    jmcd: { $in: jmcds },
    isPublished: true,
    endDate: { $ne: null },
  }).sort({ endDate: 1 }).limit(limit * 2).lean();

  return notices
    .filter(n => !n.title.includes('결과발표'))
    .slice(0, limit)
    .map(n => ({
      jmcd: n.jmcd,
      certName: targets.find(t => t.certificationId?.jmcd === n.jmcd)?.certificationId?.name || n.title,
      round: n.details?.round || null,
      examType: n.details?.examType || null,
      isApplication: n.title.includes('원서접수'),
      date: n.endDate,
      dDay: dateCaculate.getRemainingDays(n.endDate),
    }));
}

module.exports = { getUpcomingCertSchedule };
