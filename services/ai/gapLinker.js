// LLM이 만든 gap(부족한 역량)에 서버가 실제 일정·경로를 주입한다.
// LLM에게 날짜나 jmcd를 묻지 않는다 — 전부 여기서 결정적으로 매칭한다.

const { Certification } = require('../../models/Certifications_jobs');
const Notice = require('../../models/Notice');
const dateCaculate = require('../../service/dateCaculateService');

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

// 양방향 부분포함 매칭 — Notice 제목(certSchedule[].certName)이 gap.item보다 길 수도
// (예: "2026년 정보처리기사 필기") 짧을 수도 있어 한쪽만 보면 놓친다.
function isNameMatch(a, b) {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na);
}

function findCertScheduleMatch(gapItem, certSchedule) {
  const candidates = (certSchedule || []).filter(c => isNameMatch(gapItem, c.certName));
  if (candidates.length === 0) return null;
  return candidates.reduce((min, c) => (c.dDay < min.dDay ? c : min));
}

function findRelatedCertName(gapItem, relatedCertifications) {
  return (relatedCertifications || []).find(name => isNameMatch(gapItem, name)) || null;
}

const WRITTEN_STAGE_PATTERN = /필기/;
const EXCLUDED_NOTICE_PATTERN = /결과발표|합격자/;

// context.certSchedule은 UserCertification(status:'target')에서 나온다 — 즉 사용자가
// "이미 자기 트래커에 등록해둔" 자격증의 일정만 담는다. gap은 정의상 아직 취득도
// 목표 등록도 안 한 자격증을 가리키므로, certSchedule에서는 구조적으로 못 찾는다.
// Certification/Notice를 직접 조회해 jmcd·다음 시험 일정을 찾는 폴백이 필요하다.
async function findDirectCertMatch(certName) {
  const cert = await Certification.findOne({ name: certName }).select('jmcd name').lean();
  if (!cert?.jmcd) return null;

  const notices = await Notice.find({
    category: 'certification',
    jmcd: cert.jmcd,
    isPublished: true,
    endDate: { $ne: null, $gte: new Date() },
  }).sort({ endDate: 1 }).lean();

  // 이 폴백은 해당 자격증에 대한 UserCertification 기록 자체가 없는(=진행 상태를
  // 전혀 모르는) 경우에만 탄다. 실기는 필기 합격자만 응시할 수 있으므로, 필기 합격
  // 여부를 확인할 방법이 없는 이상 실기 일정을 다음 행동으로 안내하면 안 된다 —
  // 안전하게 필기 단계(원서접수/시험, 결과발표 제외)만 후보로 삼는다.
  const upcoming = notices.find(n => {
    const label = n.details?.examType || n.title;
    return WRITTEN_STAGE_PATTERN.test(label) && !EXCLUDED_NOTICE_PATTERN.test(n.title);
  });

  return {
    jmcd: cert.jmcd,
    certName: cert.name,
    nextExamDate: upcoming?.endDate || null,
    dDay: upcoming ? dateCaculate.getRemainingDays(upcoming.endDate) : null,
    examType: upcoming?.details?.examType || null,
    isApplication: upcoming ? upcoming.title.includes('원서접수') : false,
  };
}

/**
 * @param {Array<{item, reason, severity, actionType}>} gaps validateDiagnosis가 정제한 gaps
 * @param {object} context buildPortfolioContext(userId) 결과 (certSchedule, targetJob 사용)
 * @returns {Promise<Array>} relatedCertJmcd/relatedCertName/nextExamDate/dDay가 보강된 gaps
 */
async function linkGapsToActions(gaps, context) {
  const linked = [];

  for (const gap of (gaps || [])) {
    if (gap.actionType !== 'cert') {
      linked.push(gap);
      continue;
    }

    const scheduleMatch = findCertScheduleMatch(gap.item, context?.certSchedule);
    if (scheduleMatch) {
      linked.push({
        ...gap,
        relatedCertJmcd: scheduleMatch.jmcd || null,
        relatedCertName: scheduleMatch.certName || null,
        nextExamDate: scheduleMatch.date || null,
        dDay: scheduleMatch.dDay ?? null,
        examType: scheduleMatch.examType || null,
        isApplication: Boolean(scheduleMatch.isApplication),
      });
      continue;
    }

    // certSchedule(사용자가 이미 등록한 target 일정)에 없으면 목표 직무의 관련
    // 자격증 이름과 매칭한 뒤, Certification/Notice를 직접 조회해 jmcd·일정을 찾는다.
    const relatedName = findRelatedCertName(gap.item, context?.targetJob?.relatedCertifications);
    if (relatedName) {
      const direct = await findDirectCertMatch(relatedName);
      if (direct) {
        linked.push({
          ...gap,
          relatedCertJmcd: direct.jmcd,
          relatedCertName: direct.certName,
          nextExamDate: direct.nextExamDate,
          dDay: direct.dDay,
          examType: direct.examType,
          isApplication: direct.isApplication,
        });
        continue;
      }
      linked.push({ ...gap, relatedCertName: relatedName });
      continue;
    }

    // 매칭 실패해도 gap 자체는 그대로 둔다 — actionType을 강등하지 않는다.
    linked.push(gap);
  }

  return linked;
}

module.exports = { linkGapsToActions };
