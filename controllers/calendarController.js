const calendarService = require('../services/calendarService');

const getEventsList = async(req,res) => { //라우터에서 요청한 스케쥴리스트 서비스에 요청
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
};

const createEvent = async(req,res) => {//라우터에서 요청한 일정 정보 생성을 서비스로 보냄 
    try {
        const userId = req.user.id;
        const newEvent = await calendarService.createNewEvent(userId, req.body);
        res.status(201).json(newEvent); //요청 성공시 json반환 
    } catch (error) {
        res.status(500).json({
      message: '일정 생성 실패',
      error: error.message,
        });
    }
};

const updateEvent = async(req,res) => { //일정 정보 수정
    try {
        const userId = req.user.id;
        const eventId = req.params.eventId;
        //서비스에 각 id, 수정 사항 전달
        const updateEvent = await calendarService.updateEvent(userId,eventId,req.body);
        res.json(updateEvent); //json으로 수정사항 반환
    } catch (error) {
        res.status(500).json({
        message: '일정 수정 실패',
        error: error.message,
        });
    }
};

const deleteEvent = async (req,res)=>{
    try {
        const userId = req.user.id;
        const eventId = req.params.eventId;

        await calendarService.deleteEvent(userId, eventId);

        res.json({
            message: '일정 삭제 성공'
        });
    } catch (error) {
        res.status(500).json({
        message: '일정 삭제 실패',
        error: error.message,
        });
    }
};

module.exports = {getEventsList,createEvent,updateEvent,deleteEvent};