/* ================================================
   AcadMe — calendar.js
   캘린더 페이지 전용: 월간 ↔ 주간 뷰 전환
   ================================================ */

function switchCalView(view) {
  const isMonth = view === 'month';

  // 탭 전환 시 열려있는 모달 닫기
  closeEventModal();
  closeTimetableModal();

  document.getElementById('cal-month-view').style.display = isMonth ? 'block' : 'none';
  document.getElementById('cal-week-view').style.display  = isMonth ? 'none'  : 'block';

  document.getElementById('cal-tab-month').classList.toggle('active',  isMonth);
  document.getElementById('cal-tab-week').classList.toggle('active',  !isMonth);
}

let currentDate = new Date();
let events = [];
let selectedDateStr = null;

//날씨 api전역 함수
let weatherMap = {};

window.timetables = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadCalendarData();

  renderCalendar();
  renderTimetable();
  loadWeatherAsync();

  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById('delete-event-btn').addEventListener('click', deleteEvent);
  const openEventFormBtn = document.getElementById('open-event-form-btn');
  const closeEventFormBtn = document.getElementById('close-event-form-btn');
  const eventModal = document.getElementById('event-modal');
  const eventForm = document.getElementById('event-form');
  const allDayCheckbox = document.getElementById('event-all-day');
  const endDateInput = document.getElementById('event-end-date');

  allDayCheckbox.addEventListener('change', toggleTimeFields);
  toggleTimeFields();

  openEventFormBtn.addEventListener('click', () => {
    closeEventModal(); // 기존 값 초기화
    eventModal.style.display = 'flex'; // 모달 열기
  });

  closeEventFormBtn.addEventListener('click', closeEventModal);

  eventForm.addEventListener('submit', createEvent);

});

async function loadCalendarData() {
  const [eventRes, timetableRes] = await Promise.all([
    fetch('/calendar/events'),
    fetch('/calendar/timetables'),
  ]);

  events = await eventRes.json();
  window.timetables = await timetableRes.json();
}

function loadWeatherAsync() {
  fetchWeatherList()
    .then(weatherList => {
      weatherMap = {};
      weatherList.forEach(w => { weatherMap[w.date] = w; });
      renderCalendar();
    })
    .catch(() => {});
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('cal-month-title');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  title.textContent = `${year}년 ${month + 1}월`;

  grid.innerHTML = `
    <div class="cal-day-header">일</div>
    <div class="cal-day-header">월</div>
    <div class="cal-day-header">화</div>
    <div class="cal-day-header">수</div>
    <div class="cal-day-header">목</div>
    <div class="cal-day-header">금</div>
    <div class="cal-day-header">토</div>
  `;

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay.getDay();
  

  for (let i = 0; i < startDay; i++) {
    grid.innerHTML += `<div class="cal-day other-month"></div>`;
  }

  for (let date = 1; date <= lastDate; date++) {
    const dateStr = formatDate(year, month + 1, date);
    const dayEvents = getEventsByDate(dateStr);
    const weather = weatherMap[dateStr];

    grid.innerHTML += `
      <div class="cal-day" onclick="selectDate('${dateStr}')">
        <div class="day-num">${date}</div>

        ${weather ? `
          <div
            class="day-weather-icon"
            title="${weather.description} / ${weather.temp ?? '-'}℃"
          >
            ${weather.icon}
          </div>
        ` : ''}

        <div class="day-events">
          ${dayEvents.map(event => {
            const multiDay = !event.isTimetable && isMultiDayEvent(event);

            return `
          <div 
            class="${multiDay ? 'multi-day-event-bar' : 'single-day-event-bar'}${event.isTimetable ? ' timetable-event-bar' : ''}${event.isUniversityEvent ? ' university-event-bar' : ''}"
            title="${event.isUniversityEvent ? '[학교 일정] ' : ''}${event.title}&#10;${event.description || ''}&#10;${formatEventDate(event)}"
            style="background:${event.color || '#3B82F6'}"
            onclick="event.stopPropagation(); openCalendarEventByKey('${event._id}')"
          >
            ${event.isUniversityEvent ? '[학교] ' : ''}${event.title}
          </div>
          `;
        }).join('')}
       </div>
      </div>
`   ;
  }
}

