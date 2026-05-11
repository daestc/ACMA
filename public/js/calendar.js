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

  const openEventFormBtn = document.getElementById('open-event-form-btn');
  const closeEventFormBtn = document.getElementById('close-event-form-btn');
  const eventModal = document.getElementById('event-modal');
  const eventForm = document.getElementById('event-form');

  openEventFormBtn.addEventListener('click', () => {
    eventModal.style.display = 'flex';
  });

  closeEventFormBtn.addEventListener('click', () => {
    eventModal.style.display = 'none';
    eventForm.reset();
  });

  eventForm.addEventListener('submit', createEvent);
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
      <div class="cal-day">
        <div class="day-num">${date}</div>
        <div class="day-events">
          ${dayEvents.map(event => `
            <span 
              class="event-dot"
              title="${event.title}"
              style="background:${event.color || '#3B82F6'}"
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

async function createEvent(e) {
  e.preventDefault();

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

  const res = await fetch('/calendar/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });

  if (!res.ok) {
    alert('일정 저장 실패');
    return;
  }

  document.getElementById('event-modal').style.display = 'none';
  document.getElementById('event-form').reset();

  await loadCalendarData();
  renderCalendar();
}
