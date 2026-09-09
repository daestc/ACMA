import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { POMO_WORK, POMO_REST, formatClock } from '../components/Study/studyUtils'

const StudyTimerContext = createContext(null)

export function StudyTimerProvider({ children }) {
  const [studyTab, setStudyTab] = useState('quiz')
  const [timerMode, setTimerMode] = useState('pomo')

  const [pomoSeconds, setPomoSeconds] = useState(POMO_WORK)
  const [pomoTotal, setPomoTotal] = useState(POMO_WORK)
  const [pomoRunning, setPomoRunning] = useState(false)
  const [isRestMode, setIsRestMode] = useState(false)
  const [pomoSession, setPomoSession] = useState(0)
  const [workMin, setWorkMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [longMin, setLongMin] = useState(15)
  const pomoDeadlineRef = useRef(null)
  const pomoSecondsRef = useRef(pomoSeconds)
  const isRestModeRef = useRef(isRestMode)
  pomoSecondsRef.current = pomoSeconds
  isRestModeRef.current = isRestMode

  const [normalMode, setNormalMode] = useState('countdown')
  const [normalSeconds, setNormalSeconds] = useState(30 * 60)
  const [normalTotal, setNormalTotal] = useState(30 * 60)
  const [normalRunning, setNormalRunning] = useState(false)
  const [laps, setLaps] = useState([])
  const [customMin, setCustomMin] = useState('')
  const normalDeadlineRef = useRef(null)
  const normalStartedRef = useRef(null)
  const normalSecondsRef = useRef(normalSeconds)
  const normalModeRef = useRef(normalMode)
  normalSecondsRef.current = normalSeconds
  normalModeRef.current = normalMode

  const pauseNormal = useCallback(() => {
    if (normalDeadlineRef.current != null) {
      setNormalSeconds(Math.max(0, Math.round((normalDeadlineRef.current - Date.now()) / 1000)))
    } else if (normalStartedRef.current != null) {
      setNormalSeconds(Math.max(0, Math.round((Date.now() - normalStartedRef.current) / 1000)))
    }
    normalDeadlineRef.current = null
    normalStartedRef.current = null
    setNormalRunning(false)
  }, [])

  const pausePomo = useCallback(() => {
    if (pomoDeadlineRef.current != null) {
      setPomoSeconds(Math.max(0, Math.round((pomoDeadlineRef.current - Date.now()) / 1000)))
    }
    pomoDeadlineRef.current = null
    setPomoRunning(false)
  }, [])

  const advancePomoSession = useCallback(() => {
    const nextRest = !isRestModeRef.current
    const duration = nextRest ? POMO_REST : POMO_WORK
    setIsRestMode(nextRest)
    setPomoSeconds(duration)
    setPomoTotal(duration)
    if (!nextRest) setPomoSession((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!pomoRunning && !normalRunning) return

    const tick = () => {
      const now = Date.now()
      if (pomoDeadlineRef.current != null) {
        const remaining = Math.max(0, Math.round((pomoDeadlineRef.current - now) / 1000))
        if (remaining === 0) {
          pomoDeadlineRef.current = null
          setPomoRunning(false)
          advancePomoSession()
        } else {
          setPomoSeconds((prev) => (prev === remaining ? prev : remaining))
        }
      }
      if (normalDeadlineRef.current != null) {
        const remaining = Math.max(0, Math.round((normalDeadlineRef.current - now) / 1000))
        if (remaining === 0) {
          normalDeadlineRef.current = null
          setNormalRunning(false)
          setNormalSeconds(0)
        } else {
          setNormalSeconds((prev) => (prev === remaining ? prev : remaining))
        }
      } else if (normalStartedRef.current != null) {
        const elapsed = Math.max(0, Math.round((now - normalStartedRef.current) / 1000))
        setNormalSeconds((prev) => (prev === elapsed ? prev : elapsed))
      }
    }

    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [pomoRunning, normalRunning, advancePomoSession])

  const togglePomoRunning = useCallback(() => {
    if (pomoRunning) {
      pausePomo()
      return
    }
    pauseNormal()
    pomoDeadlineRef.current = Date.now() + pomoSecondsRef.current * 1000
    setPomoRunning(true)
  }, [pomoRunning, pausePomo, pauseNormal])

  const skipPomo = useCallback(() => {
    pausePomo()
    advancePomoSession()
  }, [pausePomo, advancePomoSession])

  const resetPomoTimer = useCallback(() => {
    pausePomo()
    setIsRestMode(false)
    setPomoSeconds(POMO_WORK)
    setPomoTotal(POMO_WORK)
  }, [pausePomo])

  const handleWorkMinChange = useCallback((value) => {
    setWorkMin(value)
    const w = parseInt(value, 10) || 25
    const secs = w * 60
    setPomoSeconds(secs)
    setPomoTotal(secs)
    if (pomoDeadlineRef.current != null) {
      pomoDeadlineRef.current = Date.now() + secs * 1000
    }
  }, [])

  const toggleNormalRunning = useCallback(() => {
    if (normalRunning) {
      pauseNormal()
      return
    }
    pausePomo()
    if (normalModeRef.current === 'countdown') {
      normalDeadlineRef.current = Date.now() + normalSecondsRef.current * 1000
      normalStartedRef.current = null
    } else {
      normalStartedRef.current = Date.now() - normalSecondsRef.current * 1000
      normalDeadlineRef.current = null
    }
    setNormalRunning(true)
  }, [normalRunning, pauseNormal, pausePomo])

  const switchNormalMode = useCallback((m) => {
    pauseNormal()
    setNormalMode(m)
    setLaps([])
    const secs = m === 'stopwatch' ? 0 : 30 * 60
    setNormalSeconds(secs)
    setNormalTotal(secs)
  }, [pauseNormal])

  const setNormalTimeMins = useCallback((mins) => {
    if (!mins || mins < 1) return
    pauseNormal()
    const secs = mins * 60
    setNormalSeconds(secs)
    setNormalTotal(secs)
  }, [pauseNormal])

  const resetNormalTimer = useCallback(() => {
    const mode = normalModeRef.current
    pauseNormal()
    if (mode === 'countdown') {
      setNormalSeconds(normalTotal)
    } else {
      setNormalSeconds(0)
      setLaps([])
    }
  }, [pauseNormal, normalTotal])

  const addLap = useCallback(() => {
    const now = normalStartedRef.current != null
      ? Math.max(0, Math.round((Date.now() - normalStartedRef.current) / 1000))
      : normalSecondsRef.current
    setLaps((prev) => [...prev, formatClock(now)])
  }, [])

  const liveClock = useMemo(() => {
    if (pomoRunning) {
      return { label: isRestMode ? '☕' : '🍅', seconds: pomoSeconds }
    }
    if (normalRunning) {
      return { label: normalMode === 'stopwatch' ? '⏱' : '⏳', seconds: normalSeconds }
    }
    return null
  }, [pomoRunning, isRestMode, pomoSeconds, normalRunning, normalMode, normalSeconds])

  const value = useMemo(() => ({
    studyTab,
    setStudyTab,
    timerMode,
    setTimerMode,
    pomoSeconds,
    pomoTotal,
    pomoRunning,
    isRestMode,
    pomoSession,
    workMin,
    breakMin,
    longMin,
    setBreakMin,
    setLongMin,
    togglePomoRunning,
    skipPomo,
    resetPomoTimer,
    handleWorkMinChange,
    normalMode,
    normalSeconds,
    normalTotal,
    normalRunning,
    laps,
    customMin,
    setCustomMin,
    toggleNormalRunning,
    switchNormalMode,
    setNormalTimeMins,
    resetNormalTimer,
    addLap,
    liveClock,
  }), [
    studyTab, timerMode,
    pomoSeconds, pomoTotal, pomoRunning, isRestMode, pomoSession,
    workMin, breakMin, longMin,
    togglePomoRunning, skipPomo, resetPomoTimer, handleWorkMinChange,
    normalMode, normalSeconds, normalTotal, normalRunning, laps, customMin,
    toggleNormalRunning, switchNormalMode, setNormalTimeMins, resetNormalTimer, addLap,
    liveClock,
  ])

  return (
    <StudyTimerContext.Provider value={value}>
      {children}
    </StudyTimerContext.Provider>
  )
}

export function useStudyTimer() {
  const ctx = useContext(StudyTimerContext)
  if (!ctx) throw new Error('useStudyTimer는 StudyTimerProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
