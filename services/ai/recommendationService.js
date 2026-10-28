// AI 진로 추천 (FR-AI-005). recommendScorer가 점수로 후보 10개와 점수 기준 picks 3개를 만들고,
// generateRecommendation이 백그라운드에서 AI로 그 후보 안에서 3개를 골라 angle·사유를 붙인다.
// AI가 실패해도 후보와 점수 picks는 남는다.

const { CareerRecommendation } = require('../../models/Ai');
const { JobCatalog } = require('../../models/JobCatalog');
const { Job } = require('../../models/Certifications_jobs');
const contextBuilder = require('./contextBuilder');
const scorer = require('./recommendScorer');
const gapLinker = require('./gapLinker');
const retentionService = require('./retentionService');
const aiClient = require('./aiClient');
const validator = require('./validator');
const recommendationPrompt = require('./prompts/recommendation');
const careerService = require('../careerService');
const logger = require('../../config/logger');

const CATALOG_QUERY = { source: 'jobInfo', syncError: '' };
const SCORING_FIELDS = 'jobCode title jobLrclNm jobMdclNm knowledge abilities characteristics '
  + 'relatedDepartments relatedCertifications certNames averageSalary summary';
const GENERIC_FAILURE_MESSAGE = 'AI 추천 사유 생성에 실패했습니다. 점수 기준 추천을 보여드립니다.';
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

// Certification.name은 "컴퓨터활용능력1급"처럼 붙여 쓴 경우가 있어 공백을 뺀 이름으로 한 번 더 찾는다.
async function findCertMatch(name) {
  const compactName = name.replace(/\s+/g, '');
  return await gapLinker.findDirectCertMatch(name)
    || (compactName !== name ? gapLinker.findDirectCertMatch(compactName) : null);
}

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
      const match = await findCertMatch(name);
      if (match) found.push(toCertGap(name, match));
      else unknown.push(toCertGap(name, null));
    }
    pick.certGaps = [...found, ...unknown].slice(0, CERT_GAP_LIMIT);
  }
  return picks;
}

