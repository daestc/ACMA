/* 
   AcadMe — lectureAdmin.js
   강의 관리 페이지 (대학관계자 전용):
   CSV / XLSX 일괄 등록, 개별 강의 등록, 강의 삭제
*/

const LECTURE_FILE_EXT = ['.csv', '.xlsx'];

function isLectureFile(file) {
  const name = file.name.toLowerCase();
  return LECTURE_FILE_EXT.some((ext) => name.endsWith(ext));
}

// CSV / XLSX 업로드
let csvFile = null;

function handleCsvFile(input) {
  if (!input.files || !input.files[0]) return;
  setCsvFile(input.files[0]);
}

function handleCsvDrop(e) {
  e.preventDefault();
  const zone = document.getElementById('csv-upload-zone');
  zone.style.borderColor = 'var(--border2)';
  zone.style.background  = 'var(--bg3)';
  const f = e.dataTransfer.files[0];
  if (f && isLectureFile(f)) setCsvFile(f);
}

function setCsvFile(file) {
  csvFile = file;
  document.getElementById('csv-file-name').textContent   = file.name;
  document.getElementById('csv-file-info').style.display = 'flex';
  document.getElementById('csv-upload-zone').style.display = 'none';
}

function clearCsvFile() {
  csvFile = null;
  document.getElementById('csv-file-input').value          = '';
  document.getElementById('csv-file-info').style.display   = 'none';
  document.getElementById('csv-upload-zone').style.display = 'block';
  document.getElementById('csv-result').style.display      = 'none';
}

function showCsvResult(html, isError) {
  const box = document.getElementById('csv-result');
  box.style.display    = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border     = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color      = isError ? 'var(--text)' : 'var(--green)';
  box.innerHTML        = html;
}

async function uploadCsv() {
  if (!csvFile) {
    showCsvResult('업로드할 CSV 또는 XLSX 파일을 먼저 선택해주세요.', true);
    return;
  }

  const btn = document.getElementById('csv-upload-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ 업로드 중...';

  const formData = new FormData();
  formData.append('csvFile', csvFile);
  formData.append('year', document.getElementById('csv-year').value);
  formData.append('semester', document.getElementById('csv-semester').value);

  try {
    const res  = await fetch('/staff/lectures/csv', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.ok) {
      let html = `처리 완료 — 신규 <strong>${data.inserted}</strong>건 / 갱신 <strong>${data.updated}</strong>건 (총 ${data.total}건)`;
      if (data.failedRows?.length) {
        html += `<br>건너뛴 행 ${data.failedRows.length}건: ` +
          data.failedRows.slice(0, 5).map(f => `${f.row}행`).join(', ') +
          (data.failedRows.length > 5 ? ' 외' : '');
      }
      showCsvResult(html, false);
      // 목록 갱신을 위해 2초 후 새로고침
      setTimeout(() => location.reload(), 2000);
    } else {
      showCsvResult(data.message || '업로드에 실패했습니다.', true);
    }
  } catch {
    showCsvResult('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled    = false;
    btn.textContent = '⬆ 파일 업로드';
  }
}

// 강의시간 행
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function addScheduleRow() {
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center;';
  row.innerHTML = `
    <select class="input-field sch-day" style="width:64px;">
      ${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
    </select>
    <input class="input-field sch-start" type="time" value="09:00" style="flex:1;">
    <span style="color:var(--text3);">~</span>
    <input class="input-field sch-end" type="time" value="10:30" style="flex:1;">
    <button onclick="this.parentElement.remove()" style="font-size:12px;color:var(--text2);padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg2);cursor:pointer;">✕</button>
  `;
  document.getElementById('schedule-rows').appendChild(row);
}

function getSchedules() {
  return Array.from(document.querySelectorAll('.schedule-row')).map(row => ({
    day: row.querySelector('.sch-day').value,
    startTime: row.querySelector('.sch-start').value,
    endTime: row.querySelector('.sch-end').value,
  }));
}

// 기본으로 1행 추가
document.addEventListener('DOMContentLoaded', addScheduleRow);

// 개별 강의 등록
function showLecMsg(msg, isError) {
  const box = document.getElementById('lec-msg');
  box.style.display    = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border     = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color      = isError ? 'var(--text)' : 'var(--green)';
  box.textContent      = msg;
}

async function submitLecture() {
  const body = {
    classification: document.getElementById('lec-classification').value,
    courseName: document.getElementById('lec-courseName').value.trim(),
    section: document.getElementById('lec-section').value,
    credits: document.getElementById('lec-credits').value,
    professor: document.getElementById('lec-professor').value.trim(),
    year: document.getElementById('lec-year').value,
    semester: document.getElementById('lec-semester').value,
    schedules: getSchedules(),
  };

  if (!body.courseName)            return showLecMsg('교과명을 입력해주세요.', true);
  if (!body.credits)               return showLecMsg('학점을 입력해주세요.', true);
  if (body.schedules.length === 0) return showLecMsg('강의시간을 1개 이상 추가해주세요.', true);
  for (const s of body.schedules) {
    if (!s.startTime || !s.endTime) return showLecMsg('강의시간의 시작/종료 시각을 입력해주세요.', true);
    if (s.startTime >= s.endTime)   return showLecMsg('종료 시간은 시작 시간보다 늦어야 합니다.', true);
  }

  const btn = document.getElementById('lec-submit-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ 등록 중...';

  try {
    const res  = await fetch('/staff/lectures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.ok) {
      const sectionLabel = body.section ? `${body.section}분반` : '분반 없음';
      showLecMsg(`"${body.courseName} ${sectionLabel}" 등록 완료`, false);
      setTimeout(() => location.reload(), 1200);
    } else {
      showLecMsg(data.message || '등록에 실패했습니다.', true);
    }
  } catch {
    showLecMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled    = false;
    btn.textContent = '강의 등록';
  }
}

// 강의 삭제
async function deleteLecture(id, label, btn) {
  if (!confirm(`"${label}" 강의를 삭제하시겠습니까?`)) return;

  btn.disabled = true;
  try {
    const res  = await fetch(`/staff/lectures/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      btn.closest('tr').remove();
    } else {
      alert(data.message || '삭제에 실패했습니다.');
      btn.disabled = false;
    }
  } catch {
    alert('서버와 통신할 수 없습니다.');
    btn.disabled = false;
  }
}
