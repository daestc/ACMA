function renderTimetable() {
  const grid = document.getElementById('timetable-grid');

  const days = [
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
  ];

  const startHour = 8;
  const endHour = 22;
  const slotMinutes = 30;
  const slotHeight = 40;

  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const slotCount = (endMinutes - startMinutes) / slotMinutes;

  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `72px repeat(${days.length}, 1fr)`;
  grid.style.gridTemplateRows = `56px repeat(${slotCount}, ${slotHeight}px)`;
  grid.style.position = 'relative';

  grid.innerHTML = '';

  // 헤더
  grid.innerHTML += `<div class="tt-header" style="grid-column:1; grid-row:1;"></div>`;

  days.forEach((day, index) => {
    grid.innerHTML += `
      <div class="tt-header" style="grid-column:${index + 2}; grid-row:1;">
        ${day.label}
      </div>
    `;
  });

  // 배경 칸
  for (let i = 0; i < slotCount; i++) {
    const minutes = startMinutes + i * slotMinutes;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const row = i + 2;

    grid.innerHTML += `
      <div class="tt-time" style="grid-column:1; grid-row:${row};">
        ${minute === 0 ? `${String(hour).padStart(2, '0')}:00` : ''}
      </div>
    `;

    days.forEach((day, dayIndex) => {
      grid.innerHTML += `
        <div 
          class="tt-cell" 
          style="grid-column:${dayIndex + 2}; grid-row:${row};"
        ></div>
      `;
    });
  }

  // 시간표 블록
  window.timetables.forEach(item => {
    item.schedule.forEach(sch => {
      const dayIndex = days.findIndex(day => day.value === Number(sch.dayOfWeek));
      if (dayIndex === -1) return;

      const start = timeToMinutes(sch.startTime);
      const end = timeToMinutes(sch.endTime);

      if (end <= startMinutes || start >= endMinutes) return;

      const visibleStart = Math.max(start, startMinutes);
      const visibleEnd = Math.min(end, endMinutes);

      const startLine = Math.floor((visibleStart - startMinutes) / slotMinutes) + 2;
      const endLine = Math.ceil((visibleEnd - startMinutes) / slotMinutes) + 2;

      const block = document.createElement('div');
      block.className = 'tt-class-block';
      block.style.gridColumn = `${dayIndex + 2}`;
      block.style.gridRow = `${startLine} / ${endLine}`;
      block.style.background = item.color || '#60A5FA';

      block.innerHTML = `
        <strong>${item.title}</strong><br>
        <small>${sch.startTime}~${sch.endTime}</small><br>
        <small>${item.location || ''}</small>
      `;
      block.addEventListener('click', () => {
        openTimetableDetail(item._id);
      });

      grid.appendChild(block);
    });
  });
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('open-timetable-form-btn');
  const closeBtn = document.getElementById('close-timetable-form-btn');
  const form = document.getElementById('timetable-form');
  const semesterInput = document.getElementById('tt-semester');
  
  setSemesterOptions();

  if (!openBtn || !closeBtn || !form) return;

  document.getElementById('delete-timetable-btn').addEventListener('click', deleteTimetable);
  document
  .getElementById('add-schedule-row-btn')
  .addEventListener('click', () => addScheduleRow());
  openBtn.addEventListener('click', openTimetableModal);
  closeBtn.addEventListener('click', closeTimetableModal);
  form.addEventListener('submit', createTimetable);

  semesterInput.addEventListener('change', toggleLectureFields);
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
  document.getElementById('tt-schedule-list').innerHTML = '';
  addScheduleRow();

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
  const schedule = getScheduleFromForm();

  if (!schedule) return;

  if (!title) {
    alert('제목을 입력해 주세요.');
    return;
  }


  const timetableData = {
    semester: semester || null,
    title,
    location: document.getElementById('tt-location').value || null,
    type: document.getElementById('tt-type').value || (semester ? 'lecture' : 'other'),
    professorName: semester
      ? document.getElementById('tt-professor').value || null
      : null,
    credits: semester
      ? Number(document.getElementById('tt-credits').value || 0)
      : 0,
    color: document.getElementById('tt-color').value || '#60A5FA',
    schedule
  };

  const timetableId = document.getElementById('timetable-id').value;

  const url = timetableId
    ? `/calendar/timetables/${timetableId}`
    : '/calendar/timetables';

  const method = timetableId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
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

function openTimetableDetail(timetableId) {
  const item = window.timetables.find(t => t._id === timetableId);
  if (!item) return;

  

  document.getElementById('timetable-id').value = item._id;
  document.getElementById('timetable-modal-title').textContent = '시간표 상세 / 수정';

  document.getElementById('tt-semester').value = item.semester || '';
  document.getElementById('tt-title').value = item.title || '';
  document.getElementById('tt-location').value = item.location || '';
  document.getElementById('tt-type').value = item.type || 'lecture';
  document.getElementById('tt-professor').value = item.professorName || '';
  document.getElementById('tt-credits').value = item.credits || 0;
  document.getElementById('tt-color').value = item.color || '#60A5FA';

  document.getElementById('tt-schedule-list').innerHTML = '';

  item.schedule.forEach(sch => {
    addScheduleRow(sch);
  });

  document.getElementById('delete-timetable-btn').style.display = 'inline-block';

  toggleLectureFields();

  document.getElementById('timetable-modal').style.display = 'flex';
}

async function deleteTimetable() {
  const timetableId = document.getElementById('timetable-id').value;

  if (!timetableId) return;

  if (!confirm('이 시간표를 삭제할까요?')) {
    return;
  }

  const res = await fetch(`/calendar/timetables/${timetableId}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    alert('시간표 삭제 실패');
    return;
  }

  closeTimetableModal();

  const timetableRes = await fetch('/calendar/timetables');
  window.timetables = await timetableRes.json();

  renderTimetable();
}

function addScheduleRow(schedule = {}) {
  const list = document.getElementById('tt-schedule-list');

  const row = document.createElement('div');
  row.className = 'tt-schedule-row';

  row.innerHTML = `
    <select class="tt-day" required>
      <option value="1">월</option>
      <option value="2">화</option>
      <option value="3">수</option>
      <option value="4">목</option>
      <option value="5">금</option>
    </select>

    <select class="tt-start-time" required>
      ${getTimeOptions()}
    </select>

    <select class="tt-end-time" required>
      ${getTimeOptions()}
    </select>
    <button type="button" class="btn btn-sm remove-schedule-row-btn">삭제</button>
  `;

  row.querySelector('.tt-day').value = schedule.dayOfWeek ?? 1;
  row.querySelector('.tt-start-time').value = schedule.startTime || '';
  row.querySelector('.tt-end-time').value = schedule.endTime || '';

  row.querySelector('.remove-schedule-row-btn').addEventListener('click', () => {
    const rows = document.querySelectorAll('.tt-schedule-row');

    if (rows.length <= 1) {
      alert('시간 정보는 최소 1개 이상 필요합니다.');
      return;
    }

    row.remove();
  });

  list.appendChild(row);
}

function getScheduleFromForm() {
  const rows = document.querySelectorAll('.tt-schedule-row');

  if (rows.length === 0) {
    alert('시간 정보를 최소 1개 이상 입력해 주세요.');
    return null;
  }

  const schedule = [];

  for (const row of rows) {
    const dayOfWeek = Number(row.querySelector('.tt-day').value);
    const startTime = row.querySelector('.tt-start-time').value;
    const endTime = row.querySelector('.tt-end-time').value;

    if (!startTime || !endTime) {
      alert('모든 시간 정보의 시작 시간과 종료 시간을 입력해 주세요.');
      return null;
    }

    if (startTime >= endTime) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return null;
    }

    if (!isValidTimetableTime(startTime) || !isValidTimetableTime(endTime)) {
      alert('시간은 08:00~22:00 사이에서 30분 단위로 입력해야 합니다.');
      return null;
    }

    schedule.push({ dayOfWeek, startTime, endTime });
  }

  return schedule;
}

function setSemesterOptions() {
  const semesterSelect = document.getElementById('tt-semester');
  const year = new Date().getFullYear();

  semesterSelect.innerHTML = `
    <option value="">학기 없음</option>
    <option value="${year}-1">${year}-1</option>
    <option value="${year}-2">${year}-2</option>
  `;
}

function isValidTimetableTime(time) {
  const minutes = timeToMinutes(time);

  if (minutes < 8 * 60 || minutes > 22 * 60) {
    return false;
  }

  return minutes % 30 === 0;
}

function getTimeOptions() {
  let options = '<option value="">시간 선택</option>';

  for (let hour = 8; hour <= 22; hour++) {
    for (let minute of [0, 30]) {
      if (hour === 22 && minute === 30) continue;

      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options += `<option value="${value}">${value}</option>`;
    }
  }

  return options;
}