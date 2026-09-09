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

// ── AI PDF 퀴즈 ────────────────────────────────────────
const QUIZ_MAX_FILE_SIZE = 20 * 1024 * 1024;
let selectedQuizFile = null;
let originalQuiz = [];
let playableQuiz = [];
let currentQuizIndex = 0;
let currentQuizScore = 0;
let currentQuizFilename = '';
let quizAnswered = false;

function isPdfFile(file) {
  return file
    && file.type === 'application/pdf'
    && file.name.toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function setQuizStatus(message, type) {
  const status = document.getElementById('quiz-status');
  status.textContent = message;
  status.className = `quiz-status ${type || ''}`.trim();
  status.hidden = !message;
}

function selectQuizFile(file) {
  if (!isPdfFile(file)) {
    clearQuizFile();
    setQuizStatus('PDF 형식의 파일만 선택할 수 있습니다.', 'error');
    return;
  }
  if (file.size > QUIZ_MAX_FILE_SIZE) {
    clearQuizFile();
    setQuizStatus('PDF 파일 크기는 20MB 이하여야 합니다.', 'error');
    return;
  }

  selectedQuizFile = file;
  document.getElementById('quiz-file-name').textContent = file.name;
  document.getElementById('quiz-file-size').textContent = `${formatFileSize(file.size)} · AI 퀴즈 생성 준비됨`;
  document.getElementById('quiz-file-info').hidden = false;
  document.getElementById('quiz-upload-zone').hidden = true;
  setQuizStatus('', '');
}

function handleQuizFile(input) {
  if (input.files?.[0]) selectQuizFile(input.files[0]);
}

function handleQuizDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('dragging');
}

function handleQuizDragLeave(event) {
  event.currentTarget.classList.remove('dragging');
}

function handleQuizDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragging');
  const file = event.dataTransfer.files?.[0];
  if (file) selectQuizFile(file);
}

function clearQuizFile() {
  selectedQuizFile = null;
  const input = document.getElementById('quiz-file-input');
  if (input) input.value = '';
  document.getElementById('quiz-file-info').hidden = true;
  document.getElementById('quiz-upload-zone').hidden = false;
}

function shuffleOptions(question) {
  const pairs = question.options.map((text, originalIndex) => ({ text, originalIndex }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return {
    ...question,
    options: pairs.map((pair) => pair.text),
    answer_index: pairs.findIndex((pair) => pair.originalIndex === question.answer_index),
  };
}

async function responseJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(response.redirected
      ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
      : '서버 응답을 확인하지 못했습니다.');
  }
  return response.json();
}

