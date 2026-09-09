// LLM이 만든 gap(부족한 역량)에 서버가 실제 일정·경로를 주입한다.
// LLM에게 날짜나 jmcd를 묻지 않는다 — 전부 여기서 결정적으로 매칭한다.

const { Certification } = require('../../models/Certifications_jobs');
const Notice = require('../../models/Notice');
const dateCaculate = require('../../service/dateCaculateService');

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

const MIN_CERT_NAME_LENGTH = 3; // "기사"처럼 너무 짧은 이름은 아무 gap에나 우연히 매칭될 위험이 큼

// gap.item(예: "정보처리기사 취득")이 certName(예: "정보처리기사")을 포함하는지만 본다.
// 예전엔 반대 방향(certName이 gap.item을 포함하는지)도 같이 봤는데, gap.item은
// "○○ 취득"처럼 항상 자격증명보다 길게 서술하도록 프롬프트 규칙(diagnosis.js)이
// 이미 강제하고 있어 실제로 반대 방향이 필요한 케이스가 없었다. 반대 방향을 열어두면
// "기사"처럼 짧은 자격증명이 관련 없는 gap에도 걸리는 부작용만 남는다.
function isNameMatch(gapItem, certName) {
  if (!gapItem || !certName) return false;
  const normalizedCertName = normalize(certName);
  if (normalizedCertName.length < MIN_CERT_NAME_LENGTH) return false;
  return normalize(gapItem).includes(normalizedCertName);
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
  // 판정 기준은 title 하나로 통일한다 — details.examType는 시드 방식에 따라 비어
  // 있을 수 있는 선택 필드라, 이걸 필기/실기 구분 기준으로 쓰면서 원서접수 여부는
  // title로 판단하는 식으로 기준이 갈리면 같은 공고를 두고 서로 다른 답이 나올 수
  // 있다(예: title엔 "필기"가 있는데 details.examType은 비어 있는 경우).
  const upcoming = notices.find(n => WRITTEN_STAGE_PATTERN.test(n.title) && !EXCLUDED_NOTICE_PATTERN.test(n.title));

  // endDate는 Notice 스키마상 "접수 마감일"이다(주석: "접수 마감 (이걸로 D-Day 계산)").
  // 원서접수 공고에선 그대로 마감일이 맞지만, 시험 공고에선 "그 공고 자체의 접수
  // 마감"으로 endDate=startDate(당일)로 시드되어 있어 우연히 시험일과 같다 — 이
  // 시드 방식이 바뀌면(예: 시험 공고에 별도 접수기간이 생기면) nextExamDate가 조용히
  // 틀려진다. isApplication 플래그로 "이 날짜가 원서접수 마감인지"를 반드시 함께
  // 확인해서 쓸 것 — 여기서 이름만 nextExamDate일 뿐 항상 "시험일"은 아니다.
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
