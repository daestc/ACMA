//알림 배너 
const notificationService = require('../service/notificationService')

// 로그인한 유저 정보에 대한 더미데이터 
const injectMockUser = (req, res, next) => {
    req.user = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1', 
        name: '홍길동 ',
        major: '컴퓨터공학과',
        grade: 4
    };
    next(); 
};

//알림 목록 가져오기
const getNotifications = async (req, res, next) =>{

    try {
        // 로그인한 회원이 가지고 있는 알림들 가져오기
        const userId = req.user._id;

        // 데이터 가공본 호출
       const liveAlerts = await notificationService.getBannerData(userId);
       
        // 로그인한 회원(웹소켓서버와 연결된 소켓)에게 알림들을 json 형식으로 전달
        res.json({
            success: true,
            liveAlerts: liveAlerts
        });
    } catch (error) {
        next(error);
    }
}
// 알림 전체 삭제
const deleteNotifications = async (req, res, next) =>{
    try {
        const userId = req.user._id;
        await notificationService.deleteNotifications(userId);
        res.json({message : '알림이 전부 삭제되었습니다'});
    } catch (error) {
        next(error);   
    }
}

module.exports = {injectMockUser, getNotifications, deleteNotifications};