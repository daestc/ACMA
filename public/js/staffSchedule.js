// 일정 종류(UniversitySchedule.type) — 서버 허용 값은 모델 enum이고, EJS 화면의 표시 이름은 여기 한 곳에만 둔다.
// 중간·기말고사는 주간 계획의 시험 기간 판단에, 방학·개강·수강신청은 학사 단계 판단에 쓰인다.
const SCHEDULE_TYPES = [
  { value: 'semester_start', label: '개강', placeholder: '예: 2026-2학기 개강' },
  { value: 'midterm', label: '중간고사', placeholder: '예: 2026-2학기 중간고사' },
  { value: 'final', label: '기말고사', placeholder: '예: 2026-2학기 기말고사' },
  { value: 'vacation', label: '방학', placeholder: '예: 2026 겨울방학' },
  { value: 'registration', label: '수강신청', placeholder: '예: 2026-1학기 수강신청' },
  { value: 'holiday', label: '휴일', placeholder: '예: 개교기념일' },
  { value: 'orientation', label: '오리엔테이션', placeholder: '예: 신입생 오리엔테이션' },
  { value: 'other', label: '기타', placeholder: '예: 2026-1학기 수강신청' },
];
const EXAM_TYPES = ['midterm', 'final'];
const PERIOD_TYPES = ['semester_start', 'midterm', 'final', 'vacation', 'registration'];
const LOOKS_LIKE_EXAM = /중간고사|기말고사|시험/;
const scheduleTypeOf = value => SCHEDULE_TYPES.find(t => t.value === value) || SCHEDULE_TYPES.find(t => t.value === 'other');

function updateTypeHints() {
  const type = document.getElementById('sch-type').value;
  document.getElementById('sch-title').placeholder = scheduleTypeOf(type).placeholder;
  const noEnd = !document.getElementById('sch-end').value;
  document.getElementById('sch-end-hint').style.display = PERIOD_TYPES.includes(type) && noEnd ? 'block' : 'none';
}

// 목록의 종류 배지. 서버가 렌더링한 빈 span(data-type, data-title)을 채운다.
function renderTypeBadges() {
  document.querySelectorAll('.sch-type-badge').forEach(el => {
    const type = scheduleTypeOf(el.dataset.type).value;
    const badge = document.createElement('span');
    const isExam = EXAM_TYPES.includes(type);
    badge.className = isExam ? 'badge badge-red' : 'badge';
    // EJS 스타일시트에는 badge-gray가 없어 React(index.css)와 같은 색을 직접 준다
    if (!isExam) badge.style.cssText = 'background:#f1f5f9;color:#64748b;';
    badge.style.marginRight = '6px';
    badge.textContent = scheduleTypeOf(type).label;
    el.appendChild(badge);
    if (type === 'other' && LOOKS_LIKE_EXAM.test(el.dataset.title || '')) {
      const note = document.createElement('span');
      note.style.cssText = 'font-size:11px;font-weight:400;color:var(--text2);margin-right:6px;';
      note.textContent = '종류 확인 필요';
      el.appendChild(note);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('sch-type');
  select.innerHTML = SCHEDULE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
  select.value = 'other';
  select.addEventListener('change', updateTypeHints);
  document.getElementById('sch-end').addEventListener('input', updateTypeHints);
  updateTypeHints();
  renderTypeBadges();
});

function showMsg(text, isError) {
  const box = document.getElementById('sch-msg');
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

async function submitSchedule() {
  const type = document.getElementById('sch-type').value;
  const title = document.getElementById('sch-title').value.trim();
  const startDate = document.getElementById('sch-start').value;
  const endDate = document.getElementById('sch-end').value;
  const description = document.getElementById('sch-desc').value.trim();
  const btn = document.getElementById('sch-submit-btn');

  if (!title || !startDate) {
    showMsg('제목과 시작일을 입력해주세요.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const res = await fetch('/staff/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, startDate, endDate, description }),
    });
    const data = await res.json();

    if (data.ok) {
      showMsg('일정이 등록되었습니다.', false);
      setTimeout(() => { window.location.href = '/staff/schedules?page=1'; }, 800);
    } else {
      showMsg(data.message || '등록에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '일정 등록';
  }
}

async function deleteSchedule(id, btn) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;

  btn.disabled = true;
  try {
    const res = await fetch(`/staff/schedules/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page') || '1';
      window.location.href = `/staff/schedules?page=${page}`;
    } else {
      alert(data.message || '삭제에 실패했습니다.');
      btn.disabled = false;
    }
  } catch {
    alert('서버와 통신할 수 없습니다.');
    btn.disabled = false;
  }
}
