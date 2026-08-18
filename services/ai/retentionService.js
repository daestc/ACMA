// portfolioService.js/diagnosisService.js가 공유하는 생성 이력 정리 로직.
// 최근 이력은 참고 가치가 있어(예: 지난 진단과 비교) 전부 지우지 않지만, 무한정
// 쌓아두면 조회 비용도 늘고 정리도 안 되므로 사용자당 최신 N개만 남긴다(Phase 4 §8).
const logger = require('../../config/logger');

async function enforceRetention(Model, userId, maxDocs) {
  try {
    const staleDocs = await Model.find({ userId, status: 'done' })
      .select('_id')
      .sort({ createdAt: -1 })
      .skip(maxDocs)
      .lean();

    if (staleDocs.length > 0) {
      await Model.deleteMany({ _id: { $in: staleDocs.map(d => d._id) } });
    }
  } catch (error) {
    logger.error(`[ai] retention cleanup failed (model=${Model.modelName}, userId=${userId}): ${error.message}`);
  }
}

module.exports = { enforceRetention };
