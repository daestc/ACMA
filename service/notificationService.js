// service/notificationService.js
const Notice = require('../models/Notice');             // 공지사항 모델
const CalendarEvent = require('../models/Calendar');    
const Notification = require('../models/Notification'); 

/**
 * [1] 읽지 않은 알림 목록 가져오기 
 */
const getNotifications = async (userId) => {
    try {
        return await Notification.find({ userId: userId }).sort({ createdAt: -1 }); 
    } catch (error) {
        console.error("getNotifications DB 조회 에러:", error.message);
        return [];
    }
};

/**
 * [2] 알림 삭제 
 */
const deleteNotifications = async (userId) => {
    try {
        await Notification.deleteMany({ userId: userId });
    } catch (error) {
        console.error("deleteNotifications DB 삭제 에러:", error.message);
    }
};

/**
 * [3] 실시간 알림창 및 배너 데이터 가공/조립 함수
 */
const getBannerData = async (userId) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        // ─── [A] 오늘의 강의와 중간/기말 가져오기 (CalendarEvent 연동) ───
        let formattedTodayEvents = []; 
        try {
            const todayEvents = await CalendarEvent.find({
                userId: userId,
                startDate: { $lte: now },
                endDate: { $gte: startOfToday }
            });

            if (todayEvents && todayEvents.length > 0) {
                formattedTodayEvents = todayEvents.map(event => {
                    const isExam = event.title.includes('중간고사') || event.title.includes('기말고사') || event.title.includes('시험');
                    return {
                        type: isExam ? 'exam' : 'timetable',
                        icon: isExam ? '✍️' : '📅',
                        title: isExam ? `🚨 시험 일정` : `🔔 오늘 수업`,
                        body: isExam ? `오늘 [${event.title}] 시험이 있습니다! 힘내세요!` : `오늘 [${event.title}] 수업이 있습니다.`,
                        dDayText: 'TODAY'
                    };
                });
            }
        } catch (calendarError) {
            console.log("⚠️ CalendarEvent 조회 일시 건너뜀:", calendarError.message);
        }

        // ─── [B] 자격증 및 장학금 d-7, d-day인 거 가져오기 (Notice 연동) ───
        const formattedNotices = []; 
        try {
            const matchNotices = await Notice.find({
                category: { $in: ['certification', 'scholarship'] },
                isPublished: true
            });

            matchNotices.forEach(notice => {
                if (!notice.endDate) return; // 마감일이 없는 건 패스
                
                const noticeEnd = new Date(notice.endDate);
                const endOfNoticeDay = new Date(noticeEnd.getFullYear(), noticeEnd.getMonth(), noticeEnd.getDate(), 0, 0, 0, 0);

                // 날짜 차이 계산 (밀리초 -> 일)
                const diffTime = endOfNoticeDay.getTime() - startOfToday.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // 오직 D-Day(0) 이거나 D-7(7) 일 때만 로직 실행
                if (diffDays === 0 || diffDays === 7) {
                    let icon = notice.category === 'certification' ? '🏆' : '💰';
                    let dDayStr = diffDays === 0 ? 'D-day' : 'D-7';
                    let alertMessage = "";
                    const rawTitle = notice.title; 

                    if (notice.category === 'certification') {
                        let examType = '일정';
                        if (rawTitle.includes('원서접수')) examType = '원서접수가';
                        else if (rawTitle.includes('시험')) examType = '시험이';
                        else if (rawTitle.includes('결과발표')) examType = '결과발표가';

                        // 연도/회차 정보 문구 정제
                        let certName = rawTitle.replace(/\d{4}년/g, "") 
                                               .replace(/정기\s*기사\s*\d+회/g, "") 
                                               .replace(/(원서접수|시험|결과발표)/g, "") 
                                               .trim();
                    
                        if (diffDays === 0) {
                            alertMessage = `오늘 ${certName} ${examType} 마감돼요!`;
                        } else if (diffDays === 7) {
                            alertMessage = `${certName} ${examType} 7일 남았어요!`;
                        }
                    } else { 
                        // 장학금 문자열 정제
                        let scholarshipName = rawTitle.replace(/(공고|신청|장학생|모집)/g, "").trim();
                        if (diffDays === 0) {
                            alertMessage = `오늘 ${scholarshipName} 신청 마감일이에요!`;
                        } else if (diffDays === 7) {
                            alertMessage = `${scholarshipName} 신청 마감까지 7일 남았어요!`;
                        }
                    }

                    formattedNotices.push({
                        type: notice.category,
                        icon: icon,
                        title: dDayStr === 'D-day' ? `${dDayStr} 마감임박` : `${dDayStr} 알림`,
                        body: alertMessage,
                        dDayText: dDayStr 
                    });
                }
            });
        } catch (noticeError) {
            console.log("⚠️ Notice 조회 일시 건너뜀:", noticeError.message);
        }

        // 모든 가공 데이터 결합 후 리턴
        return [...formattedTodayEvents, ...formattedNotices];

    } catch (globalError) {
        console.error("❌ 서비스 최상위 크래시 예방:", globalError.message);
        return [];
    }
};

module.exports = { 
    getNotifications, 
    deleteNotifications, 
    getBannerData 
};