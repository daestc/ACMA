/* ================================================
   AcadMe — calendar.js
   캘린더 페이지 전용: 월간 ↔ 주간 뷰 전환
   ================================================ */

function switchCalView(view) {
  const isMonth = view === 'month';

  document.getElementById('cal-month-view').style.display = isMonth ? 'block' : 'none';
  document.getElementById('cal-week-view').style.display  = isMonth ? 'none'  : 'block';

  document.getElementById('cal-tab-month').classList.toggle('active',  isMonth);
  document.getElementById('cal-tab-week').classList.toggle('active',  !isMonth);
}

let currentDate = new Date();
let events = [];
let timetables = [];
let selectedDateStr = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCalendarData();

  renderCalendar();
  renderTimetable();

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

  openEventFormBtn.addEventListener('click', () => {
    closeEventModal(); // 기존 값 초기화
    eventModal.style.display = 'flex'; // 모달 열기
  });

  closeEventFormBtn.addEventListener('click', closeEventModal);

  eventForm.addEventListener('submit', createEvent);

  document.getElementById('delete-event-btn').addEventListener('click', deleteEvent);
});

function switchCalView(view) {
  const isMonth = view === 'month';

  document.getElementById('cal-month-view').style.display = isMonth ? 'block' : 'none';
  document.getElementById('cal-week-view').style.display = isMonth ? 'none' : 'block';

  document.getElementById('cal-tab-month').classList.toggle('active', isMonth);
  document.getElementById('cal-tab-week').classList.toggle('active', !isMonth);
}

async function loadCalendarData() {
  const [eventRes, timetableRes] = await Promise.all([
    fetch('/calendar/events'),
    fetch('/calendar/timetables')
  ]);

  events = await eventRes.json();
  timetables = await timetableRes.json();
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
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return formatDate(
        eventDate.getFullYear(),
        eventDate.getMonth() + 1,
        eventDate.getDate()
      ) === dateStr;
    });

    grid.innerHTML += `
      <div class="cal-day" onclick="selectDate('${dateStr}')">
        <div class="day-num">${date}</div>
        <div class="day-events">
          ${dayEvents.map(event => `
            <span 
              class="event-dot"
              title="${event.title}&#10;${event.description || ''}&#10;${formatEventDate(event)}"
              style="background:${event.color || '#3B82F6'}"
              onclick="event.stopPropagation(); openEventDetail('${event._id}')"
            ></span>
          `).join('')}
       </div>
      </div>
`   ;
  }
}

function renderTimetable() {
  const grid = document.getElementById('timetable-grid');

  const days = ['월', '화', '수', '목', '금'];
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  grid.innerHTML = `
    <div class="tt-header"></div>
    ${days.map(day => `<div class="tt-header">${day}</div>`).join('')}
  `;

  hours.forEach(hour => {
    grid.innerHTML += `<div class="tt-time">${String(hour).padStart(2, '0')}:00</div>`;

    for (let day = 1; day <= 5; day++) {
      const classes = findTimetableByTime(day, hour);

      grid.innerHTML += `
        <div class="tt-cell">
          ${classes.map(item => `
            <div class="tt-class" style="background:${item.color || '#60A5FA'}">
              ${item.title}
              <br>
              <small>${item.location || ''}</small>
            </div>
          `).join('')}
        </div>
      `;
    }
  });
}

function findTimetableByTime(dayOfWeek, hour) {
  return timetables.filter(item => {
    return item.schedule.some(sch => {
      const startHour = Number(sch.startTime.split(':')[0]);
      const endHour = Number(sch.endTime.split(':')[0]);

      return sch.dayOfWeek === dayOfWeek && hour >= startHour && hour < endHour;
    });
  });
}

function formatDate(year, month, date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}
//일정 생성
async function createEvent(e) {
  e.preventDefault();

  const eventId = document.getElementById('event-id').value;

  const eventData = {
    title: document.getElementById('event-title').value,
    description: document.getElementById('event-description').value,
    startDate: document.getElementById('event-start-date').value,
    endDate: document.getElementById('event-end-date').value || document.getElementById('event-start-date').value,
    category: document.getElementById('event-category').value,
    color: document.getElementById('event-color').value,
    isAllDay: true,
    isDday: false
  };

  const url = eventId ? `/calendar/events/${eventId}` : '/calendar/events';
  const method = eventId ? 'PUT' : 'POST';

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
    <div class="selected-event-item" onclick="openEventDetail('${event._id}')">
      <span class="selected-event-dot" style="background:${event.color || '#3B82F6'}"></span>
      <span>${event.title}</span>
    </div>
  `).join('');
}

//일정 확인
function getEventsByDate(dateStr) {
  return events.filter(event => {
    const eventDate = new Date(event.startDate);
    const eventDateStr = formatDate(
      eventDate.getFullYear(),
      eventDate.getMonth() + 1,
      eventDate.getDate()
    );

    return eventDateStr === dateStr;
  });
}

//기존 모달에 값채우기
function openEventDetail(eventId) {
  const event = events.find(item => item._id === eventId);
  if (!event) return;

  document.getElementById('event-modal-title').textContent = '일정 상세 / 수정';

  document.getElementById('event-id').value = event._id;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-description').value = event.description || '';
  document.getElementById('event-start-date').value = toInputDate(event.startDate);
  document.getElementById('event-end-date').value = toInputDate(event.endDate || event.startDate);
  document.getElementById('event-category').value = event.category || 'personal';
  document.getElementById('event-color').value = event.color || '#3B82F6';

  document.getElementById('delete-event-btn').style.display = 'inline-block';
  document.getElementById('event-modal').style.display = 'flex';
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

  document.getElementById('event-id').value = '';
  document.getElementById('event-modal-title').textContent = '일정 추가';
  document.getElementById('delete-event-btn').style.display = 'none';
}

function formatEventDate(event) {
  const start = toInputDate(event.startDate);
  const end = toInputDate(event.endDate || event.startDate);

  if (start === end) {
    return start;
  }

  return `${start} ~ ${end}`;
}