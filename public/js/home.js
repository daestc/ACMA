/* ================================================
   AcadMe — home.js
   홈 페이지 전용: 강의 탭 / 할 일 탭, 습관 트래커
   ================================================ */

// ── 강의 일정 / 할 일 탭 전환 ────────────────────
function switchHomeTodo(tab, btn) {
  document.getElementById('ht-lecture').style.display = 'none';
  document.getElementById('ht-todo').style.display    = 'none';
  document.getElementById('ht-' + tab).style.display  = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 모달 열기 / 닫기 ─────────────────────────────
function openTodoModal(defaultTab = 'lecture') {
  const overlay = document.getElementById('todo-add-modal-overlay');
  overlay.style.display = 'flex';
  switchModalTab(defaultTab);

  // 현재 선택된 탭 확인 후 맞는 탭으로 열기
  const activeTab = document.querySelector('#ht-lecture').style.display !== 'none'
    ? 'lecture' : 'todo';
  switchModalTab(activeTab);

  // 입력창 초기화
  clearModalInputs();

  // 입력창 포커스
  setTimeout(() => {
    const input = defaultTab === 'lecture'
      ? document.getElementById('lecture-name')
      : document.getElementById('todo-content');
    if (input) input.focus();
  }, 100);
}

function closeTodoModal() {
  document.getElementById('todo-add-modal-overlay').style.display = 'none';
  clearModalInputs();
}

function clearModalInputs() {
  document.getElementById('lecture-name').value  = '';
  document.getElementById('lecture-start').value = '09:00';
  document.getElementById('lecture-end').value   = '10:30';
  document.getElementById('lecture-room').value  = '';
  document.getElementById('todo-content').value  = '';
  document.getElementById('todo-deadline').value = '';
}

// ── 모달 탭 전환 ──────────────────────────────────
function switchModalTab(tab) {
  const isLecture = tab === 'lecture';

  // 폼 전환
  document.getElementById('modal-form-lecture').style.display = isLecture ? 'block' : 'none';
  document.getElementById('modal-form-todo').style.display    = isLecture ? 'none'  : 'block';

  // 탭 버튼 스타일 전환
  const lectureBtn = document.getElementById('modal-tab-lecture');
  const todoBtn    = document.getElementById('modal-tab-todo');

  lectureBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:700;
    transition:all .2s;background:${isLecture ? 'var(--accent)' : 'transparent'};
    color:${isLecture ? 'white' : 'var(--text2)'};cursor:pointer;`;

  todoBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:${isLecture ? '600' : '700'};
    transition:all .2s;background:${isLecture ? 'transparent' : 'var(--accent)'};
    color:${isLecture ? 'var(--text2)' : 'white'};cursor:pointer;`;
}

// ── 항목 추가 확인 ────────────────────────────────
function confirmAddTodo() {
  const isLecture = document.getElementById('modal-form-lecture').style.display !== 'none';

  if (isLecture) {
    addLectureItem();
  } else {
    addTodoItem();
  }
}

// ── 강의 일정 추가 ────────────────────────────────
function addLectureItem() {
  const name  = document.getElementById('lecture-name').value.trim();
  const start = document.getElementById('lecture-start').value;
  const end   = document.getElementById('lecture-end').value;
  const room  = document.getElementById('lecture-room').value.trim();

  if (!name) {
    document.getElementById('lecture-name').focus();
    document.getElementById('lecture-name').style.borderColor = 'var(--red)';
    setTimeout(() => {
      document.getElementById('lecture-name').style.borderColor = '';
    }, 1500);
    return;
  }

  // 화면에 항목 추가
  const list = document.getElementById('ht-lecture');
  const item = document.createElement('div');
  item.className = 'check-item';
  item.innerHTML = `
    <div class="check-box" onclick="toggleCheck(this)"></div>
    <span class="check-text">${name} (${start} ~ ${end})${room ? ' · ' + room : ''}</span>
    <span class="check-time">예정</span>`;
  list.appendChild(item);

  // TODO: POST /api/calendar/checklist API 호출
  // await fetch('/api/calendar/checklist', {
  //   method: 'POST',
  //   body: JSON.stringify({ content: name, startTime: start, endTime: end, itemType: 'lecture' })
  // });

  closeTodoModal();
}

// ── 할 일 추가 ────────────────────────────────────
function addTodoItem() {
  const content  = document.getElementById('todo-content').value.trim();
  const deadline = document.getElementById('todo-deadline').value;

  if (!content) {
    document.getElementById('todo-content').focus();
    document.getElementById('todo-content').style.borderColor = 'var(--red)';
    setTimeout(() => {
      document.getElementById('todo-content').style.borderColor = '';
    }, 1500);
    return;
  }

  // 화면에 항목 추가
  const list = document.getElementById('ht-todo');
  const item = document.createElement('div');
  item.className = 'check-item';
  item.innerHTML = `
    <div class="check-box" onclick="toggleCheck(this)"></div>
    <span class="check-text">${content}</span>
    <span class="check-time">${deadline || '오늘'}</span>`;
  list.appendChild(item);

  // TODO: POST /api/calendar/checklist API 호출
  // await fetch('/api/calendar/checklist', {
  //   method: 'POST',
  //   body: JSON.stringify({ content, deadline, itemType: 'todo' })
  // });

  closeTodoModal();
}

// ── 습관 트래커 ───────────────────────────────────
function toggleHabit(el) {
  const isDone = el.dataset.done === 'true';
  el.dataset.done = isDone ? 'false' : 'true';

  const check = el.querySelector('.habit-check');
  const name  = el.querySelector('.habit-name');

  if (!isDone) {
    check.classList.add('done');
    check.textContent = '✓';
    name.classList.add('done');
  } else {
    check.classList.remove('done');
    check.textContent = '';
    name.classList.remove('done');
  }
  updateHabitSummary();
}

function updateHabitSummary() {
  const items = document.querySelectorAll('#habit-list .habit-item');
  const total = items.length;
  const done  = [...items].filter(i => i.dataset.done === 'true').length;

  const summary = document.getElementById('habit-summary');
  const bar     = document.getElementById('habit-progress-bar');

  if (summary) summary.textContent = `${done} / ${total} 완료`;
  if (bar)     bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
}

function addHabitItem() {
  const row = document.getElementById('habit-input-row');
  const isVisible = row.style.display === 'flex';
  row.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) document.getElementById('habit-new-input').focus();
}

function confirmAddHabit() {
  const inp = document.getElementById('habit-new-input');
  const cat = document.getElementById('habit-category');
  const val = inp.value.trim();
  if (!val) return;

  const list = document.getElementById('habit-list');
  const div  = document.createElement('div');
  div.className    = 'habit-item';
  div.dataset.done = 'false';
  div.setAttribute('onclick', 'toggleHabit(this)');
  div.innerHTML = `
    <div class="habit-check"></div>
    <div class="habit-body">
      <div class="habit-name">${val}</div>
      <div class="habit-sub">${cat.value} · 매일</div>
    </div>`;

  list.appendChild(div);
  inp.value = '';
  document.getElementById('habit-input-row').style.display = 'none';
  updateHabitSummary();
}

// 페이지 로드 시 진행률 초기화
document.addEventListener('DOMContentLoaded', updateHabitSummary);
