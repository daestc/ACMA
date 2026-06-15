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
        res.status(400).json({
      message: '일정 생성 실패',
      error: error.message,
        });
    }
};

const updatedEvent = async(req,res) => { //일정 정보 수정
    try {
        const userId = req.user.id;
        const eventId = req.params.eventId;
        //서비스에 각 id, 수정 사항 전달
        const updateEvent = await calendarService.updateEvent(userId,eventId,req.body);
        res.json(updateEvent); //json으로 수정사항 반환
    } catch (error) {
        res.status(400).json({
        message: '일정 수정 실패',
        error: error.message,
        });
    }
};

const deletedEvent = async (req,res)=>{//일정 삭제 (isDelete true로 변경)
    try {
        const userId = req.user.id;
        const eventId = req.params.eventId;

        const deletedEvent = await calendarService.deleteEvent(userId, eventId);

        res.json({
            message: '일정 삭제 성공',
            deletedEvent
        });
    } catch (error) {
        res.status(404).json({
        message: '일정 삭제 실패',
        error: error.message,
        });
    }
};

//시간표 조회 컨트롤러
const getTimetableList = async(req,res) => { 
    try {
        const userId = req.user.id; //사용자 id
        const timetableList = await calendarService.getTimetableListByUser(userId)
        
        res.json(timetableList); //받은 json 보내기
    } catch (error) {
        res.status(500).json({
      message: '시간표 조회 실패',
      error: error.message,
    });
    }
};

//시간표 생성
const createTimetable = async(req,res) => {
    try {
        const userId = req.user.id;
        const newTimetable = await calendarService.createNewTimetable(userId, req.body);
        res.status(201).json(newTimetable); //요청 성공시 json반환 
    } catch (error) {
        res.status(400).json({
      message: '시간표 생성 실패',
      error: error.message,
        });
    }
};

//시간표 업데이트
const updatedTimetable = async(req,res) => {
    try {
        const userId = req.user.id;
        const timetableId = req.params.timetableId;
        //서비스에 각 id, 수정 사항 전달
        const updateTimetable = await calendarService.updateTimetable(userId,timetableId,req.body);
        res.json(updateTimetable); //json으로 수정사항 반환
    } catch (error) {
        res.status(400).json({
        message: '시간표 수정 실패',
        error: error.message,
        });
    }
};

//시간표 지우기
const deletedTimetable = async (req,res)=>{
    try {
        const userId = req.user.id;
        const timetableId = req.params.timetableId;

        await calendarService.deleteTimetable(userId, timetableId);

        res.json({
            message: '시간표 삭제 성공'
        });
    } catch (error) {
        res.status(500).json({
        message: '시간표 삭제 실패',
        error: error.message,
        });
    }
};

//날씨 컨트롤러
const getWeather = async (req, res) => {
  try {
    //쿼리로 위경도가 오면 해당 위치, 없으면 .env 기본 좌표(서울) 사용
    const { lat, lon } = req.query;
    const weatherList = await calendarService.getShortWeather(lat, lon);
    res.json(weatherList);
  } catch (error) {
    res.status(500).json({
      message: '날씨 조회 실패',
      error: error.message,
    });
  }
};

module.exports = {
    getEventsList,
    createEvent,
    updatedEvent,
    deletedEvent,

    getTimetableList,
    createTimetable,
    updatedTimetable,
    deletedTimetable,

    getWeather
};