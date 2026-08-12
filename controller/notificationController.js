// controller/notificationController.js
const { fetchHomeNotices } = require('./noticeController');
const dateCaculate = require('../service/dateCaculateService');
const User = require('../models/User');


//  실시간 긴급 알림 목록 반환 (D-Day 당일 ~ 7일 전 전용 + 페이징)
async function getNotifications(req, res) {
    try {
        const loggedInUser = req.user || req.session?.user;
        const currentUserId = loggedInUser?._id || loggedInUser?.id || loggedInUser?.userDoc?._id;

        // D-Day 알림을 꺼둔 사용자는 계산할 필요 없이 빈 결과 반환
        if (currentUserId) {
            const userDoc = await User.findById(currentUserId).select('notificationSettings.dDayAlert').lean();
            if (userDoc?.notificationSettings?.dDayAlert === false) {
                return res.json({ success: true, alerts: [], hasMore: false, totalCount: 0 });
            }
        }

        const allFreshNotices = await fetchHomeNotices();
        let myUrgentNotices = allFreshNotices;

        if (loggedInUser) {
            const mongoose = require('mongoose');
            const UserCertModel = mongoose.model('UserCertification');

            // 유저가 설정한 target 자격증 긁어오기
            const myCerts = await UserCertModel.find({ 
                $or: [{ userId: currentUserId }, { user: currentUserId }],
                status: 'target' 
            }).populate('certificationId', 'jmcd').lean();

            const myTargetJmCds = myCerts
                .filter(c => c.certificationId && c.certificationId.jmcd)
                .map(c => String(c.certificationId.jmcd).trim());

            // 유저 타겟 자격증 공지거나, 학사/장학금 같은 공통 공지만 남기기
            myUrgentNotices = myUrgentNotices.filter(n => {
                if (n.category === 'certification') {
                    const finalJmcd = n.jmcd || n.jmCd;
                    if (finalJmcd) {
                        return myTargetJmCds.includes(String(finalJmcd).trim());
                    }
                    return false;
                }
                return true; 
            });
        }

        // d-day~  d-7만 내보내기
       myUrgentNotices = myUrgentNotices.filter(n => {
            if (n.dDayText) {
                const text = String(n.dDayText).trim();
                return text === 'D-day' || (text.startsWith('D-') && parseInt(text.replace('D-', '')) <= 7);
            }
            return n.dDayText && !n.dDayText.includes('종료');
        });

        //페이징 처리
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // 알림창은 콤팩트하게 5개씩만!
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedAlerts = myUrgentNotices.slice(startIndex, endIndex);
        
        // 다음 페이지가 더 존재하는지 여부 
        const hasMore = endIndex < myUrgentNotices.length;

        return res.json({
            success: true,
            alerts: myUrgentNotices,
            hasMore: endIndex < myUrgentNotices.length,
            totalCount: myUrgentNotices.length
        });

    } catch (error) {
        console.error(" 알림 API 조회 에러:", error);
        return res.status(500).json({ success: false, message: "알림 조회 중 에러 발생" });
    }
}

// 알림창 끄기/삭제 처리용 (형식 유지)
async function deleteNotifications(req, res) {
    return res.json({ success: true });
}

module.exports = {
    getNotifications,
    deleteNotifications,
    getUrgentNoticesApi: getNotifications 
};