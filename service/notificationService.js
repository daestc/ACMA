//알림 배너
const Notification = require('../models/Notification');

// 읽지 않은 알림 목록 가져오기
async function getNotifications(userId){
    const notifications = await Notification.find({receiver : userId})
        .sort({createAt : -1});
    return notifications; 
}

// 알림 전체 삭제
async function deleteNotifications(userId){
    await Notification.deleteMany({receiver : userId});
}

//모듈 내보내기
module.exports = { getNotifications, deleteNotifications};