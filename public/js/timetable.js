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
  return window.timetables.filter(item => {
    return item.schedule.some(sch => {
      const startHour = Number(sch.startTime.split(':')[0]);
      const endHour = Number(sch.endTime.split(':')[0]);

      return sch.dayOfWeek === dayOfWeek &&
             hour >= startHour &&
             hour < endHour;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('open-timetable-form-btn');
  const closeBtn = document.getElementById('close-timetable-form-btn');
  const form = document.getElementById('timetable-form');
  const semesterInput = document.getElementById('tt-semester');

  if (!openBtn || !closeBtn || !form) return;

  openBtn.addEventListener('click', openTimetableModal);
  closeBtn.addEventListener('click', closeTimetableModal);
  form.addEventListener('submit', createTimetable);

  semesterInput.addEventListener('input', toggleLectureFields);
});

function openTimetableModal() {
  const form = document.getElementById('timetable-form');

  form.reset();

  document.getElementById('timetable-id').value = '';
  document.getElementById('timetable-modal-title').textContent = '시간표 추가';
  document.getElementById('tt-type').value = 'lecture';
  document.getElementById('tt-credits').value = 0;
  document.getElementById('tt-color').value = '#60A5FA';
  document.getElementById('delete-timetable-btn').style.display = 'none';

  toggleLectureFields();

  document.getElementById('timetable-modal').style.display = 'flex';
}

function closeTimetableModal() {
  document.getElementById('timetable-modal').style.display = 'none';
  document.getElementById('timetable-form').reset();

  document.getElementById('timetable-id').value = '';
  document.getElementById('timetable-modal-title').textContent = '시간표 추가';
  document.getElementById('delete-timetable-btn').style.display = 'none';
}

function toggleLectureFields() {
  const semester = document.getElementById('tt-semester').value.trim();

  const professorInput = document.getElementById('tt-professor');
  const creditsInput = document.getElementById('tt-credits');

  const isLecture = semester !== '';

  professorInput.disabled = !isLecture;
  creditsInput.disabled = !isLecture;

  if (!isLecture) {
    professorInput.value = '';
    creditsInput.value = 0;
  }
}

async function createTimetable(e) {
  e.preventDefault();

  const semester = document.getElementById('tt-semester').value.trim();
  const title = document.getElementById('tt-title').value.trim();
  const startTime = document.getElementById('tt-start-time').value;
  const endTime = document.getElementById('tt-end-time').value;

  if (!title) {
    alert('제목을 입력해 주세요.');
    return;
  }

  if (!startTime || !endTime) {
    alert('시작 시간과 종료 시간을 입력해 주세요.');
    return;
  }

  if (startTime >= endTime) {
    alert('종료 시간은 시작 시간보다 늦어야 합니다.');
    return;
  }

  const timetableData = {
    semester: semester || null,
    title,
    location: document.getElementById('tt-location').value || null,
    type: document.getElementById('tt-type').value || (semester ? 'lecture' : 'other'),
    professorName: semester ? document.getElementById('tt-professor').value || null : null,
    credits: semester ? Number(document.getElementById('tt-credits').value || 0) : 0,
    color: document.getElementById('tt-color').value || '#60A5FA',
    schedule: [
      {
        dayOfWeek: Number(document.getElementById('tt-day').value),
        startTime,
        endTime
      }
    ]
  };

  const res = await fetch('/calendar/timetables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(timetableData)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    alert(errorData?.error || '시간표 저장 실패');
    return;
  }

  closeTimetableModal();

  const timetableRes = await fetch('/calendar/timetables');
  window.timetables = await timetableRes.json();

  renderTimetable();
}