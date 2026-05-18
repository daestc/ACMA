//알림 배너 
const notificationService = require('../services/notificationService')

const getNotifications = async (req, res, next) =>{

    try {
        // 로그인한 회원이 가지고 있는 알림 들 가져오기
        const userId = req.user._id;
        const notifications = await notificationService.getNotifications(userId);
        // 로그인한 회원(웹소켓서버와 연결된 소켓)에게 알림들을 json 형식으로 전달
        res.json(notifications);
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

module.exports = {getNotifications, deleteNotifications};