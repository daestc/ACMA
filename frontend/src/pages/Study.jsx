import { useEffect, useRef, useState } from 'react'
import { useStudyTimer } from '../context/StudyTimerContext'
import {
  QUIZ_MAX_FILE_SIZE,
  isPdfFile,
  formatFileSize,
  shuffleOptions,
  formatClock,
} from '../components/Study/studyUtils'

function Study() {
  const { studyTab, setStudyTab } = useStudyTimer()

  // AppShell이 이미 <div className="page-content">로 children을 감싸주므로 Fragment로 시작한다.
  return (
    <>
      <div className="tabs">
        <button type="button" className={`tab-btn ${studyTab === 'quiz' ? 'active' : ''}`} onClick={() => setStudyTab('quiz')}>퀴즈</button>
        <button type="button" className={`tab-btn ${studyTab === 'timer' ? 'active' : ''}`} onClick={() => setStudyTab('timer')}>타이머</button>
      </div>

      {studyTab === 'quiz' && <QuizTab />}
      {studyTab === 'timer' && <TimerTab />}
    </>
  )
}

function QuizTab() {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [quizCount, setQuizCount] = useState('5')
  const [status, setStatus] = useState({ message: '', type: '' })
  const [generating, setGenerating] = useState(false)

  const [originalQuiz, setOriginalQuiz] = useState([])
  const [playableQuiz, setPlayableQuiz] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [filename, setFilename] = useState('')
  const [answered, setAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [phase, setPhase] = useState('generator') // generator | player | finish

  const fileInputRef = useRef(null)
  const generatorRef = useRef(null)
  const playerRef = useRef(null)
  const finishRef = useRef(null)

  useEffect(() => {
    if (phase === 'player') playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (phase === 'finish') finishRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [phase, currentIndex])

  function selectFile(file) {
    if (!isPdfFile(file)) {
      setSelectedFile(null)
      setStatus({ message: 'PDF 형식의 파일만 선택할 수 있습니다.', type: 'error' })
      return
    }
    if (file.size > QUIZ_MAX_FILE_SIZE) {
      setSelectedFile(null)
      setStatus({ message: 'PDF 파일 크기는 20MB 이하여야 합니다.', type: 'error' })
      return
    }
    setSelectedFile(file)
    setStatus({ message: '', type: '' })
  }

  function clearFile() {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startQuiz(quiz, name) {
    setPlayableQuiz(quiz.map(shuffleOptions))
    setCurrentIndex(0)
    setScore(0)
    setAnswered(false)
    setSelectedAnswer(null)
    setFilename(name)
    setPhase('player')
  }

  async function generateQuiz() {
    if (!selectedFile) {
      setStatus({ message: '먼저 퀴즈를 만들 PDF 파일을 선택해 주세요.', type: 'error' })
      return
    }

    setGenerating(true)
    setStatus({ message: 'PDF 페이지별 텍스트를 추출하고 AI가 문제를 만들고 있습니다. 약 1~2분 걸릴 수 있습니다.', type: 'loading' })

    try {
      const formData = new FormData()
      formData.append('pdf', selectedFile, selectedFile.name)
      formData.append('count', quizCount)

      const res = await fetch('/study/quiz/generate', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error(res.redirected ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : '서버 응답을 확인하지 못했습니다.')
      }
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || '퀴즈를 생성하지 못했습니다.')

      setOriginalQuiz(data.quiz)
      const usage = data.meta?.dailyUsage
      const usageText = usage ? ` · 오늘 ${usage.used}/${usage.limit}회 사용` : ''
      const extraction = data.meta?.extraction
      const truncatedText = extraction?.truncated
        ? ` · 자료가 길어 추출한 ${extraction.extractedChars.toLocaleString()}자 중 앞 ${extraction.usedChars.toLocaleString()}자 사용`
        : ''
      setStatus({ message: `${data.quiz.length}개 문항을 만들었습니다${usageText}${truncatedText}.`, type: 'success' })
      startQuiz(data.quiz, selectedFile.name)
    } catch (err) {
      setStatus({ message: err.message || '퀴즈 생성 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  function selectAnswer(index) {
    if (answered) return
    const question = playableQuiz[currentIndex]
    if (index === question.answer_index) setScore((s) => s + 1)
    setAnswered(true)
    setSelectedAnswer(index)
  }

  function nextQuestion() {
    if (!answered) return
    if (currentIndex < playableQuiz.length - 1) {
      setCurrentIndex((i) => i + 1)
      setAnswered(false)
      setSelectedAnswer(null)
    } else {
      setPhase('finish')
    }
  }

  function retryQuiz() {
    if (originalQuiz.length) startQuiz(originalQuiz, filename)
  }

  function resetGenerator() {
    setOriginalQuiz([])
    setPlayableQuiz([])
    setFilename('')
    clearFile()
    setStatus({ message: '', type: '' })
    setPhase('generator')
    generatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const question = playableQuiz[currentIndex]
  const total = playableQuiz.length
  const percent = total ? Math.round((score / total) * 100) : 0

  return (
    <>
      <div className="card quiz-generator-card" ref={generatorRef}>
        <div className="card-header">
          <div>
            <div className="card-title">📄 AI PDF 퀴즈 생성기</div>
            <div className="quiz-generator-description">PDF 텍스트를 추출하고 AI가 해석해 4지선다 문제를 만듭니다.</div>
          </div>
          <span className="badge badge-purple">Claude AI</span>
        </div>

        {!selectedFile ? (
          <div
            className={`quiz-upload-zone ${dragging ? 'dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) selectFile(f) }}
          >
            <div className="quiz-upload-icon">📁</div>
            <div className="quiz-upload-title">PDF 파일을 끌어 놓거나 클릭해 선택하세요</div>
            <div className="quiz-upload-help">최대 20MB · 텍스트형 PDF · 스캔본은 OCR 필요 · 파일을 보관하지 않음</div>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]) }} />
          </div>
        ) : (
          <div className="quiz-file-info">
            <span className="quiz-file-icon">📄</span>
            <div className="quiz-file-copy">
              <div className="quiz-file-name">{selectedFile.name}</div>
              <div className="quiz-file-size">{formatFileSize(selectedFile.size)} · AI 퀴즈 생성 준비됨</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFile}>제거</button>
          </div>
        )}

        <div className="quiz-generator-controls">
          <label htmlFor="quiz-count" className="quiz-count-label">문항 수</label>
          <select id="quiz-count" className="input-field quiz-count-select" value={quizCount} onChange={(e) => setQuizCount(e.target.value)}>
            <option value="3">3문항</option>
            <option value="5">5문항</option>
            <option value="7">7문항</option>
            <option value="10">10문항</option>
          </select>
          <button type="button" className="btn btn-accent quiz-generate-btn" disabled={generating} onClick={generateQuiz}>
            {generating ? '⏳ PDF 분석 및 출제 중...' : '✨ 퀴즈 생성'}
          </button>
        </div>

        {status.message && (
          <div className={`quiz-status ${status.type}`} role="status" aria-live="polite">{status.message}</div>
        )}
      </div>

      {phase === 'player' && question && (
        <section className="card quiz-player" aria-live="polite" ref={playerRef}>
          <div className="quiz-player-header">
            <div>
              <div className="quiz-document-name">{filename}</div>
              <div className="quiz-progress-label">{currentIndex + 1} / {total} 문제</div>
            </div>
            <span className="badge badge-blue">{score}점</span>
          </div>
          <div className="quiz-progress-track">
            <div className="quiz-progress-bar" style={{ width: `${(currentIndex / total) * 100}%` }} />
          </div>
          <h2 className="quiz-question">{question.question}</h2>
          <div className="quiz-options">
            {question.options.map((text, index) => {
              let cls = 'quiz-option'
              if (answered) {
                if (index === question.answer_index) cls += ' correct'
                else if (index === selectedAnswer) cls += ' wrong'
              }
              return (
                <button key={index} type="button" className={cls} disabled={answered} onClick={() => selectAnswer(index)}>
                  <span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span>
                  <span>{text}</span>
                </button>
              )
            })}
          </div>

          {answered && (
            <div className={`quiz-feedback ${selectedAnswer === question.answer_index ? 'correct' : 'wrong'}`}>
              <div className="quiz-feedback-title">
                {selectedAnswer === question.answer_index ? '정답입니다' : `오답입니다 · 정답은 ${String.fromCharCode(65 + question.answer_index)}번`}
              </div>
              <p className="quiz-explanation">{question.explanation}</p>
              <span className="quiz-source-page">PDF {question.source_page}페이지 근거</span>
            </div>
          )}

          <div className="quiz-player-actions">
            {answered && (
              <button type="button" className="btn btn-accent" onClick={nextQuestion}>
                {currentIndex === total - 1 ? '결과 보기 →' : '다음 문제 →'}
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'finish' && (
        <section className="card quiz-finish" ref={finishRef}>
          <div className="quiz-finish-icon">🎉</div>
          <div className="quiz-finish-title">퀴즈를 완료했습니다</div>
          <div className="quiz-final-score">{score}/{total} · {percent}점</div>
          <div className="quiz-final-message">
            {percent >= 80 ? '핵심 내용을 잘 이해하고 있습니다.' : percent >= 60 ? '틀린 문제의 해설을 중심으로 한 번 더 복습해 보세요.' : 'PDF의 핵심 개념을 복습한 뒤 다시 도전해 보세요.'}
          </div>
          <div className="quiz-finish-actions">
            <button type="button" className="btn btn-ghost" onClick={retryQuiz}>다시 풀기</button>
            <button type="button" className="btn btn-accent" onClick={resetGenerator}>새 PDF로 만들기</button>
          </div>
        </section>
      )}
    </>
  )
}

function TimerTab() {
  const {
    timerMode, setTimerMode,
    pomoSeconds, pomoTotal, pomoRunning, isRestMode, pomoSession,
    workMin, breakMin, longMin, setBreakMin, setLongMin,
    togglePomoRunning, skipPomo, resetPomoTimer, handleWorkMinChange,
    normalMode, normalSeconds, normalTotal, normalRunning, laps, customMin, setCustomMin,
    toggleNormalRunning, switchNormalMode, setNormalTimeMins, resetNormalTimer, addLap,
  } = useStudyTimer()

  const normalPct = normalMode === 'stopwatch'
    ? Math.min(100, (normalSeconds / 3600) * 100)
    : (normalTotal ? (normalSeconds / normalTotal) * 100 : 100)

  const dotIndex = pomoSession % 4

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
        <button
          type="button"
          onClick={() => setTimerMode('pomo')}
          style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 13, fontWeight: timerMode === 'pomo' ? 700 : 600, transition: 'all .2s', background: timerMode === 'pomo' ? 'var(--accent)' : 'transparent', color: timerMode === 'pomo' ? 'white' : 'var(--text2)' }}
        >
          🍅 뽀모도로
        </button>
        <button
          type="button"
          onClick={() => setTimerMode('normal')}
          style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 13, fontWeight: timerMode === 'normal' ? 700 : 600, transition: 'all .2s', background: timerMode === 'normal' ? 'var(--accent)' : 'transparent', color: timerMode === 'normal' ? 'white' : 'var(--text2)' }}
        >
          ⏱ 일반 타이머
        </button>
      </div>

      {timerMode === 'pomo' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 14 }}>
            <div className="pomo-status">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`pomo-dot ${i < dotIndex ? 'done' : i === dotIndex ? 'active' : ''}`} />
              ))}
              <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 4 }}>{dotIndex + 1} / 4 세션</span>
            </div>
            <span className={`pomo-label ${isRestMode ? 'rest' : 'work'}`}>{isRestMode ? '☕ 휴식 시간' : '🍅 집중 시간'}</span>
          </div>
          <input className="input-field" placeholder="과목명 (선택)" style={{ width: '100%', marginBottom: 18, textAlign: 'center' }} />
          <div className="timer-display">{formatClock(pomoSeconds)}</div>
          <div style={{ width: '100%', height: 5, background: 'var(--bg3)', borderRadius: 3, margin: '14px 0', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--accent),#7b96ff)', borderRadius: 3, width: `${(pomoSeconds / pomoTotal) * 100}%`, transition: 'width .1s linear' }} />
          </div>
          <div className="timer-controls">
            <button type="button" className="timer-btn timer-btn-secondary" onClick={resetPomoTimer}>↺</button>
            <button type="button" className="timer-btn timer-btn-main" onClick={togglePomoRunning}>{pomoRunning ? '⏸' : '▶'}</button>
            <button type="button" className="timer-btn timer-btn-secondary" onClick={skipPomo}>⏭</button>
          </div>

          <div style={{ marginTop: 16, padding: 14, background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>⚙ 뽀모도로 설정</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>🍅 집중 (분)</label>
                <input className="input-field" type="number" min="1" max="60" style={{ width: '100%', textAlign: 'center' }} value={workMin} onChange={(e) => handleWorkMinChange(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>☕ 휴식 (분)</label>
                <input className="input-field" type="number" min="1" max="30" style={{ width: '100%', textAlign: 'center' }} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>🌿 긴휴식 (분)</label>
                <input className="input-field" type="number" min="1" max="60" style={{ width: '100%', textAlign: 'center' }} value={longMin} onChange={(e) => setLongMin(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {timerMode === 'normal' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 6 }}>
            <div className="tabs" style={{ margin: '0 auto 16px', display: 'inline-flex' }}>
              <button type="button" className={`tab-btn ${normalMode === 'countdown' ? 'active' : ''}`} onClick={() => switchNormalMode('countdown')}>카운트다운</button>
              <button type="button" className={`tab-btn ${normalMode === 'stopwatch' ? 'active' : ''}`} onClick={() => switchNormalMode('stopwatch')}>스톱워치</button>
            </div>
          </div>
          <input className="input-field" placeholder="과목명 (선택)" style={{ width: '100%', marginBottom: 18, textAlign: 'center' }} />

          {normalMode === 'countdown' && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              {[10, 30, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setNormalTimeMins(mins)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                    background: normalTotal === mins * 60 ? 'var(--accent-bg)' : 'var(--bg3)',
                    border: `1.5px solid ${normalTotal === mins * 60 ? 'var(--accent)' : 'var(--border)'}`,
                    color: normalTotal === mins * 60 ? 'var(--accent)' : 'var(--text2)',
                  }}
                >
                  {mins}분
                </button>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input className="input-field" type="number" placeholder="직접" min="1" max="999" style={{ width: 62, textAlign: 'center', fontSize: 12 }} value={customMin} onChange={(e) => setCustomMin(e.target.value)} />
                <button type="button" onClick={() => setNormalTimeMins(parseInt(customMin, 10) || 0)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--bg3)', border: '1.5px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>설정</button>
              </div>
            </div>
          )}

          <div className="timer-display">{formatClock(normalSeconds)}</div>
          <div style={{ width: '100%', height: 5, background: 'var(--bg3)', borderRadius: 3, margin: '14px 0', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--green),#34d399)', borderRadius: 3, width: `${normalPct}%`, transition: 'width .1s linear' }} />
          </div>
          <div className="timer-controls">
            <button type="button" className="timer-btn timer-btn-secondary" onClick={resetNormalTimer}>↺</button>
            <button type="button" className="timer-btn timer-btn-main" onClick={toggleNormalRunning}>{normalRunning ? '⏸' : '▶'}</button>
            {normalMode === 'stopwatch' && (
              <button type="button" className="timer-btn timer-btn-secondary" onClick={addLap}>📌</button>
            )}
          </div>

          {normalMode === 'stopwatch' && laps.length > 0 && (
            <div style={{ marginTop: 14, textAlign: 'left', maxHeight: 120, overflowY: 'auto' }}>
              {[...laps].reverse().map((t, i) => (
                <div key={laps.length - i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text2)' }}>랩 {laps.length - i}</span><strong>{t}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Study
