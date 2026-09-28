// AI 진로 추천 (FR-AI-005). 1단계는 AI 없이 recommendScorer의 점수로 후보 10개와 picks 3개를
// 만든다. 2단계(커밋 7)에서 generateRecommendation이 후보 안에서 3개를 골라 설명을 붙인다.

const { CareerRecommendation } = require('../../models/Ai');
const { JobCatalog } = require('../../models/JobCatalog');
const { Job } = require('../../models/Certifications_jobs');
const contextBuilder = require('./contextBuilder');
const scorer = require('./recommendScorer');
const gapLinker = require('./gapLinker');
const retentionService = require('./retentionService');
const careerService = require('../careerService');

const CATALOG_QUERY = { source: 'jobInfo', syncError: '' };
const SCORING_FIELDS = 'jobCode title jobLrclNm jobMdclNm knowledge abilities characteristics '
  + 'relatedDepartments relatedCertifications certNames averageSalary';
const PICK_COUNT = 3;
const CERT_GAP_LIMIT = 2;
const CATEGORY_EXAMPLE_COUNT = 3;
const RETENTION_LIMIT = 10;
// 서버 재시작으로 setImmediate 작업이 사라지면 pending이 영구히 남는다(계획서 §3-7).
// AI 생성 최악 소요 368초에 여유를 둔 값.
const PENDING_TTL_MS = 10 * 60 * 1000;
const EXPIRED_MESSAGE = '생성이 중단되었습니다. 다시 시도해주세요.';

async function expireStalePending(userId) {
  await CareerRecommendation.updateMany(
    { userId, status: 'pending', createdAt: { $lt: new Date(Date.now() - PENDING_TTL_MS) } },
    { $set: { status: 'failed', errorMessage: EXPIRED_MESSAGE } },
  );
}

// 관심분야 선택지: 대분류(jobLrclNm)별 직무 수 + 직무가 많은 중분류 예시.
// "IT" 대분류가 없고 소프트웨어 개발자가 "연구직 및 공학 기술직" 안에 있어서 예시가 필요하다.
async function getInterestCategories() {
  const rows = await JobCatalog.aggregate([
    { $match: CATALOG_QUERY },
    { $group: { _id: { l: '$jobLrclNm', m: '$jobMdclNm' }, n: { $sum: 1 } } },
  ]);

  const byLarge = new Map();
  rows.forEach(({ _id, n }) => {
    if (!_id.l) return;
    const entry = byLarge.get(_id.l) || { name: _id.l, jobCount: 0, mids: [] };
    entry.jobCount += n;
    if (_id.m) entry.mids.push({ name: _id.m, n });
    byLarge.set(_id.l, entry);
  });

  return [...byLarge.values()]
    .map(({ name, jobCount, mids }) => ({
      name,
      jobCount,
      examples: mids
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
        .slice(0, CATEGORY_EXAMPLE_COUNT)
        .map(m => m.name),
    }))
    .sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name));
}

async function getForm(userId) {
  await expireStalePending(userId);
  const [categories, last] = await Promise.all([
    getInterestCategories(),
    CareerRecommendation.findOne({ userId }).sort({ createdAt: -1 }).select('prefs interests').lean(),
  ]);
  return {
    questions: scorer.PREF_OPTIONS,
    categories,
    last: last ? { prefs: scorer.sanitizePrefs(last.prefs), interests: last.interests || [] } : null,
  };
}

// 틀린 관심분야 이름은 400이 아니라 조용히 버린다.
function sanitizeInterests(raw, categories) {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(categories.map(c => c.name));
  return [...new Set(raw.filter(name => valid.has(name)))];
}

async function buildCandidates(userId, prefs, interests) {
  const context = await contextBuilder.buildUserContext(userId);
  const signals = scorer.extractUserSignals(context);

  const query = interests.length > 0 ? { ...CATALOG_QUERY, jobLrclNm: { $in: interests } } : CATALOG_QUERY;
  const jobs = await JobCatalog.find(query).select(SCORING_FIELDS).lean();

  const candidates = scorer.rankCandidates(signals, prefs, jobs, { limit: 10, perMidClass: 3 });
  const confidence = scorer.calcConfidence(signals, prefs);
  const jobsByCode = new Map(jobs.map(job => [job.jobCode, job]));
  return { context, candidates, confidence, jobsByCode };
}

const MIN_CERT_NAME_LENGTH = 3; // gapLinker와 같은 기준 — "기사"처럼 짧은 조각은 자격증명이 아니다

function toCertGap(name, match) {
  return {
    name,
    jmcd: match?.jmcd || null,
    nextExamDate: match?.nextExamDate || null,
    dDay: match?.dDay ?? null,
    isApplication: match?.isApplication || false,
  };
}

