/* ================================================
   AcadMe — study.js
   공부 페이지 전용:
   퀴즈 탭, PDF 요약, 뽀모도로/일반 타이머, 학습 리포트
   ================================================ */

// ── 탭 전환 ──────────────────────────────────────
function switchStudyTab(tab, btn) {
  ['quiz', 'summary', 'timer', 'report'].forEach(t => {
    const el = document.getElementById('st-' + t);
    if (el) el.style.display = 'none';
  });
  const cur = document.getElementById('st-' + tab);
  if (cur) cur.style.display = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 타이머 모드 전환 (뽀모도로 ↔ 일반) ──────────
let currentTimerMode = 'pomo';

function switchTimerMode(mode) {
  currentTimerMode = mode;
  const isPomo = mode === 'pomo';

  document.getElementById('pomo-panel').style.display   = isPomo ? 'block' : 'none';
  document.getElementById('normal-panel').style.display = isPomo ? 'none'  : 'block';

  const pb = document.getElementById('timer-mode-pomo');
  const nb = document.getElementById('timer-mode-normal');
  pb.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:700;transition:all .2s;background:${isPomo ? 'var(--accent)' : 'transparent'};color:${isPomo ? 'white' : 'var(--text2)'};`;
  nb.style.cssText = `flex:1;padding:8px;border-radius:6px;font-size:13px;font-weight:${isPomo ? '600' : '700'};transition:all .2s;background:${isPomo ? 'transparent' : 'var(--accent)'};color:${isPomo ? 'var(--text2)' : 'white'};`;
}

// ── 뽀모도로 타이머 ───────────────────────────────
const POMO_WORK = 25 * 60;
const POMO_REST =  5 * 60;
let timerInterval = null;
let timerRunning  = false;
let timerSeconds  = POMO_WORK;
let totalSeconds  = POMO_WORK;
let isRestMode    = false;
let pomoSession   = 0;

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-display').textContent = m + ':' + s;
  document.getElementById('timer-bar').style.width = (timerSeconds / totalSeconds * 100) + '%';
}

function toggleTimer() {
  const btn = document.getElementById('timer-start-btn');
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    btn.textContent = '▶';
  } else {
    timerRunning = true;
    btn.textContent = '⏸';
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = '▶';
        nextPomoSession();
      }
    }, 1000);
  }
}

function nextPomoSession() {
  isRestMode    = !isRestMode;
  timerSeconds  = isRestMode ? POMO_REST : POMO_WORK;
  totalSeconds  = timerSeconds;
  const label   = document.getElementById('pomo-mode-label');
  if (label) {
    label.textContent = isRestMode ? '☕ 휴식 시간' : '🍅 집중 시간';
    label.className   = 'pomo-label ' + (isRestMode ? 'rest' : 'work');
  }
  if (!isRestMode) pomoSession++;
  updateTimerDisplay();
}

function skipPomo() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-start-btn').textContent = '▶';
  nextPomoSession();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  isRestMode   = false;
  timerSeconds = POMO_WORK;
  totalSeconds = POMO_WORK;
  document.getElementById('timer-start-btn').textContent = '▶';
  const label = document.getElementById('pomo-mode-label');
  if (label) { label.textContent = '🍅 집중 시간'; label.className = 'pomo-label work'; }
  updateTimerDisplay();
}

function applyPomoSettings() {
  const w = parseInt(document.getElementById('pomo-work-min').value) || 25;
  timerSeconds = w * 60;
  totalSeconds = w * 60;
  if (!timerRunning) updateTimerDisplay();
}

// ── 일반 타이머 ───────────────────────────────────
let normalInterval = null;
let normalRunning  = false;
let normalMode     = 'countdown';
let normalSeconds  = 30 * 60;
let normalTotal    = 30 * 60;
let laps           = [];

function switchNormalMode(m, btn) {
  normalMode = m;
  stopNormalTimer();
  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const isStop = m === 'stopwatch';
  document.getElementById('nt-countdown-set').style.display = isStop ? 'none' : 'flex';
  document.getElementById('nt-lap-btn').style.display       = isStop ? 'flex' : 'none';
  document.getElementById('nt-laps').style.display          = 'none';
  laps = [];
  normalSeconds = isStop ? 0 : 30 * 60;
  normalTotal   = isStop ? 0 : 30 * 60;
  updateNormalDisplay();
}

function setNormalTime(mins) {
  if (!mins || mins < 1) return;
  stopNormalTimer();
  normalSeconds = mins * 60;
  normalTotal   = mins * 60;
  updateNormalDisplay();
}

function updateNormalDisplay() {
  const m = Math.floor(normalSeconds / 60).toString().padStart(2, '0');
  const s = (normalSeconds % 60).toString().padStart(2, '0');
  document.getElementById('normal-timer-display').textContent = m + ':' + s;
  const pct = normalMode === 'stopwatch'
    ? Math.min(100, normalSeconds / 3600 * 100)
    : (normalTotal ? normalSeconds / normalTotal * 100 : 100);
  document.getElementById('normal-timer-bar').style.width = pct + '%';
}

function toggleNormalTimer() {
  const btn = document.getElementById('normal-start-btn');
  if (normalRunning) {
    stopNormalTimer();
    btn.textContent = '▶';
  } else {
    normalRunning = true;
    btn.textContent = '⏸';
    normalInterval = setInterval(() => {
      if (normalMode === 'countdown') {
        if (normalSeconds > 0) { normalSeconds--; updateNormalDisplay(); }
        else { stopNormalTimer(); btn.textContent = '▶'; }
      } else {
        normalSeconds++;
        updateNormalDisplay();
      }
    }, 1000);
  }
}

function stopNormalTimer() {
  clearInterval(normalInterval);
  normalRunning = false;
}

function resetNormalTimer() {
  stopNormalTimer();
  document.getElementById('normal-start-btn').textContent = '▶';
  if (normalMode === 'countdown') {
    normalSeconds = normalTotal;
  } else {
    normalSeconds = 0;
    laps = [];
    document.getElementById('nt-laps').innerHTML = '';
  }
  updateNormalDisplay();
}

function addLap() {
  const m = Math.floor(normalSeconds / 60).toString().padStart(2, '0');
  const s = (normalSeconds % 60).toString().padStart(2, '0');
  laps.push(`${m}:${s}`);
  const box = document.getElementById('nt-laps');
  box.style.display = 'block';
  box.innerHTML = laps.map((t, i) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:12px;border-bottom:1px solid var(--border);">
       <span style="color:var(--text2)">랩 ${i + 1}</span><strong>${t}</strong>
     </div>`
  ).reverse().join('');
}

