/* ================================================
   AcadMe — home.js
   홈 페이지 전용: 강의 탭 / 할 일 탭, 습관 트래커
   ================================================ */

// 사용할 변수 선언
let selectedHabitId = null; // 현재 수정 중인 습관 id
let pendingChanges = {}; // habitList에서 변경된 값만 모아두기

// 페이지 로드 시 진행률 초기화
document.addEventListener('DOMContentLoaded', () => {
  updateHabitSummary();
  loadTodayLectures();
});

// 페이지 이탈시 isCompleted 수정 사항 DB 반영
document.addEventListener('visibilitychange', function() {
  // pendingChanges의 객체가 0이면 실행 X
  if (document.visibilityState === 'hidden' && Object.keys(pendingChanges).length > 0) {
    // 기존 async와 달리 sendBeacon으로 페이지가 닫혔을 때 API 요청
    const blob = new Blob(
      [JSON.stringify({ changes: pendingChanges })],
      { type: 'application/json' }
    );
    navigator.sendBeacon('/user/saveIsCompleted', blob);
    
    pendingChanges = {}; // 저장 후 변경사항 초기화
  }
});
let urgentNotices = []; 



// ── 강의 일정 / 할 일 탭 전환 ────────────────────
function switchHomeTodo(tab, btn) {
  document.getElementById('ht-lecture').style.display = 'none';
  document.getElementById('ht-todo').style.display    = 'none';
  document.getElementById('ht-' + tab).style.display  = 'block';

  // // 할일 탭 이면 수정버튼 활성화
  // if(tab === "todo") {document.getElementById('todo-refactor').style.display = 'block';}
  // else {document.getElementById('todo-refactor').style.display = 'none';}
  

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 오늘의 강의 불러오기 ────────────────────
async function loadTodayLectures() { 
  const lectureBox = document.getElementById('ht-lecture');
  if(!lectureBox) {
    console.log('오늘의 강의 실패');
    return;
  }

  try {
    const res = await fetch('/calendar/timetables');

    if (!res.ok) {
      lectureBox.innerHTML = `
        <div class="check-item">
          <span class="check-text">오늘의 강의를 불러오지 못했습니다.</span>
        </div>
      `;
      return;
    }

    const timetables = await res.json(); //불러온 db json변환

    const today = new Date();
    const todayDayOfWeek = today.getDay();

    const todayLectures = []; //오늘 강의를 담을 변수

    timetables.forEach(item => { //오늘 강의 추출
      if (!isTodayInSemester(today, item.semester)) return;

      (item.schedule || []).forEach(sch => {
        if(Number(sch.dayOfWeek) !== todayDayOfWeek) return;

        todayLectures.push({
          title: item.title,
          location: item.location,
          professorName: item.professorName,
          startTime: sch.startTime,
          endTime: sch.endTime,
          color: item.color || '#60A5FA'
        });
      });
    });

    todayLectures.sort((a,b) => a.startTime.localeCompare(b.startTime)); //정렬

    if (todayLectures.length === 0) { //오늘 강의가 없는경우
      lectureBox.innerHTML = `
        <div class="check-item">
          <span class="check-text">오늘 등록된 강의가 없습니다.</span>
        </div>
      `;
      return;
    }

    lectureBox.innerHTML = todayLectures.map(lecture => `
      <div class="check-item home-lecture-item">
        <span class="selected-event-dot" style="background:${lecture.color}"></span>
        <span class="check-text">
          ${escapeHtml(lecture.title)}
          <small style="display:block;color:var(--text2);margin-top:2px;">
            ${escapeHtml(lecture.location || '장소 미정')}
            ${lecture.professorName ? ` · ${escapeHtml(lecture.professorName)}` : ''}
          </small>
        </span>
        <span class="check-time">${lecture.startTime} ~ ${lecture.endTime}</span>
      </div>
    `).join('');

  } catch (error) {
    lectureBox.innerHTML = `
      <div class="check-item">
        <span class="check-text">오늘의 강의를 불러오지 못했습니다.</span>
      </div>
    `;
  }
}

// ── 현재 학기 계산  ────────────────────
function isTodayInSemester(date, semester) {
  if (!semester) return true;

  const match = String(semester).match(/^(\d{4})-([12])$/);
  if (!match) return true;

  const year = Number(match[1]);
  const term = Number(match[2]);

  let start;
  let end;

  if (term === 1) {
    start = new Date(year, 2, 1);
    end = new Date(year, 5, 30, 23, 59, 59);
  } else {
    start = new Date(year, 8, 1);
    end = new Date(year, 11, 31, 23, 59, 59);
  }

  return date >= start && date <= end;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 모달 열기 / 닫기 ─────────────────────────────
function openTodoModal(defaultTab = 'add') {
  const overlay = document.getElementById('todo-add-modal-overlay');
  overlay.style.display = 'flex';

  // todo모달 스타일
  document.getElementById('modal-form-addTodo').style.display = 'block';
  document.getElementById('modal-form-refactorTodo').style.display = 'none';

  switchModalTab(defaultTab);

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

// ── 모달 탭 전환 ──────────────────────────────────
function switchModalTab(tab) {
  const isAdd = tab === 'add';

  // 폼 전환
  document.getElementById('modal-form-addTodo').style.display = isAdd ? 'block' : 'none';
  document.getElementById('modal-form-refactorTodo').style.display    = isAdd ? 'none'  : 'block';

  // 탭 버튼 스타일 전환
  const addTodoBtn = document.getElementById('modal-tab-addTodo');
  const refactorTodoBtn    = document.getElementById('modal-tab-refactorTodo');

  document.getElementById('btn-delTodo').textContent = isAdd ? "추가" : "삭제";

  addTodoBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:700;
    transition:all .2s;background:${isAdd ? 'var(--accent)' : 'transparent'};
    color:${isAdd ? 'white' : 'var(--text2)'};cursor:pointer;`;

  refactorTodoBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:${isAdd ? '600' : '700'};
    transition:all .2s;background:${isAdd ? 'transparent' : 'var(--accent)'};
    color:${isAdd ? 'var(--text2)' : 'white'};cursor:pointer;`;
}

// ── 항목 추가 확인 ────────────────────────────────
function confirmAddTodo() {
  const isAdd = document.getElementById('modal-form-addTodo').style.display !== 'none';

  if (isAdd) {
    addTodoItem();
  } else {
    deleteTodoItem();
  }
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
    const todoDList = document.getElementById('todo-D-list');

    // 예시문구 삭제 home, todo_add
    const placeholderHome = list.querySelector('.todo-exam');
    if(placeholderHome) placeholderHome.remove();

    const placeholderAdd = todoDList.querySelector('.todo-Dexam');
    if(placeholderAdd) placeholderAdd.remove();

    // 추가한 todo항목 만들기
    const itemHome = document.createElement('div');
    itemHome.className = 'check-item';
    itemHome.dataset.id = result.todoId;
    itemHome.innerHTML = `
      <div class="check-box" onclick="toggleCheck(this)"></div>
      <span class="check-text">${content}</span>
      <span class="check-time">${note || '오늘'}</span>`;

    // 모달에서 사용할 todo 항목 복사
    const itemModal = itemHome.cloneNode(true);

    const modalCheckBox = itemModal.querySelector('.check-box');
    modalCheckBox.classList.add('delete-todo');

    // 마지막 자식 앞에 추가
    list.insertBefore(itemHome, list.lastElementChild);
    todoDList.appendChild(itemModal);

    
  }

  closeTodoModal();
}

// 할 일 삭제
async function deleteTodoItem() {
  const checkedBoxes = document.querySelectorAll('.delete-todo.checked');

  // 삭제할 todo의 id 가져오기
  const idsToDelete = Array.from(checkedBoxes).map(box => {
    return box.closest('.check-item').dataset.id; // 부모의 data-id 가져오기
  });

  // DB에 todo 삭제
  const response = await fetch('/user/deleteTodo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletetodoList: idsToDelete })
  });

  const result = await response.json();

  // DB에 성공적으로 삭제하면 화면에서 삭제
  if(result.success) {
    // home.ejs에 todo 삭제
    idsToDelete.forEach(id => {
      const htTodo = document.getElementById('ht-todo');
      const targetTodo = htTodo.querySelector(`div[data-id="${id}"]`);
      if (targetTodo) {
        targetTodo.remove();
      }
    });

    // todo_add.ejs에 todo 삭제
    idsToDelete.forEach(id => {
      const modalFormRefactorTodo = document.getElementById('modal-form-refactorTodo');
      const targetTodo = modalFormRefactorTodo.querySelector(`div[data-id="${id}"]`);
      if (targetTodo) {
        targetTodo.remove();
      }
    });
  }

  closeTodoModal();
} // deleteTodoItem()

// 습관 클릭 시 완료 || 미완료 처리
function toggleHabit(el) {
  const isDone = el.dataset.done === 'true';
  el.dataset.done = isDone ? false : true;
  const habitId = el.dataset.id;

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

  // 클릭한 habit 찾기
  const habit = habits.find(h => h._id === habitId);
  habit.isCompleted = !habit.isCompleted;
  
  // 변경된 내용 기록
  pendingChanges[habitId] = habit.isCompleted;

  updateHabitSummary();
}

// 진행도 막대 그래프 표시
function updateHabitSummary() {
  const items = document.querySelectorAll('#habit-list .habit-item');
  const total = items.length;
  const done  = [...items].filter(i => i.dataset.done === 'true').length;

  const summary = document.getElementById('habit-summary');
  const bar     = document.getElementById('habit-progress-bar');

  if (summary) summary.textContent = `${done} / ${total} 완료`;
  if (bar)     bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
}

// 습관 트래커 수정 모달 열기
function openHabitModal() {
  const overlay = document.getElementById('habit-modal-overlay');
  overlay.style.display = 'flex';
  switchHabitTab('add');
  clearHabitModal();

  // add 입력 창 포커스
  setTimeout(() => document.getElementById('habit-add-name').focus(), 100);
}

// 습관 트래커 수정 모달 닫기
function closeHabitModal() {
  document.getElementById('habit-modal-overlay').style.display = 'none';
  clearHabitModal();
}

// 습관 트래커 수정 입력 내용 초기화
function clearHabitModal() {
  // 추가 폼 초기화
  document.getElementById('habit-add-name').value = '';

  // 카테고리 초기화 (첫 번째 항목 선택)
  const catBtns = document.querySelectorAll('.habit-cat-btn');
  catBtns.forEach((btn, i) => {
    const isFirst = i === 0;
    btn.style.background = isFirst ? 'var(--green-bg)' : 'var(--bg3)';
    btn.style.borderColor = isFirst ? 'var(--green)'   : 'var(--border)';
    btn.style.color       = isFirst ? 'var(--green)'   : 'var(--text2)';
    if (isFirst) btn.classList.add('active');
    else         btn.classList.remove('active');
  });

  // 수정 폼 닫기
  cancelHabitEdit();
}

// 습관 수정 탭 전환
function switchHabitTab(tab) {
  const isAdd = tab === 'add';

  document.getElementById('habit-form-add').style.display  = isAdd ? 'block' : 'none';
  document.getElementById('habit-form-edit').style.display = isAdd ? 'none'  : 'block';

  const addBtn  = document.getElementById('habit-tab-add');
  const editBtn = document.getElementById('habit-tab-edit');

  addBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:700;
    transition:all .2s;background:${isAdd ? 'var(--accent)' : 'transparent'};
    color:${isAdd ? 'white' : 'var(--text2)'};cursor:pointer;`;

  editBtn.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:${isAdd ? '600' : '700'};
    transition:all .2s;background:${isAdd ? 'transparent' : 'var(--accent)'};
    color:${isAdd ? 'var(--text2)' : 'white'};cursor:pointer;`;

  // 수정 탭으로 전환 시 목록 렌더링
  if (!isAdd) renderHabitEditList();
}

// 습관 추가 탭 카테고리 선택
function selectHabitCategory(el) {
  const catMap = {
    '건강': { bg: 'var(--green-bg)',  border: 'var(--green)',  color: 'var(--green)'  },
    '학습': { bg: 'var(--accent-bg)', border: 'var(--accent)', color: 'var(--accent)' },
    '마음': { bg: 'var(--purple-bg)', border: 'var(--purple)', color: 'var(--purple)' },
    '성장': { bg: 'var(--amber-bg)',  border: 'var(--amber)',  color: 'var(--amber)'  },
  };

  document.querySelectorAll('.habit-cat-btn').forEach(btn => {
    btn.style.background  = 'var(--bg3)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color       = 'var(--text2)';
    btn.classList.remove('active');
  });

  const cat = el.dataset.cat;
  el.style.background  = catMap[cat].bg;
  el.style.borderColor = catMap[cat].border;
  el.style.color       = catMap[cat].color;
  el.classList.add('active');
}

// 습관 수정 탭 카테고리 선택
function selectHabitEditCategory(el) {
  const catMap = {
    '건강': { bg: 'var(--green-bg)',  border: 'var(--green)',  color: 'var(--green)'  },
    '학습': { bg: 'var(--accent-bg)', border: 'var(--accent)', color: 'var(--accent)' },
    '마음': { bg: 'var(--purple-bg)', border: 'var(--purple)', color: 'var(--purple)' },
    '성장': { bg: 'var(--amber-bg)',  border: 'var(--amber)',  color: 'var(--amber)'  },
  };

  document.querySelectorAll('.habit-edit-cat-btn').forEach(btn => {
    btn.style.background  = 'var(--bg2)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color       = 'var(--text2)';
    btn.classList.remove('active');
  });

  const cat = el.dataset.cat;
  el.style.background  = catMap[cat].bg;
  el.style.borderColor = catMap[cat].border;
  el.style.color       = catMap[cat].color;
  el.classList.add('active');
}

// 추가 / 수정 display로 분기
function confirmHabitAction() {
  const isAdd = document.getElementById('habit-form-add').style.display !== 'none';
  isAdd ? addHabitFromModal() : confirmHabitEdit();
}

// 습관 추가
async function addHabitFromModal() {
  const name = document.getElementById('habit-add-name').value.trim();

  // 입력 내용이 없으면 빈칸 강조 표시
  if (!name) {
    const input = document.getElementById('habit-add-name');
    input.style.borderColor = 'var(--red)';
    input.focus();
    setTimeout(() => input.style.borderColor = '', 1500);
    return;
  }

  // 카테고리 가져오기 defalut: 건강
  const activeCat = document.querySelector('.habit-cat-btn.active');
  const category  = activeCat ? activeCat.dataset.cat : '건강';

  // DB에 habit 추가 및 _id, success 값 가져오기
  const response = await fetch('/user/addHabit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: name, category })
  });

  const result = await response.json();
  // DB에 성공적으로 저장하면 화면에 표시
  if(result.success) {
    // 화면에 항목 추가
    const list = document.getElementById('habit-list');
    const div  = document.createElement('div');
    div.className    = 'habit-item';
    div.dataset.id = result.habitId;
    div.dataset.done = 'false';
    div.setAttribute('onclick', 'toggleHabit(this)');
    div.innerHTML = `
      <div class="habit-check"></div>
      <div class="habit-body">
        <div class="habit-name">${name}</div>
        <div class="habit-sub">${category} · 매일</div>
      </div>`;
    list.appendChild(div);
    updateHabitSummary();
    
    habits.push({
      _id: result.habitId,
      isCompletd: false
    });
  }

  clearHabitModal();
  document.getElementById('habit-add-name').focus();
}

