const { CareerPortfolio } = require('../../models/Ai');
const { Job } = require('../../models/Certifications_jobs');
const portfolioPrompt = require('./prompts/portfolio');
const aiClient = require('./aiClient');
const validator = require('./validator');
const readinessService = require('./readinessService');
const missingAnalyzer = require('./missingAnalyzer');
const retentionService = require('./retentionService');
const logger = require('../../config/logger');

const GENERIC_FAILURE_MESSAGE = '생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
const MAX_DONE_DOCS_PER_USER = 10;

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
 * 포트폴리오 생성 전체 흐름. 컨트롤러의 백그라운드(setImmediate)에서 호출된다.
 * context는 컨트롤러가 readiness 체크 때 이미 만든 걸 그대로 받는다 —
 * buildPortfolioContext를 컨트롤러/서비스 양쪽에서 중복 호출하지 않기 위함.
 */
async function generatePortfolio(docId, userId, context) {
  const missing = missingAnalyzer.analyzeMissing(context);
  const readiness = readinessService.checkReadiness(context);

  try {
    const facts = validator.collectEvidenceFacts(context);

    const { data, meta } = await aiClient.generateJSON({
      system: portfolioPrompt.buildSystem(),
      user: portfolioPrompt.buildUser(context, facts),
      schema: portfolioPrompt.buildOutputSchema(facts),
    });

    const { valid, sanitized, errors: validationErrors } = validator.validatePortfolio(data, context);
    if (!valid) {
      logger.error(
        `[ai] portfolio validation failed (docId=${docId}): reasons=${JSON.stringify(validationErrors)} `
        + `shape=${JSON.stringify(data && typeof data === 'object' ? Object.keys(data) : typeof data)}`,
      );
      await CareerPortfolio.findByIdAndUpdate(docId, {
        status: 'failed',
        errorMessage: GENERIC_FAILURE_MESSAGE,
        readinessScore: readiness.total,
        missing,
      });
      return;
    }

    const targetJob = await Job.findOne({ userId, status: 'target' }).select('jobCode title').lean();

    await CareerPortfolio.findByIdAndUpdate(docId, {
      status: 'done',
      errorMessage: null,
      jobCode: targetJob?.jobCode || null,
      jobTitle: targetJob?.title || null,
      summary: sanitized.summary,
      sections: sanitized.sections,
      readinessScore: readiness.total,
      missing,
      generation: buildGenerationMeta(meta, portfolioPrompt.VERSION),
    });

    await retentionService.enforceRetention(CareerPortfolio, userId, MAX_DONE_DOCS_PER_USER);
  } catch (error) {
    logger.error(`[ai] portfolio generation failed (docId=${docId}): ${error.message}`);
    await CareerPortfolio.findByIdAndUpdate(docId, {
      status: 'failed',
      errorMessage: GENERIC_FAILURE_MESSAGE,
      readinessScore: readiness.total,
      missing,
    }).catch(() => {});
  }
}

module.exports = { generatePortfolio };
