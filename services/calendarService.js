const { CalendarEvent,Timetable, Lecture} = require('../models/Calendar');


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
async function deleteTimetable(userId, timetableId) {
    const deletedTimetable = await Timetable.findOneAndUpdate(
        {
            _id: timetableId,
            userId: userId,
            isActive: true
        },
        {
            isActive: false
        },
        { new: true }
    );

    if (!deletedTimetable) {
        throw new Error('시간표를 찾을 수 없습니다.');
    }

    return deletedTimetable;
};

// 강의 목록 조회(학기,년도,강의명 검색)
async function getLectureList(filter = {}) {
  const query = {};
  //년도 필터
  if (filter.year) {
    query.year = Number(filter.year);
  }
  //학기 필터
  if (filter.semester) {
    query.semester = filter.semester;
  }
  //사용자가 입력한 필드
  if (filter.keyword) {
    query.courseName = { $regex: filter.keyword, $options: 'i' };
  }
  //db검색 (오름차순)
  return await Lecture.find(query)
    .sort({ courseName: 1, section: 1 });
}

// 강의를 내 시간표에 추가 Lecture의 내용을 timetable에 맞추어 생성
async function addLectureToTimetable(userId, lectureId, color = '#60A5FA') {
  const lecture = await Lecture.findById(lectureId);

  if (!lecture) {
    throw new Error('강의를 찾을 수 없습니다.');
  }

  if (!lecture.schedules || lecture.schedules.length === 0) {
    throw new Error('강의 시간 정보가 없습니다.');
  }

  //timetableSchema는 요일이 숫자로 구성되어있음
  const dayMap = {
    '일': 0,
    '월': 1,
    '화': 2,
    '수': 3,
    '목': 4,
    '금': 5,
    '토': 6,
  };
  //timetableSchema의 schedule이 dayOfWeek,startTime,endTime 로 구성되어 있음
  const schedule = lecture.schedules.map(sch => ({
    dayOfWeek: dayMap[sch.day],
    startTime: sch.startTime,
    endTime: sch.endTime,
  }));

  //시간표 겹침 검증 함수 불러오기
  await validateTimetableOverlap(userId, schedule);

  //학기 표시 규격에 맞게 변경 (년도 + 학기)
  const semesterValue = `${lecture.year}-${lecture.semester === '1학기' ? '1' : '2'}`;

  //timetableSchema 생성
  return await Timetable.create({
    userId,
    semester: semesterValue,
    title: lecture.courseName,
    location: null,
    type: 'lecture',
    professorName: lecture.professor,
    credits: lecture.credits,
    color,
    schedule,
  });
}

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

//도메인 규칙 함수
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

//시간표 분 표시
function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

//일정 시작,끝 출력
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
};

// ======================날씨 api(단기예보 이용)==========================
async function getShortWeather() {
  //위도,경도도 .env파일에서 미리 설정함.(서울특별시)
  const serviceKey = process.env.KMA_SERVICE_KEY;
  const nx = process.env.KMA_NX || 60;
  const ny = process.env.KMA_NY || 127;

  if (!serviceKey) {
    throw new Error('KMA_SERVICE_KEY가 설정되지 않았습니다.');
  }

  const now = new Date();

  const baseDate = getKmaBaseDate(now);
  const baseTime = getKmaBaseTime(now);

  const url =
    `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
    `?serviceKey=${encodeURIComponent(serviceKey)}` +
    `&pageNo=1` +
    `&numOfRows=1000` +
    `&dataType=JSON` +
    `&base_date=${baseDate}` +
    `&base_time=${baseTime}` +
    `&nx=${nx}` +
    `&ny=${ny}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('기상청 단기예보 API 요청 실패');
  }

  const data = await response.json();

  
  const items = data.response?.body?.items?.item || [];

  const dailyMap = {};

  const grouped = {};

  //해당 날짜의 12시를 기준으로 날씨를 가져옴.
  //오늘 날짜는 불러오려는 날씨의 시간이 지났으면 다음 시간으로 바꿔서 출력
  items.forEach(item => {
    const date = item.fcstDate;
    const time = item.fcstTime;
    const category = item.category;

  if (!['SKY', 'PTY', 'TMP'].includes(category)) return;

  if (!grouped[date]) {
    grouped[date] = {};
  }

  if (!grouped[date][time]) {
    grouped[date][time] = {
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      time,
      sky: null,
      pty: null,
      temp: null,
    };
  }

  if (category === 'SKY') grouped[date][time].sky = item.fcstValue;
  if (category === 'PTY') grouped[date][time].pty = item.fcstValue;
  if (category === 'TMP') grouped[date][time].temp = item.fcstValue;
  });

  const preferredTimes = [
    '1200',
    '1500',
    '0900',
    '1800',
    '0600',
    '2100',
    '0000',
    '0300'
  ];

  const dailyWeather = Object.values(grouped).map(times => {
    const selectedTime =
    preferredTimes.find(time => times[time]) ||
    Object.keys(times).sort()[0];

    return times[selectedTime];
  });

  return dailyWeather.map(day => ({
    ...day,
    icon: getWeatherIcon(day.sky, day.pty),
    description: getWeatherDescription(day.sky, day.pty),
  }));

  return Object.values(dailyMap).map(day => ({
    ...day,
    icon: getWeatherIcon(day.sky, day.pty),
    description: getWeatherDescription(day.sky, day.pty),
  }));
}

function getKmaBaseDate(date) {
  const base = new Date(date);

  const hour = base.getHours();
  const minute = base.getMinutes();

  // 단기예보는 발표 직후 바로 조회가 안 될 수 있어서 여유를 둠
  if (hour < 2 || (hour === 2 && minute < 30)) {
    base.setDate(base.getDate() - 1);
  }

  return formatKmaDate(base);
}

function getKmaBaseTime(date) {
  const hour = date.getHours();
  const minute = date.getMinutes();

  const current = hour * 100 + minute;

  if (current >= 2300) return '2300';
  if (current >= 2000) return '2000';
  if (current >= 1700) return '1700';
  if (current >= 1400) return '1400';
  if (current >= 1100) return '1100';
  if (current >= 800) return '0800';
  if (current >= 500) return '0500';
  if (current >= 230) return '0200';

  return '2300';
}

function formatKmaDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

function getWeatherIcon(sky, pty) {
  // PTY: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
  if (pty && pty !== '0') {
    if (pty === '1') return '🌧️';
    if (pty === '2') return '🌨️';
    if (pty === '3') return '❄️';
    if (pty === '4') return '🌦️';
    return '☔';
  }

  // SKY: 1 맑음, 3 구름많음, 4 흐림
  if (sky === '1') return '☀️';
  if (sky === '3') return '⛅';
  if (sky === '4') return '☁️';

  return '🌤️';
}

function getWeatherDescription(sky, pty) {
  if (pty && pty !== '0') {
    if (pty === '1') return '비';
    if (pty === '2') return '비/눈';
    if (pty === '3') return '눈';
    if (pty === '4') return '소나기';
    return '강수';
  }

  if (sky === '1') return '맑음';
  if (sky === '3') return '구름많음';
  if (sky === '4') return '흐림';

  return '날씨';
}

module.exports = {getEventsListByUser,
                createNewEvent,
                updateEvent,
                deleteEvent,
            
                getTimetableListByUser,
                createNewTimetable,
                updateTimetable,
                deleteTimetable,
                getLectureList,
                addLectureToTimetable,

                getShortWeather
            };