const { CareerDiagnosis } = require('../../models/Ai');
const { Job } = require('../../models/Certifications_jobs');
const diagnosisPrompt = require('./prompts/diagnosis');
const aiClient = require('./aiClient');
const validator = require('./validator');
const readinessService = require('./readinessService');
const missingAnalyzer = require('./missingAnalyzer');
const gapLinker = require('./gapLinker');
const retentionService = require('./retentionService');
const logger = require('../../config/logger');

const GENERIC_FAILURE_MESSAGE = '생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
const MAX_DONE_DOCS_PER_USER = 10; // portfolioService.js와 동일 상한(Phase 4 §8)

function buildGenerationMeta(meta, promptVersion) {
  return {
    model: meta.model,
    promptVersion,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    latencyMs: meta.latencyMs,
    retryCount: meta.retryCount,
  };
}

/**
 * 진단 생성 전체 흐름. 컨트롤러의 백그라운드(setImmediate)에서 호출된다.
 * context는 컨트롤러가 readiness 체크 때 이미 만든 걸 그대로 받는다(portfolioService와
 * 동일한 이유 — buildPortfolioContext 중복 호출 방지).
 */
async function generateDiagnosis(docId, userId, context) {
  // scores/missing은 LLM과 무관하게 결정적으로 계산되므로, 아래에서 무엇이 실패하든
  // 항상 저장된다 — "LLM이 실패해도 최소한 뭐가 부족한지는 보여줘야 한다"가 이 Phase의
  // 핵심 요구사항이다.
  const missing = missingAnalyzer.analyzeMissing(context);
  const scores = readinessService.checkReadiness(context);

  try {
    const facts = validator.collectEvidenceFacts(context);

    const { data, meta } = await aiClient.generateJSON({
      system: diagnosisPrompt.buildSystem(),
      user: diagnosisPrompt.buildUser(context, facts),
      schema: diagnosisPrompt.buildOutputSchema(facts),
    });

    const { valid, sanitized, errors: validationErrors } = validator.validateDiagnosis(data, context);
    if (!valid) {
      logger.error(
        `[ai] diagnosis validation failed (docId=${docId}): reasons=${JSON.stringify(validationErrors)} `
        + `shape=${JSON.stringify(data && typeof data === 'object' ? Object.keys(data) : typeof data)}`,
      );
      await CareerDiagnosis.findByIdAndUpdate(docId, {
        status: 'failed',
        errorMessage: GENERIC_FAILURE_MESSAGE,
        'scores.total': scores.total,
        'scores.breakdown': scores.breakdown,
        missing,
      });
      return;
    }

    const gaps = await gapLinker.linkGapsToActions(sanitized.gaps, context);
    const targetJob = await Job.findOne({ userId, status: 'target' }).select('jobCode title').lean();

    await CareerDiagnosis.findByIdAndUpdate(docId, {
      status: 'done',
      errorMessage: null,
      jobCode: targetJob?.jobCode || null,
      jobTitle: targetJob?.title || null,
      overview: sanitized.overview,
      strengths: sanitized.strengths,
      gaps,
      'scores.total': scores.total,
      'scores.breakdown': scores.breakdown,
      missing,
      generation: buildGenerationMeta(meta, diagnosisPrompt.VERSION),
    });

    await retentionService.enforceRetention(CareerDiagnosis, userId, MAX_DONE_DOCS_PER_USER);
  } catch (error) {
    logger.error(`[ai] diagnosis generation failed (docId=${docId}): ${error.message}`);
    await CareerDiagnosis.findByIdAndUpdate(docId, {
      status: 'failed',
      errorMessage: GENERIC_FAILURE_MESSAGE,
      'scores.total': scores.total,
      'scores.breakdown': scores.breakdown,
      missing,
    }).catch(() => {});
  }
}

module.exports = { generateDiagnosis };
