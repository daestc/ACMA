// service/notificationService.js
const Notice = require('../models/Notice');            
const CalendarEvent = require('../models/Calendar');    
const Notification = require('../models/Notification'); 
const User = require('../models/User'); 
const careerService = require('./careerService');

//읽지 않은 알림 목록 가져오기
const getNotifications = async (userId) => {
    try {
        return await Notification.find({ userId: userId }).sort({ createdAt: -1 }); 
    } catch (error) {
        console.error("getNotifications DB 조회 에러:", error.message);
        return [];
    }
};

//알림 삭제
const deleteNotifications = async (userId) => {
    try {
        await Notification.deleteMany({ userId: userId });
    } catch (error) {
        console.error("deleteNotifications DB 삭제 에러:", error.message);
    }
};

//알림창 배너 가공
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


        // ───   스크랩한 채용공고 마감 (D-7, D-1) 가져오기 ───
        const formattedRecruits = [];
        try {
            // 유저 정보와 함께 스크랩한 공고(scrapedJobs) 데이터까지 전부 불러오기
            const user = await User.findById(userId).populate('scrapedJobs');
            
            if (user && user.scrapedJobs && user.scrapedJobs.length > 0) {
                user.scrapedJobs.forEach(job => {
                    if (!job.endDate) return; // endDate가 없는 상시채용은 알림 제외

                    const jobEnd = new Date(job.endDate);
                    const endOfJobDay = new Date(jobEnd.getFullYear(), jobEnd.getMonth(), jobEnd.getDate(), 0, 0, 0, 0);

                    // 날짜 차이 계산
                    const diffTime = endOfJobDay.getTime() - startOfToday.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // D-7, D-1 남은 공고만
                    if (diffDays === 7 || diffDays === 1) {
                        formattedRecruits.push({
                            type: 'recruit',
                            icon: '💼', 
                            title: `D-${diffDays} 마감임박`,
                            body: `스크랩한 [${job.company}] 공고 마감까지 ${diffDays}일 남았어요!`,
                            dDayText: `D-${diffDays}`,
                            url: job.url
                        });
                    }
                });
            }
        } catch (recruitError) {
            console.log(" 스크랩 공고 조회 일시 건너뜀:", recruitError.message);
        }

        //  모든 가공 데이터 결합 후 리턴
        return [...formattedTodayEvents, ...formattedNotices, ...formattedRecruits];

    } catch (globalError) {
        console.error(" 서비스 최상위 크래시 예방:", globalError.message);
        return [];
    }
};

module.exports = { 
    getNotifications, 
    deleteNotifications, 
    getBannerData 
};