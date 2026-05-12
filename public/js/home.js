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
function openTodoModal(defaultTab = 'todo') {
  const overlay = document.getElementById('todo-add-modal-overlay');
  overlay.style.display = 'flex';

  // todo모달 스타일
  document.getElementById('modal-form-todo').style.display = 'block';

  const todoBtn = document.getElementById('modal-tab-todo');

  todoBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:'700';
    transition:all .2s;background:var(--accent);
    color:'white';cursor:pointer;`;

  // 입력창 초기화
  clearModalInputs();

  // 입력창 포커스
  setTimeout(() => {
    const input = document.getElementById('todo-content');
    if (input) input.focus();
  }, 100);
}

function closeTodoModal() {
  document.getElementById('todo-add-modal-overlay').style.display = 'none';
  clearModalInputs();
}

function clearModalInputs() {
  document.getElementById('todo-content').value  = '';
  document.getElementById('todo-deadline').value = '';
}

// ── 할 일 추가 ────────────────────────────────────
async function addTodoItem() {
  const content  = document.getElementById('todo-content').value.trim();
  const note = document.getElementById('todo-deadline').value;

  // 제목입력이 없으면 경고표시
  if (!content) {
    document.getElementById('todo-content').focus();
    document.getElementById('todo-content').style.borderColor = 'var(--red)';
    setTimeout(() => {
      document.getElementById('todo-content').style.borderColor = '';
    }, 1500);
    return;
  }

  // DB에 todo 추가
  const response = await fetch('/user/addTodo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, note })
  });

  const result = await response.json();
  // DB에 성공적으로 저장하면 화면에 표시
  if(result.success) {
    // 화면에 항목 추가
    const list = document.getElementById('ht-todo');

    // 예시문구 삭제
    const placeholder = list.querySelector('.todo-exam');
    if(placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'check-item';
    item.innerHTML = `
      <div class="check-box" onclick="toggleCheck(this)"></div>
      <span class="check-text">${content}</span>
      <span class="check-time">${note || '오늘'}</span>`;
    // 마지막 자식 앞에 추가
    list.insertBefore(item, list.lastElementChild);
  }

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