// 습관 수정 목록 렌더링
function renderHabitEditList() {
  const items     = document.querySelectorAll('#habit-list .habit-item');
  const container = document.getElementById('habit-edit-list');

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">
        등록된 습관이 없습니다!
      </div>`;
    return;
  }

  container.innerHTML = [...items].map((item, i) => {
    const name = item.querySelector('.habit-name').textContent;
    const sub  = item.querySelector('.habit-sub').textContent;
    const habitId = item.dataset.id;
    return `
      <div data-id="${habitId}" style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 12px;border-bottom:1px solid var(--border);gap:8px;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">${name}</div>
          <div style="font-size:11px;color:var(--text2);">${sub}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="openHabitEditForm('${habitId}')"
            class="btn btn-ghost btn-sm">수정</button>
          <button onclick="deleteHabit('${habitId}')"
            style="padding:5px 12px;border-radius:var(--radius-sm);font-size:12px;
                   font-weight:700;background:var(--red-bg);color:var(--red);
                   border:1.5px solid #fecdd3;cursor:pointer;transition:all .2s;">
            삭제
          </button>
        </div>
      </div>`;
  }).join('');
}

// 습관 수정 폼 열기
function openHabitEditForm(id) {
  selectedHabitId = id;
  const item = document.querySelector(`[data-id="${id}"]`);

  const name     = item.querySelector('.habit-name').textContent;
  const subText  = item.querySelector('.habit-sub').textContent;
  const category = subText.split(' · ')[0];

  document.getElementById('habit-edit-name').value = name;
  document.getElementById('habit-edit-form').style.display = 'block';

  // 카테고리 버튼 선택 상태 반영
  document.querySelectorAll('.habit-edit-cat-btn').forEach(btn => {
    const isMatch = btn.dataset.cat === category;
    const catMap  = {
      '건강': { bg: 'var(--green-bg)',  border: 'var(--green)',  color: 'var(--green)'  },
      '학습': { bg: 'var(--accent-bg)', border: 'var(--accent)', color: 'var(--accent)' },
      '마음': { bg: 'var(--purple-bg)', border: 'var(--purple)', color: 'var(--purple)' },
      '성장': { bg: 'var(--amber-bg)',  border: 'var(--amber)',  color: 'var(--amber)'  },
    };
    btn.style.background  = isMatch ? catMap[category].bg     : 'var(--bg2)';
    btn.style.borderColor = isMatch ? catMap[category].border : 'var(--border)';
    btn.style.color       = isMatch ? catMap[category].color  : 'var(--text2)';
    if (isMatch) btn.classList.add('active');
    else         btn.classList.remove('active');
  });

  document.getElementById('habit-edit-name').focus();
}

// 습관 수정 완료
async function confirmHabitEdit() {
  if (!selectedHabitId) return;

  const name = document.getElementById('habit-edit-name').value.trim();

  // 제목 입력 없으면 강조 표시
  if (!name) {
    const input = document.getElementById('habit-edit-name');
    input.style.borderColor = 'var(--red)';
    input.focus();
    setTimeout(() => input.style.borderColor = '', 1500);
    return;
  }

  const activeCat = document.querySelector('.habit-edit-cat-btn.active');
  const category  = activeCat ? activeCat.dataset.cat : '건강';

  // DB에 habit 수정
  const response = await fetch('/user/editHabit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: name, category, habitId: selectedHabitId })
  });

  const result = await response.json();

  // DB에 성공적으로 수정되면 화면도 수정
  if(result.success) {
    // 화면의 habit-item 업데이트
    const item = document.querySelector(`[data-id="${selectedHabitId}"]`);
    item.querySelector('.habit-name').textContent = name;
    item.querySelector('.habit-sub').textContent  = `${category} · 매일`;
  }

  cancelHabitEdit();
  renderHabitEditList();
  updateHabitSummary();
}

// 습관 수정 취소
function cancelHabitEdit() {
  document.getElementById('habit-edit-form').style.display = 'none';
  document.getElementById('habit-edit-name').value = '';
  selectedHabitId = null;
}

// 습관 삭제
async function deleteHabit(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  // DB에 habit 삭제
  const response = await fetch('/user/deleteHabit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habitId: id })
  });

  const result = await response.json();

  // DB에 성공적으로 삭제되면 화면에서도 삭제
  if(result.success) {
    // 화면의 해당 habit 삭제
    item.remove();
  }

  renderHabitEditList();
  updateHabitSummary();
}

document.addEventListener('DOMContentLoaded', () => {
  //  화면에 있는 모든 슬라이더 컨테이너를 찾음 (자격증, 시험, 학사일정)
  const sliderContainers = document.querySelectorAll('.slider-container');
  
  sliderContainers.forEach(container => {
    const items = container.querySelectorAll('.slider-item');
    
    // 항목이 없거나 1개뿐이면 돌릴 필요가 없으니 패스!
    if (items.length <= 1) return; 

    let currentIndex = 0;
    
    // 3초(3000ms)마다 번갈아가면서 보여주기
    setInterval(() => {
      // 현재 켜져있는 거 끄기
      items[currentIndex].classList.remove('active');
      
      // 다음 순서로 넘어가기 (마지막이면 다시 처음으로 0)
      currentIndex = (currentIndex + 1) % items.length;
      
      // 다음 거 켜기
      items[currentIndex].classList.add('active');
    }, 3000); 
  });
});



