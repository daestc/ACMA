const express = require('express');
const router = express.Router();
const noticeController = require('../controller/noticeController');


router.get('/', noticeController.getNoticePage);

/**
 * 2. 🔔 실시간 알림 데이터 API 완벽 방어벽
 * 프론트엔드가 어떤 주소로 노크하든 상관없이 전부 다 데이터를 뱉어내도록 통로를 여러 개 뚫어둡니다!
 */
const handleUrgentRequest = async (req, res) => {
    try {
        const allNotices = await noticeController.fetchHomeNotices();
        // 긴급 공지(isUrgent === true)만 필터링
        const urgentNotices = allNotices.filter(n => n.isUrgent === true);
        
        // 브라우저에게 JSON 데이터로 토스 📦
        return res.json(urgentNotices);
    } catch (error) {
        console.error("🚨 알림 API 전송 에러:", error.message);
        return res.status(500).json({ error: "알림 데이터를 가져오지 못했습니다." });
    }
};

// 💡 프론트가 부를 수 있는 예상 주소 후보들을 싹 다 등록해버리기!
router.get('/urgent', handleUrgentRequest);           // (현재 정석 경로)
router.get('/api/urgent', handleUrgentRequest);       // (혹시 모를 대안 경로 1)
router.get('/home/api/urgent', handleUrgentRequest);  // (옛날 프론트 경로 복원)



module.exports = router;