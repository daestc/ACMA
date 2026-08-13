const mongoose = require('mongoose');

// 서버 재시작 중 끊긴 AI 생성 요청을 failed로 정리 (10분 초과 pending) +
// 7일 지난 failed 문서 삭제 (조치 안 하면 계속 쌓이기만 함, Phase 4 §8).
// CareerDiagnosis는 WeeklyPlan/CareerPortfolio와 같은 생성 흐름(pending→done|failed)을
// 쓰는데 이 정리 대상에서 빠져 있었다 — 셋 다 동일하게 처리한다.
async function cleanupOrphanedAiJobs() {
    const { WeeklyPlan, CareerPortfolio, CareerDiagnosis } = require('../models/Ai');
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const staleFilter = { status: 'pending', updatedAt: { $lt: cutoff } };
    const update = { status: 'failed', errorMessage: '생성이 중단되었습니다. 다시 시도해 주세요.' };

    const failedRetentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await Promise.all([
        WeeklyPlan.updateMany(staleFilter, update),
        CareerPortfolio.updateMany(staleFilter, update),
        CareerDiagnosis.updateMany(staleFilter, update),
        CareerPortfolio.deleteMany({ status: 'failed', updatedAt: { $lt: failedRetentionCutoff } }),
        CareerDiagnosis.deleteMany({ status: 'failed', updatedAt: { $lt: failedRetentionCutoff } }),
    ]);
}

//DB 연결
const connectDB = async() =>{
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB 연결 성공');
        await cleanupOrphanedAiJobs();
    } catch (error) {
        console.error('DB 연결 실패', error);
        process.exit(1);
    }
};

module.exports = connectDB;