// picks마다 "직무 관련 자격증 − 보유 자격증" 중 2개에 다음 필기 일정을 붙인다.
// certNames는 norm된 값이라 Certification.name과 비교할 수 없어서, relatedCertifications를
// expandCert한 원래 표기로 조회한다. 목록 앞쪽에 MCSD·DB2 같은 외국 자격증이 오는 직무가 많아
// 단순히 앞의 2개를 고르면 일정이 전혀 안 붙는다 — Certification에 있는 것을 먼저 채우고,
// 모자라면 없는 것으로 채운다.
async function attachCertGaps(picks, context, jobsByCode) {
  const held = scorer.extractUserSignals(context).certIndex;
  for (const pick of picks) {
    const job = jobsByCode.get(pick.jobCode);
    const missing = [...new Set((job?.relatedCertifications || []).flatMap(scorer.expandCert))]
      .filter(name => name.length >= MIN_CERT_NAME_LENGTH && !held.has(scorer.norm(name)));

    const found = [];
    const unknown = [];
    for (const name of missing) {
      if (found.length >= CERT_GAP_LIMIT) break;
      const match = await gapLinker.findDirectCertMatch(name);
      if (match) found.push(toCertGap(name, match));
      else unknown.push(toCertGap(name, null));
    }
    pick.certGaps = [...found, ...unknown].slice(0, CERT_GAP_LIMIT);
  }
  return picks;
}

function toScorePicks(candidates) {
  return candidates.slice(0, PICK_COUNT).map(c => ({
    jobCode: c.jobCode,
    title: c.title,
    jobMdclNm: c.jobMdclNm,
    angle: null,
    reason: null,
    evidence: [],
    source: 'score',
    certGaps: [],
  }));
}

/**
 * @returns {{ httpStatus: number, body: object }}
 */
async function requestRecommendation(userId, rawPrefs, rawInterests) {
  await expireStalePending(userId);
  const pending = await CareerRecommendation.findOne({ userId, status: 'pending' }).select('_id').lean();
  if (pending) {
    return { httpStatus: 409, body: { success: false, message: '이미 생성 중인 추천이 있습니다.' } };
  }

  const prefs = scorer.sanitizePrefs(rawPrefs);
  const categories = await getInterestCategories();
  const interests = sanitizeInterests(rawInterests, categories);

  const { context, candidates, confidence, jobsByCode } = await buildCandidates(userId, prefs, interests);

  // 입력이 적은 학생에게는 관심분야를 한 번만 묻는다. 이미 골랐는데도 low면 결과에 "참고용"만 붙인다.
  if (confidence === 'low' && interests.length === 0) {
    return { httpStatus: 200, body: { status: 'needs_interests', categories } };
  }

  const picks = await attachCertGaps(toScorePicks(candidates), context, jobsByCode);
  const doc = await CareerRecommendation.create({
    userId, status: 'done', prefs, interests, confidence, candidates, picks,
  });
  await retentionService.enforceRetention(CareerRecommendation, userId, RETENTION_LIMIT);

  return { httpStatus: 200, body: { id: doc._id, status: 'done', data: doc.toObject() } };
}

async function getRecommendation(userId, docId) {
  await expireStalePending(userId);
  const doc = await CareerRecommendation.findById(docId).lean();
  if (!doc || String(doc.userId) !== String(userId)) return null;
  return doc;
}

// 2단계에서 AI가 실패해도 후보·점수 picks가 남은 failed 문서는 화면에 보여준다(계획서 §7-13).
async function getLatestRecommendation(userId) {
  await expireStalePending(userId);
  return CareerRecommendation.findOne({
    userId,
    status: { $in: ['done', 'failed'] },
    'candidates.0': { $exists: true },
  }).sort({ createdAt: -1 }).lean();
}

/**
 * 추천 후보 중 하나를 목표 직무로 설정한다.
 * @returns {{ httpStatus: number, body: object }}
 */
async function selectJob(userId, docId, jobCode) {
  const doc = await CareerRecommendation.findById(docId).select('userId candidates').lean();
  if (!doc || String(doc.userId) !== String(userId)) {
    return { httpStatus: 404, body: { success: false } };
  }
  // 임의의 jobCode로 목표 직무를 바꾸는 통로가 되지 않게, 그 문서의 후보만 허용한다.
  if (!(doc.candidates || []).some(c => c.jobCode === jobCode)) {
    return { httpStatus: 400, body: { success: false, message: '추천 후보에 없는 직무입니다.' } };
  }

  let saved;
  try {
    saved = await careerService.saveCareerDetails(jobCode, { _id: userId }, 'target');
  } catch (error) {
    saved = null;
  }
  if (!saved) {
    return { httpStatus: 502, body: { success: false, message: '직무 정보를 불러오지 못했습니다.' } };
  }

  // 대표 직업 코드는 2차 API가 비어 saveCareerDetails가 하는 일을 못 채운다(계획서 §3-4).
  // 진단의 gaps가 하는 일 대비로 판단하므로 카탈로그 값으로 보충한다. saveCareerDetails는 고치지 않는다.
  if (!(saved.responsibilities || []).length) {
    const catalog = await JobCatalog.findOne({ jobCode }).select('responsibilities').lean();
    if (catalog?.responsibilities?.length) {
      await Job.updateOne({ userId, jobCode }, { $set: { responsibilities: catalog.responsibilities } });
    }
  }

  await CareerRecommendation.updateOne(
    { _id: docId },
    { $set: { selectedJobCode: jobCode, selectedAt: new Date() } },
  );
  return { httpStatus: 200, body: { success: true, redirect: '/career/diagnosis' } };
}

module.exports = {
  getForm,
  getInterestCategories,
  buildCandidates,
  attachCertGaps,
  requestRecommendation,
  getRecommendation,
  getLatestRecommendation,
  selectJob,
};