function formatDate(year, month, date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

function parseSemesterRange(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-([12])$/);
  if (!match) return null;

  const year = Number(match[1]);
  const term = Number(match[2]);

  if (term === 1) {
    return {
      start: new Date(year, 2, 1),
      end: new Date(year, 5, 30, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, 8, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function isDateInSemester(dateStr, semester) {
  if (!semester) return true;

  const range = parseSemesterRange(semester);
  if (!range) return true;

  const target = new Date(`${dateStr}T12:00:00`);
  return target >= range.start && target <= range.end;
}

function getTimetableEventsForDate(dateStr) {
  const target = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = target.getDay();
  const result = [];

  (window.timetables || []).forEach(timetable => {
    if (!isDateInSemester(dateStr, timetable.semester)) return;

    (timetable.schedule || []).forEach((sch, schIndex) => {
      if (Number(sch.dayOfWeek) !== dayOfWeek) return;

      result.push({
        _id: `tt-${timetable._id}-${schIndex}-${dateStr}`,
        isTimetable: true,
        timetableId: timetable._id,
        title: `${timetable.title} ${sch.startTime}~${sch.endTime}`,
        description: timetable.professorName
          ? `교수: ${timetable.professorName}`
          : (timetable.location || null),
        startDate: `${dateStr}T${sch.startTime}`,
        endDate: `${dateStr}T${sch.endTime}`,
        isAllDay: false,
        category: timetable.type === 'lecture' ? 'lecture' : timetable.type,
        color: timetable.color || '#60A5FA',
      });
    });
  });

  return result.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function openCalendarEvent(event) {
  if (event.isTimetable) {
    openTimetableDetail(event.timetableId);
    return;
  }

  if (event.isUniversityEvent) {
    openUniversityEventDetail(event);
    return;
  }

  openEventDetail(event._id);
}

function setEventFormReadOnly(readOnly) {
  const fieldIds = [
    'event-title',
    'event-description',
    'event-start-date',
    'event-end-date',
    'event-start-time',
    'event-end-time',
    'event-all-day',
    'event-category',
    'event-color',
  ];

  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = readOnly;
  });

  const submitBtn = document.querySelector('#event-form button[type="submit"]');
  if (submitBtn) submitBtn.style.display = readOnly ? 'none' : '';
}

function openUniversityEventDetail(event) {
  setEventFormReadOnly(false);

  document.getElementById('event-modal-title').textContent = '학교 일정';
  document.getElementById('event-id').value = '';
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-description').value = event.description || '';
  document.getElementById('event-start-date').value = toInputDate(event.startDate);
  document.getElementById('event-end-date').value = toInputDate(event.endDate || event.startDate);
  document.getElementById('event-category').value = event.category || 'notice';
  document.getElementById('event-color').value = event.color || '#F59E0B';
  document.getElementById('event-all-day').checked = true;
  document.getElementById('event-start-time').value = '';
  document.getElementById('event-end-time').value = '';

  setEventFormReadOnly(true);
  toggleTimeFields();

  document.getElementById('delete-event-btn').style.display = 'none';
  document.getElementById('event-modal').style.display = 'flex';
}
//일정 생성
async function createEvent(e) {
  e.preventDefault();

  const eventId = document.getElementById('event-id').value;

  const isAllDay = document.getElementById('event-all-day').checked;

  const startDate = document.getElementById('event-start-date').value;
  const endDate = document.getElementById('event-end-date').value || startDate;

  const startTime = document.getElementById('event-start-time').value;
  const endTime = document.getElementById('event-end-time').value;

  const startDateTime = isAllDay ? startDate : `${startDate}T${startTime}`;
  const endDateTime = isAllDay ? endDate : `${endDate}T${endTime}`;

  const eventData = {
    title: document.getElementById('event-title').value,
    description: document.getElementById('event-description').value,
    startDate: startDateTime,
    endDate: endDateTime,
    category: document.getElementById('event-category').value,
    color: document.getElementById('event-color').value,
    isAllDay: isAllDay
  };

  const url = eventId ? `/calendar/events/${eventId}` : '/calendar/events';
  const method = eventId ? 'PUT' : 'POST';

  if (!isAllDay) {
    if (!startTime || !endTime) {
      alert('시간 일정은 시작 시간과 종료 시간을 모두 입력해야 합니다.');
      return;
    }
  }

  if (!isAllDay) {
   const start = new Date(`${startDate}T${startTime}`);
   const end = new Date(`${endDate}T${endTime}`);

   if (end <= start) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
   }
}

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });

  if (!res.ok) {
    alert(eventId ? '일정 수정 실패' : '일정 저장 실패');
    return;
  }

  

  closeEventModal();

  await loadCalendarData();
  renderCalendar();

  if (selectedDateStr) {
    selectDate(selectedDateStr);
  }
}

// 일정 선택
function selectDate(dateStr) {
  selectedDateStr = dateStr;

  const panel = document.getElementById('selected-day-panel');
  const title = document.getElementById('selected-day-title');
  const list = document.getElementById('selected-day-events');

  const dayEvents = getEventsByDate(dateStr);

  panel.style.display = 'block';
  title.textContent = `${dateStr} 일정`;

  if (dayEvents.length === 0) {
    list.innerHTML = `<p>등록된 일정이 없습니다.</p>`;
    return;
  }

  list.innerHTML = dayEvents.map(event => `
    <div class="selected-event-item" onclick="openCalendarEventByKey('${event._id}')">
      <span class="selected-event-dot" style="background:${event.color || '#3B82F6'}"></span>
      <span>
        ${event.isUniversityEvent ? '[학교] ' : ''}${event.title}
        ${event.isTimetable || event.isUniversityEvent ? `<small style="display:block;color:var(--text2);margin-top:2px;">${formatEventDate(event)}</small>` : ''}
      </span>
    </div>
  `).join('');
}

