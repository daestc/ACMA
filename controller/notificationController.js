// controller/notificationController.js
const notificationService = require('../service/notificationService');
const noticeController = require('./noticeController'); // 공지 데이터 추출용 연결


//공지사항 가져오기
const getUrgentNoticesApi = async (req, res) => {
    try {
        const allNotices = await noticeController.fetchHomeNotices();
        // 임박한 긴급 공지만 보냄
        const urgentNotices = allNotices.filter(n => n.isUrgent === true);
        return res.json(urgentNotices);
    } catch (error) {
        console.error(" 알림 API 전송 에러:", error.message);
        return res.status(500).json({ error: "알림 데이터를 가져오지 못했습니다." });
    }
};


//알림 가져오기
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const liveAlerts = await notificationService.getBannerData(userId);
       
        res.json({
            success: true,
            liveAlerts: liveAlerts
        });
    } catch (error) {
        next(error);
    }
};


//알림 전체 삭제
const deleteNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        await notificationService.deleteNotifications(userId);
        res.json({ message: '알림이 전부 삭제되었습니다' });
    } catch (error) {
        next(error);   
    }
};

module.exports = {
    getUrgentNoticesApi,
    getNotifications,
    deleteNotifications
};