// ── PDF 요약 파일 처리 ────────────────────────────
function handleSummaryFile(input) {
  if (!input.files || !input.files[0]) return;
  showSummaryFile(input.files[0].name);
}

function handleSummaryDrop(e) {
  e.preventDefault();
  document.getElementById('summary-upload-zone').style.borderColor = 'var(--border2)';
  document.getElementById('summary-upload-zone').style.background   = 'var(--bg3)';
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') showSummaryFile(f.name);
}

function showSummaryFile(name) {
  document.getElementById('summary-file-name').textContent       = name;
  document.getElementById('summary-file-info').style.display     = 'flex';
  document.getElementById('summary-upload-zone').style.display   = 'none';
}

function clearSummaryFile() {
  document.getElementById('summary-file-info').style.display   = 'none';
  document.getElementById('summary-upload-zone').style.display = 'block';
  document.getElementById('summary-file-input').value          = '';
}

function runSummary() {
  const btn = event.target;
  btn.textContent = '⏳ AI 요약 중...';
  btn.disabled    = true;
  // TODO: POST /api/study/quizsets (PDF 업로드 + AI 요약 API 호출)
  setTimeout(() => {
    btn.textContent = '✨ AI 요약 시작';
    btn.disabled    = false;
    document.getElementById('summary-result').style.display = 'block';
    document.getElementById('summary-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 1800);
}
