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

    validateEventData(eventData);//도메인 검증 함수

    const newEvent = await CalendarEvent.create({
        userId : userId,
        title : eventData.title.trim(),
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
    validateEventData(updateData);//도메인 검증 함수

    const sanitizedData = {
        title: updateData.title.trim(),
        description: updateData.description || null,
        startDate: updateData.startDate,
        endDate: updateData.endDate || updateData.startDate,
        isAllDay: updateData.isAllDay ?? true,
        category: updateData.category || 'personal',
        isDday: updateData.isDday ?? false,
        color: updateData.color || '#3B82F6',
    };

    const updatedEvent = await CalendarEvent.findOneAndUpdate(
        {
          _id: eventId,
          userId: userId,
          isDeleted: false,
        },
        sanitizedData,
        { new: true, runValidators: true }
    );

    if (!updatedEvent) {
        throw new Error('일정을 찾을 수 없습니다.');
    }

    return updatedEvent;
    
};

//일정 삭제
async function deleteEvent(userId,eventId) {
    const deletedEvent =  await CalendarEvent.findOneAndUpdate(//isDeleted를 true로 바꾸는 것이므로 update 사용
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
    if (!deletedEvent) {
        throw new Error('일정을 찾을 수 없습니다.');
    }
    return deletedEvent;
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
    validateTimetableData(timetableData);
    await validateTimetableOverlap(userId, timetableData.schedule);

    const isLecture = !!timetableData.semester;

    const newTimetable = await Timetable.create({
        userId: userId,
        semester: timetableData.semester || null,
        title: timetableData.title.trim(),
        location: timetableData.location || null,
        type: timetableData.type || (isLecture ? 'lecture' : 'other'),
        professorName: isLecture ? (timetableData.professorName || null) : null,
        credits: isLecture ? (timetableData.credits || 0) : 0,
        color: timetableData.color || '#60A5FA',
        schedule: timetableData.schedule,
    });

    return newTimetable;
}

//시간표 수정
async function updateTimetable(userId, timetableId, updateData) {
    validateTimetableData(updateData);
    await validateTimetableOverlap(userId, updateData.schedule, timetableId);

    const isLecture = !!updateData.semester;

    const sanitizedData = {
        semester: updateData.semester || null,
        title: updateData.title.trim(),
        location: updateData.location || null,
        type: updateData.type || (isLecture ? 'lecture' : 'other'),
        professorName: isLecture ? (updateData.professorName || null) : null,
        credits: isLecture ? (updateData.credits || 0) : 0,
        color: updateData.color || '#60A5FA',
        schedule: updateData.schedule,
    };

    const updatedTimetable = await Timetable.findOneAndUpdate(
        {
            _id: timetableId,
            userId: userId,
            isActive: true,
        },
        sanitizedData,
        { new: true, runValidators: true }
    );

    if (!updatedTimetable) {
        throw new Error('시간표를 찾을 수 없습니다.');
    }

    return updatedTimetable;
}

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


//일정 도메인 규칙
const EVENT_CATEGORIES = [
  'personal',
  'lecture',
  'exam',
  'assignment',
  'certification',
  'notice',
  'other'
];

function validateEventData(eventData) {
  if (!eventData.title || eventData.title.trim() === '') {
    throw new Error('일정 제목은 필수입니다.');
  }

  if (!eventData.startDate) {
    throw new Error('시작 날짜는 필수입니다.');
  }

  if (eventData.category && !EVENT_CATEGORIES.includes(eventData.category)) {
    throw new Error('올바르지 않은 카테고리입니다.');
  }

  const startDate = new Date(eventData.startDate);
  const endDate = new Date(eventData.endDate || eventData.startDate);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error('시작 날짜 형식이 올바르지 않습니다.');
  }

  if (Number.isNaN(endDate.getTime())) {
    throw new Error('종료 날짜 형식이 올바르지 않습니다.');
  }

  if (endDate < startDate) {
    throw new Error('종료 날짜/시간은 시작 날짜/시간보다 빠를 수 없습니다.');
  }

  if (eventData.isAllDay === false) {
    if (!String(eventData.startDate).includes('T') || !String(eventData.endDate).includes('T')) {
        throw new Error('시간 일정은 시작 시간과 종료 시간이 필요합니다.');
    }
  }
}

//시간표 도매인 규칙
function validateTimetableData(timetableData) {
  if (!timetableData.title || timetableData.title.trim() === '') {
    throw new Error('시간표 제목은 필수입니다.');
  }

  if (!Array.isArray(timetableData.schedule) || timetableData.schedule.length === 0) {
    throw new Error('시간표 시간 정보는 필수입니다.');
  }

  timetableData.schedule.forEach(sch => {
    if (sch.dayOfWeek === undefined || sch.dayOfWeek === null) {
      throw new Error('요일 정보는 필수입니다.');
    }

    if (!sch.startTime || !sch.endTime) {
      throw new Error('시작 시간과 종료 시간은 필수입니다.');
    }

    if (sch.startTime >= sch.endTime) {
      throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    if (timeToMinutes(sch.startTime) < 8 * 60 || timeToMinutes(sch.endTime) > 22 * 60) {
        throw new Error('시간표는 08:00~22:00 사이만 입력할 수 있습니다.');
    }

    if (timeToMinutes(sch.startTime) % 30 !== 0 || timeToMinutes(sch.endTime) % 30 !== 0) {
        throw new Error('시간표는 30분 단위로만 입력할 수 있습니다.');
    }

  });

    if (timetableData.credits !== undefined && Number(timetableData.credits) < 0) {
        throw new Error('학점은 0 이상이어야 합니다.');
    }

}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function isScheduleOverlap(a, b) {
  if (Number(a.dayOfWeek) !== Number(b.dayOfWeek)) {
    return false;
  }

  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);

  return aStart < bEnd && bStart < aEnd;
}

//시간표 겹침 검증
async function validateTimetableOverlap(userId, newSchedule, excludeTimetableId = null) {
  //같은 시간표 내부 schedule끼리 겹치는지 검사
  for (let i = 0; i < newSchedule.length; i++) {
    for (let j = i + 1; j < newSchedule.length; j++) {
      if (isScheduleOverlap(newSchedule[i], newSchedule[j])) {
        throw new Error('입력한 시간표 내부에 서로 겹치는 시간이 있습니다.');
      }
    }
  }

  //기존 시간표와 겹치는지 검사
  const query = {
    userId,
    isActive: true,
  };

  if (excludeTimetableId) {
    query._id = { $ne: excludeTimetableId };
  }

  const existingTimetables = await Timetable.find(query);

  for (const timetable of existingTimetables) {
    for (const existingSch of timetable.schedule) {
      for (const newSch of newSchedule) {
        if (isScheduleOverlap(existingSch, newSch)) {
          throw new Error(`'${timetable.title}' 시간표와 시간이 겹칩니다.`);
        }
      }
    }
  }
}

module.exports = {getEventsListByUser,
                createNewEvent,
                updateEvent,
                deleteEvent,
            
                getTimetableListByUser,
                createNewTimetable,
                updateTimetable,
                deleteTimetable
            };