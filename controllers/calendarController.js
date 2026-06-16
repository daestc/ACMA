const calendarService = require('../services/calendarService');
const User = require('../models/User');

async function resolveUserUniversity(req) {
  const user = await User.findById(req.user.id).select('university').lean();
  return user?.university?.trim() || req.user?.university?.trim() || null;
}

function noUniversityResponse(res) {
  return res.status(400).json({
    ok: false,
    code: 'NO_UNIVERSITY',
    message: '대학등록이 필요합니다',
  });
}

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

//Lecture 리스트 불러오기 (검색)
const getLectureList = async (req,res) => {
    try {
        const university = await resolveUserUniversity(req);
        if (!university) {
            return noUniversityResponse(res);
        }

        const lectures = await calendarService.getLectureList({
            ...req.query,
            university,
        });
        res.json(lectures);
    } catch (error) {
        if (error.code === 'NO_UNIVERSITY') {
            return noUniversityResponse(res);
        }
        res.status(500).json({
            message: "강의 목록 조회 실패",
            error : error.message
        });
    }
};

const addLectureToTimetable = async (req,res) => {
    try {
        const university = await resolveUserUniversity(req);
        if (!university) {
            return noUniversityResponse(res);
        }

        const userId = req.user.id; //사용자 id
        const {lectureId, color} = req.body; //사용자가 선택한 lecture의 id

        const timetable = await calendarService.addLectureToTimetable(
            userId,
            lectureId,
            color,
            university,
        );

        res.status(201).json(timetable);
    } catch (error) {
        if (error.code === 'NO_UNIVERSITY') {
            return noUniversityResponse(res);
        }
        res.status(400).json({
            message: '강의 시간표 추가 실패',
            error: error.message
        });
    }
};

const getAvailableUniversities = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const result = await calendarService.getAvailableUniversities({ page, limit });
        res.json(result);
    } catch (error) {
        res.status(500).json({
            message: '등록 가능한 대학 목록 조회 실패',
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
    getLectureList,
    addLectureToTimetable,
    getAvailableUniversities,

    getWeather
};