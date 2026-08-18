// controller/notificationController.js
const { fetchHomeNotices } = require('./noticeController'); 
const dateCaculate = require('../service/dateCaculateService');

// 실시간 긴급 알림 목록 반환 (D-Day 당일 ~ 7일 전 전용 + 페이징)
async function getNotifications(req, res) {
    try {
        const allFreshNotices = await fetchHomeNotices();
        const loggedInUser = req.user || req.session?.user;
        let myUrgentNotices = allFreshNotices;

        if (loggedInUser) {
            const mongoose = require('mongoose');
            const UserCertModel = mongoose.model('UserCertification');
            const User = mongoose.model('User'); 
            const currentUserId = loggedInUser._id || loggedInUser.id || loggedInUser.userDoc?._id;

            // 1. 유저가 설정한 target 자격증 긁어오기
            const myCerts = await UserCertModel.find({ 
                $or: [{ userId: currentUserId }, { user: currentUserId }],
                status: 'target' 
            }).populate('certificationId', 'jmcd').lean();

            const myTargetJmCds = myCerts
                .filter(c => c.certificationId && c.certificationId.jmcd)
                .map(c => String(c.certificationId.jmcd).trim());

            // 2. 유저 타겟 자격증 공지거나, 학사/장학금 같은 공통 공지만 남기기
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

            // 3.  스크랩한 채용공고 마감 임박(D-1, D-7) 데이터 가져오기
            const userWithScraps = await User.findById(currentUserId).populate('scrapedJobs').lean();
            
            if (userWithScraps && userWithScraps.scrapedJobs) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                userWithScraps.scrapedJobs.forEach(job => {
                    if (!job.endDate) return; // 상시채용 패스

                    const jobEnd = new Date(job.endDate);
                    jobEnd.setHours(0, 0, 0, 0);

                    // 남은 날짜 계산
                    const diffDays = Math.ceil((jobEnd - today) / (1000 * 60 * 60 * 24));

                    //  7일 남았거나 1일 남았을 때 알림 배열에 추가 
                    if (diffDays === 7 || diffDays === 1) {
                        myUrgentNotices.push({
                            category: 'recruit',
                            title: `[${job.company}] 마감 임박!`, // 알림 제목
                            url: job.url, 
                            dDayText: `D-${diffDays}`,
                            dDayBadgeClass: diffDays === 1 ? 'red' : 'amber' // 하루 전은 빨간색, 7일 전은 노란색
                        });
                    }
                });
            }
        }

        // 4. d-day ~ d-7만 내보내기 필터링
        myUrgentNotices = myUrgentNotices.filter(n => {
            if (n.dDayText) {
                const text = String(n.dDayText).trim();
                return text === 'D-day' || (text.startsWith('D-') && parseInt(text.replace('D-', '')) <= 7);
            }
            return n.dDayText && !n.dDayText.includes('종료');
        });

        // 5. 페이징 처리
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // 알림창은 콤팩트하게 5개씩만
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedAlerts = myUrgentNotices.slice(startIndex, endIndex);

        return res.json({
            success: true,
            alerts: paginatedAlerts, //5개만 내보내줌
            hasMore: endIndex < myUrgentNotices.length,
            totalCount: myUrgentNotices.length
        });

    } catch (error) {
        console.error("알림 API 조회 에러:", error);
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