async function generatePdfQuiz() {
  if (!selectedQuizFile) {
    setQuizStatus('먼저 퀴즈를 만들 PDF 파일을 선택해 주세요.', 'error');
    return;
  }

  const button = document.getElementById('quiz-generate-btn');
  const count = document.getElementById('quiz-count').value;
  const formData = new FormData();
  formData.append('pdf', selectedQuizFile, selectedQuizFile.name);
  formData.append('count', count);

  button.disabled = true;
  button.textContent = '⏳ PDF 분석 및 출제 중...';
  setQuizStatus('PDF 페이지별 텍스트를 추출하고 AI가 문제를 만들고 있습니다. 약 1~2분 걸릴 수 있습니다.', 'loading');

  try {
    const response = await fetch('/study/quiz/generate', {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
    });
    const data = await responseJson(response);
    if (!response.ok || !data.ok) {
      throw new Error(data.message || '퀴즈를 생성하지 못했습니다.');
    }

    originalQuiz = data.quiz;
    currentQuizFilename = selectedQuizFile.name;
    const usage = data.meta?.dailyUsage;
    const usageText = usage ? ` · 오늘 ${usage.used}/${usage.limit}회 사용` : '';
    const extraction = data.meta?.extraction;
    const truncatedText = extraction?.truncated
      ? ` · 자료가 길어 추출한 ${extraction.extractedChars.toLocaleString()}자 중 앞 ${extraction.usedChars.toLocaleString()}자 사용`
      : '';
    setQuizStatus(`${data.quiz.length}개 문항을 만들었습니다${usageText}${truncatedText}.`, 'success');
    startQuiz();
  } catch (error) {
    setQuizStatus(error.message || '퀴즈 생성 중 오류가 발생했습니다.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = '✨ 퀴즈 생성';
  }
}

function startQuiz() {
  playableQuiz = originalQuiz.map(shuffleOptions);
  currentQuizIndex = 0;
  currentQuizScore = 0;
  quizAnswered = false;
  document.getElementById('quiz-finish').hidden = true;
  document.getElementById('quiz-player').hidden = false;
  document.getElementById('quiz-document-name').textContent = currentQuizFilename;
  renderQuizQuestion();
  document.getElementById('quiz-player').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuizQuestion() {
  const question = playableQuiz[currentQuizIndex];
  quizAnswered = false;

  document.getElementById('quiz-progress-label').textContent = `${currentQuizIndex + 1} / ${playableQuiz.length} 문제`;
  document.getElementById('quiz-progress-bar').style.width = `${(currentQuizIndex / playableQuiz.length) * 100}%`;
  document.getElementById('quiz-score-badge').textContent = `${currentQuizScore}점`;
  document.getElementById('quiz-question').textContent = question.question;
  document.getElementById('quiz-feedback').hidden = true;
  document.getElementById('quiz-next-btn').hidden = true;

  const options = document.getElementById('quiz-options');
  options.replaceChildren();
  question.options.forEach((text, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.addEventListener('click', () => answerQuizQuestion(index));

    const letter = document.createElement('span');
    letter.className = 'quiz-option-letter';
    letter.textContent = String.fromCharCode(65 + index);
    const copy = document.createElement('span');
    copy.textContent = text;
    button.append(letter, copy);
    options.appendChild(button);
  });
}

function answerQuizQuestion(selectedIndex) {
  if (quizAnswered) return;
  quizAnswered = true;

  const question = playableQuiz[currentQuizIndex];
  const isCorrect = selectedIndex === question.answer_index;
  if (isCorrect) currentQuizScore += 1;

  const buttons = document.getElementById('quiz-options').querySelectorAll('.quiz-option');
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.answer_index) button.classList.add('correct');
    if (index === selectedIndex && !isCorrect) button.classList.add('wrong');
  });

  const feedback = document.getElementById('quiz-feedback');
  feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  feedback.hidden = false;
  document.getElementById('quiz-feedback-title').textContent = isCorrect
    ? '정답입니다'
    : `오답입니다 · 정답은 ${String.fromCharCode(65 + question.answer_index)}번`;
  document.getElementById('quiz-explanation').textContent = question.explanation;
  document.getElementById('quiz-source-page').textContent = `PDF ${question.source_page}페이지 근거`;
  document.getElementById('quiz-score-badge').textContent = `${currentQuizScore}점`;

  const nextButton = document.getElementById('quiz-next-btn');
  nextButton.textContent = currentQuizIndex === playableQuiz.length - 1 ? '결과 보기 →' : '다음 문제 →';
  nextButton.hidden = false;
}

function nextQuizQuestion() {
  if (!quizAnswered) return;
  if (currentQuizIndex < playableQuiz.length - 1) {
    currentQuizIndex += 1;
    renderQuizQuestion();
    document.getElementById('quiz-player').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  finishQuiz();
}

function finishQuiz() {
  const total = playableQuiz.length;
  const percent = Math.round((currentQuizScore / total) * 100);
  document.getElementById('quiz-progress-bar').style.width = '100%';
  document.getElementById('quiz-player').hidden = true;
  document.getElementById('quiz-final-score').textContent = `${currentQuizScore}/${total} · ${percent}점`;
  document.getElementById('quiz-final-message').textContent = percent >= 80
    ? '핵심 내용을 잘 이해하고 있습니다.'
    : percent >= 60
      ? '틀린 문제의 해설을 중심으로 한 번 더 복습해 보세요.'
      : 'PDF의 핵심 개념을 복습한 뒤 다시 도전해 보세요.';
  document.getElementById('quiz-finish').hidden = false;
  document.getElementById('quiz-finish').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function retryCurrentQuiz() {
  if (originalQuiz.length) startQuiz();
}

function resetQuizGenerator() {
  originalQuiz = [];
  playableQuiz = [];
  currentQuizFilename = '';
  clearQuizFile();
  setQuizStatus('', '');
  document.getElementById('quiz-player').hidden = true;
  document.getElementById('quiz-finish').hidden = true;
  document.getElementById('quiz-generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
