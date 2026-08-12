const mongoose = require('mongoose');

// 서버 재시작 중 끊긴 AI 생성 요청을 failed로 정리 (10분 초과 pending) +
// 7일 지난 failed 포트폴리오 문서 삭제 (이력 가치 없음, Phase 4 §8)
async function cleanupOrphanedAiJobs() {
    const { WeeklyPlan, CareerPortfolio } = require('../models/Ai');
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const staleFilter = { status: 'pending', updatedAt: { $lt: cutoff } };
    const update = { status: 'failed', errorMessage: '생성이 중단되었습니다. 다시 시도해 주세요.' };

    const failedRetentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await Promise.all([
        WeeklyPlan.updateMany(staleFilter, update),
        CareerPortfolio.updateMany(staleFilter, update),
        CareerPortfolio.deleteMany({ status: 'failed', updatedAt: { $lt: failedRetentionCutoff } }),
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