//일정 확인
function getEventsByDate(dateStr) {
  const target = new Date(`${dateStr}T12:00:00`);

  const manualEvents = events.filter(event => {
    const start = new Date(`${toInputDate(event.startDate)}T00:00:00`);
    const end = new Date(`${toInputDate(event.endDate || event.startDate)}T23:59:59`);

    return target >= start && target <= end;
  });

  const timetableEvents = getTimetableEventsForDate(dateStr);

  return [...manualEvents, ...timetableEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.startDate) - new Date(b.startDate);
  });
}

const calendarEventIndex = new Map();

function rebuildCalendarEventIndex() {
  calendarEventIndex.clear();

  events.forEach(event => {
    calendarEventIndex.set(String(event._id), event);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let date = 1; date <= lastDate; date++) {
    const dateStr = formatDate(year, month + 1, date);
    getTimetableEventsForDate(dateStr).forEach(event => {
      calendarEventIndex.set(String(event._id), event);
    });
  }
}

function openCalendarEventByKey(eventKey) {
  rebuildCalendarEventIndex();
  const event = calendarEventIndex.get(eventKey);
  if (!event) return;
  openCalendarEvent(event);
}

//기존 모달에 값채우기
function openEventDetail(eventId) {
  const event = events.find(item => item._id === eventId);
  if (!event) return;

  setEventFormReadOnly(false);

  document.getElementById('event-modal-title').textContent = '일정 상세 / 수정';

  document.getElementById('event-id').value = event._id;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-description').value = event.description || '';
  document.getElementById('event-start-date').value = toInputDate(event.startDate);
  document.getElementById('event-end-date').value = toInputDate(event.endDate || event.startDate);
  document.getElementById('event-category').value = event.category || 'personal';
  document.getElementById('event-color').value = event.color || '#3B82F6';
  document.getElementById('event-all-day').checked = event.isAllDay ?? true;

  document.getElementById('delete-event-btn').style.display = 'inline-block';
  document.getElementById('event-modal').style.display = 'flex';

  document.getElementById('event-all-day').checked = event.isAllDay ?? true;

  if (!event.isAllDay) {
    document.getElementById('event-start-time').value = toInputTime(event.startDate);
   document.getElementById('event-end-time').value = toInputTime(event.endDate || event.startDate);
  } else {
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
  }

  toggleTimeFields();
}

function toInputDate(dateValue) {
  const date = new Date(dateValue);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

async function deleteEvent() {
  const eventId = document.getElementById('event-id').value;

  if (!eventId) return;

  if (!confirm('이 일정을 삭제할까요?')) {
    return;
  }

  const res = await fetch(`/calendar/events/${eventId}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    alert('일정 삭제 실패');
    return;
  }

  closeEventModal();

  await loadCalendarData();
  renderCalendar();

  if (selectedDateStr) {
    selectDate(selectedDateStr);
  }
}

function closeEventModal() {
  document.getElementById('event-modal').style.display = 'none';
  document.getElementById('event-form').reset();
  setEventFormReadOnly(false);

  document.getElementById('event-id').value = '';
  document.getElementById('event-modal-title').textContent = '일정 추가';
  document.getElementById('delete-event-btn').style.display = 'none';

  document.getElementById('event-all-day').checked = true;
  document.getElementById('event-start-time').value = '';
  document.getElementById('event-end-time').value = '';
  toggleTimeFields();
}

function formatEventDate(event) {
  const startDate = toInputDate(event.startDate);
  const endDate = toInputDate(event.endDate || event.startDate);

  if (event.isAllDay) {
    if (startDate === endDate) {
      return startDate;
    }
    return `${startDate} ~ ${endDate}`;
  }

  const startTime = toInputTime(event.startDate);
  const endTime = toInputTime(event.endDate || event.startDate);

  if (startDate === endDate) {
    return `${startDate} ${startTime} ~ ${endTime}`;
  }

  return `${startDate} ${startTime} ~ ${endDate} ${endTime}`;

}

function toggleTimeFields() {
  const isAllDay = document.getElementById('event-all-day').checked;
  const timeFields = document.querySelectorAll('.event-time-field');

  timeFields.forEach(field => {
    field.style.display = isAllDay ? 'none' : 'block';
  });
}

function toInputTime(dateValue) {
  const date = new Date(dateValue);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

//다일일정인지 구분 함수
function isMultiDayEvent(event) {
  const start = toInputDate(event.startDate);
  const end = toInputDate(event.endDate || event.startDate);

  return start !== end;
}

async function refreshCalendarView() {
  const timetableRes = await fetch('/calendar/timetables');
  window.timetables = await timetableRes.json();

  renderCalendar();
  renderTimetable();

  if (selectedDateStr) {
    selectDate(selectedDateStr);
  }
}

window.refreshCalendarView = refreshCalendarView;
window.openCalendarEventByKey = openCalendarEventByKey;