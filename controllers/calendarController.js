const calendarService = require('../services/calendarService');

const getEventsList = async(req,res) => { //라우터에서 받아온 스케쥴리스트 요청
    try {
        const userId = req.user.id; //사용자 id
        const eventsList = await calendarService.getEventsListByUser(userId)// 유저id를 가지고 일정 리스트를 서비스로 넘김
        
        res.json(eventsList); //받은 json 보내기
    } catch (error) {
        res.status(500).json({
      message: '일정 조회 실패',
      error: error.message,
    });
    }
}

module.exports = {getEventsList};