const { UserCertification } = require('../../models/Certifications_jobs');
const Notice = require('../../models/Notice');
const dateCaculate = require('../dateCalculateService');

// 목표(target) 자격증이 걸린 다가오는 Q-net 일정 (결과발표 제외)
async function getUpcomingCertSchedule(userId, limit = 12) {
  const targets = await UserCertification.find({ userId, status: 'target' })
    .populate('certificationId', 'jmcd name')
    .lean();

  const jmcds = targets.map(c => c.certificationId?.jmcd).filter(Boolean);
  if (!jmcds.length) return [];

  // endDate >= 오늘 자정으로 제한한다. 이 필터가 없으면 해당 자격증의 지난 회차
  // 공고(이미 마감된 endDate)가 "가장 빠른 일정"으로 뽑혀 dDay가 음수로 나가고,
  // gapLinker.findCertScheduleMatch를 거쳐 "D--242"처럼 마이너스가 겹쳐 보이는
  // 화면 버그로 이어졌다(실제 발생) — findDirectCertMatch의 폴백 조회는 처음부터
  // 이 조건을 걸고 있었으나 이 주 조회 경로만 빠져 있었다.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const notices = await Notice.find({
    category: 'certification',
    jmcd: { $in: jmcds },
    isPublished: true,
    endDate: { $ne: null, $gte: startOfToday },
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
