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
