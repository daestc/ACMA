const { CalendarEvent,Timetable } = require('../models/Calendar');


//일정 가져오기
async function getEventsListByUser(userId) {
    return await CalendarEvent.find({ //사용자 id와 삭제되지 않은 일정 가져오기
        userId : userId,
        isDeleted: false,
    }).sort({startDate: 1});
};

//일정생성
async function createNewEvent(userId, eventData) {
    if (!eventData.title) {
        throw new Error('일정 제목은 필수입니다.');
    }
    if (!eventData.startDate) {
        throw new Error('시작 날짜는 필수입니다.');
    }
    const newEvent = await CalendarEvent.create({
        userId : userId,
        title : eventData.title,
        description : eventData.description || null,
        startDate: eventData.startDate,
        endDate: eventData.endDate || eventData.startDate,
        isAllDay: eventData.isAllDay ?? true,
        category: eventData.category || 'personal',
        isDday: eventData.isDday ?? false,
        color: eventData.color || '#3B82F6',
    });
    return newEvent;
};

//일정 수정
async function updateEvent(userId, eventId, updateData) {
  return await CalendarEvent.findOneAndUpdate(
    {
      _id: eventId,
      userId: userId,
      isDeleted: false,
    },
    updateData,
    { new: true }
  );
};

//일정 삭제
async function deleteEvent(userId,eventId) {
    return await CalendarEvent.findOneAndUpdate(//isDeleted를 true로 바꾸는 것이므로 update 사용
        {
            _id: eventId,
            userId: userId,
            isDeleted: false
        },
        {
            isDeleted: true
        },
        {new: true}
    );
};

//////////////////////시간표 서비스//////////////////////////
//시간표 불러오기
async function getTimetableListByUser(userId) {
    return await Timetable.find({ //사용자 id와 삭제되지 않은 시간표 가져오기
        userId : userId,
        isActive: true,
    });
};

//시간표 생성
async function createNewTimetable(userId, timetableData) {
    if (!timetableData.title) {
        throw new Error('시간표 제목은 필수입니다.');
    }

    if (!timetableData.schedule || timetableData.schedule.length === 0) {
        throw new Error('시간표 시간 정보는 필수입니다.');
    }
    const newTimetable = await Timetable.create({
        userId : userId,
        semester : timetableData.semester || null,
        title : timetableData.title,
        location: timetableData.location || null,
        type: timetableData.type || 'lecture',
        professorName: timetableData.professorName || null,
        credits: timetableData.credits || 0,
        color: timetableData.color || '#60A5FA',
        schedule: timetableData.schedule,
    });
    return newTimetable;
};

//시간표 수정
async function updateTimetable(userId, timetableId, updateData) {
  return await Timetable.findOneAndUpdate(
    {
      _id: timetableId,
      userId: userId,
      isActive: true,
    },
    updateData,
    { new: true }
  );
};

//시간표 제거
async function deleteTimetable(userId,timetableId) {
    return await Timetable.findOneAndUpdate(//isActive를 false 바꾸는 것이므로 update 사용
        {
            _id: timetableId,
            userId: userId,
            isActive: true
        },
        {
            isActive: false
        },
        {new: true}
    );
};
module.exports = {getEventsListByUser,
                createNewEvent,
                updateEvent,
                deleteEvent,
            
                getTimetableListByUser,
                createNewTimetable,
                updateTimetable,
                deleteTimetable
            };