function toScorePicks(candidates) {
  return scorer.pickDiverse(candidates, PICK_COUNT).map(c => ({
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

  const scorePicks = await attachCertGaps(toScorePicks(candidates), context, jobsByCode);

  // 후보가 3개 미만이면 AI가 고를 게 없다 — 있는 만큼 점수 기준으로 바로 끝낸다.
  if (candidates.length < PICK_COUNT) {
    const doc = await CareerRecommendation.create({
      userId, status: 'done', prefs, interests, confidence, candidates, picks: scorePicks,
    });
    await retentionService.enforceRetention(CareerRecommendation, userId, RETENTION_LIMIT);
    return { httpStatus: 200, body: { id: doc._id, status: 'done', data: doc.toObject() } };
  }

  // pending 문서에도 후보와 점수 picks를 먼저 저장한다 — AI가 실패하거나 서버가 중간에 죽어도
  // 화면에 보여줄 계산값이 남는다.
  const doc = await CareerRecommendation.create({
    userId, status: 'pending', prefs, interests, confidence, candidates, picks: scorePicks,
  });
  setImmediate(() => {
    generateRecommendation(doc._id, userId, context, candidates, prefs, jobsByCode).catch(error => {
      logger.error(`[ai] recommendation background crash (docId=${doc._id}): ${error.message}`);
    });
  });
  return { httpStatus: 202, body: { id: doc._id, status: 'pending' } };
}

// 체크리스트 응답을 한글 문구로 — matched.prefs와 같은 접두어라 근거 목록과 화면 칩이 일치한다.
// style 'any'는 점수에도 안 쓰이는 "상관없음"이라 근거로 넣지 않는다. prefs는 sanitizePrefs를 거친 값.
function buildPrefLabels(prefs) {
  const label = (question, key) => scorer.PREF_OPTIONS[question].options.find(o => o.key === key).label;
  return [
    ...(prefs?.work || []).map(key => `선호: ${label('work', key)}`),
    ...(prefs?.style && prefs.style !== 'any' ? [`방식: ${label('style', prefs.style)}`] : []),
    ...(prefs?.value ? [`중시: ${label('value', prefs.value)}`] : []),
  ];
}

function buildGenerationMeta(meta) {
  return {
    model: meta.model,
    promptVersion: recommendationPrompt.VERSION,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    latencyMs: meta.latencyMs,
    retryCount: meta.retryCount,
  };
}

/**
 * 후보 안에서 AI가 3개를 골라 angle·사유·근거를 붙인다. requestRecommendation의 setImmediate에서 호출.
 * 실패하면 status만 failed로 바꾼다 — candidates와 점수 picks는 pending 저장 때 이미 들어 있다.
 */
async function generateRecommendation(docId, userId, context, candidates, prefs, jobsByCode) {
  try {
    const prefLabels = buildPrefLabels(prefs);
    // 공용 collectEvidenceFacts는 진단·포트폴리오와 공유하므로 고치지 않고, 체크리스트 문구는 여기서만 합친다.
    const facts = [...new Set([...validator.collectEvidenceFacts(context), ...prefLabels])];
    const candidateCodes = candidates.map(c => c.jobCode);

    const { data, meta } = await aiClient.generateJSON({
      system: recommendationPrompt.buildSystem(),
      user: recommendationPrompt.buildUser(context, candidates, jobsByCode, prefLabels, facts),
      schema: recommendationPrompt.buildOutputSchema(candidateCodes, facts),
    });

    const { picks, errors } = validator.validateRecommendation(data, candidates, facts);
    if (errors.length) logger.warn(`[ai] recommendation validation (docId=${docId}): ${JSON.stringify(errors)}`);

    await attachCertGaps(picks, context, jobsByCode);
    await CareerRecommendation.findByIdAndUpdate(docId, {
      status: 'done',
      errorMessage: null,
      picks,
      generation: buildGenerationMeta(meta),
    });
    await retentionService.enforceRetention(CareerRecommendation, userId, RETENTION_LIMIT);
  } catch (error) {
    logger.error(`[ai] recommendation generation failed (docId=${docId}): ${error.message}`);
    await CareerRecommendation.findByIdAndUpdate(docId, {
      status: 'failed',
      errorMessage: GENERIC_FAILURE_MESSAGE,
    }).catch(() => {});
  }
}

// 형식이 틀린 id로 findById를 부르면 CastError가 나서 500이 된다 — 없는 문서와 같이 404로 본다.
const isObjectIdString = id => /^[a-f\d]{24}$/i.test(String(id || ''));

async function getRecommendation(userId, docId) {
  if (!isObjectIdString(docId)) return null;
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

// Certification DB에서 찾히는 것을 앞으로, 나머지를 뒤로 — 각 그룹 안의 순서는 유지한다.
async function sortCertsByKnown(names) {
  const known = [];
  const unknown = [];
  for (const name of names) {
    ((await findCertMatch(name)) ? known : unknown).push(name);
  }
  return [...known, ...unknown];
}

/**
 * 추천 후보 중 하나를 목표 직무로 설정한다.
 * @returns {{ httpStatus: number, body: object }}
 */
async function selectJob(userId, docId, jobCode) {
  if (!isObjectIdString(docId)) return { httpStatus: 404, body: { success: false } };
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

  // saveCareerDetails는 고치지 않고(진로 페이지가 쓴다) 저장 직후 카탈로그 값으로 보정한다.
  // - responsibilities: 대표 직업 코드는 2차 API가 비어 못 채운다(계획서 §3-4). 진단 gaps가 하는 일
  //   대비로 판단하므로 비었을 때만 보충한다.
  // - relatedCertifications: 1차 API 원문("OCP(외국)", "정보처리기능사, 산업기사, 기사(국가기술)")이
  //   그대로 저장돼 진단 gap 문장과 gapLinker 매칭까지 원문 표기가 새므로 파싱된 값으로 항상 덮어쓴다.
  //   Certification DB에 있는 것(일정·jmcd를 붙일 수 있는 것)을 앞으로 둔다 — 진단 프롬프트가 앞쪽
  //   자격증을 먼저 제안하는 경향이 있어, DB2 같은 외국 자격증이 앞에 있으면 일정 없는 gap이 나온다.
  const catalog = await JobCatalog.findOne({ jobCode }).select('responsibilities relatedCertifications').lean();
  if (catalog) {
    const patch = { relatedCertifications: await sortCertsByKnown(catalog.relatedCertifications || []) };
    if (!(saved.responsibilities || []).length && catalog.responsibilities?.length) {
      patch.responsibilities = catalog.responsibilities;
    }
    await Job.updateOne({ userId, jobCode }, { $set: patch });
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
  generateRecommendation,
  getRecommendation,
  getLatestRecommendation,
  selectJob,
};
