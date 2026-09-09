import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiGet, apiPost } from '../api'
import { useAuth } from '../context/AuthContext'

const WEATHER_CACHE_KEY = 'acme_weather_v1'
const WEATHER_CACHE_TTL = 30 * 60 * 1000 // 30분

function getPosition(options) {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options))
}

async function getCurrentCoords() {
  if (!navigator.geolocation) return null
  try {
    const pos = await getPosition({ timeout: 5000, maximumAge: 1000 * 60 * 30 })
    return { lat: pos.coords.latitude, lon: pos.coords.longitude }
  } catch {
    return null
  }
}

async function getCityName(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const parts = [data.principalSubdivision, data.locality].filter(Boolean)
    return [...new Set(parts)].join(' ') || null
  } catch {
    return null
  }
}

function formatDateYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function DdaySlider({ colorClass, label, items, emptyText, renderItem }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % items.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [items])

  return (
    <div className={`dday-card ${colorClass} auto-slider`}>
      <div className="dday-label">{label}</div>
      <div className="slider-container">
        {items.length === 0 ? (
          <div className="slider-item active">
            <div className="dday-title">{emptyText}</div>
            <div className="dday-count">-</div>
          </div>
        ) : (
          items.map((item, i) => (
            <div className={`slider-item ${i === index ? 'active' : ''}`} key={item._id || i}>
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function isTodayInSemester(date, semester) {
  if (!semester) return true
  const match = String(semester).match(/^(\d{4})-([12])$/)
  if (!match) return true
  const year = Number(match[1])
  const term = Number(match[2])
  const start = term === 1 ? new Date(year, 2, 1) : new Date(year, 8, 1)
  const end = term === 1 ? new Date(year, 5, 30, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59)
  return date >= start && date <= end
}

function Home() {
  const { user: sessionUser } = useAuth()
  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading') // loading | ready | error

  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [locationLabel, setLocationLabel] = useState('📍 위치 확인 중...')

  const [activeTab, setActiveTab] = useState('lecture')
  const [lectures, setLectures] = useState(null) // null=로딩중
  const [aiPlan, setAiPlan] = useState(null) // null=로딩중, 'unavailable'=사용 불가
  const [checkedTodos, setCheckedTodos] = useState(() => new Set())

  const [habitList, setHabitList] = useState([])
  const pendingChanges = useRef({})

  useEffect(() => {
    let cancelled = false
    apiGet('/api/home')
      .then(res => {
        if (cancelled) return
        setData(res)
        setHabitList(res.habitList || [])
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let list
        try {
          const raw = localStorage.getItem(WEATHER_CACHE_KEY)
          if (raw) {
            const cached = JSON.parse(raw)
            if (Date.now() - cached.ts < WEATHER_CACHE_TTL) list = cached.data
          }
        } catch { /* localStorage 접근 실패는 무시하고 새로 요청 */ }

        const coords = await getCurrentCoords()

        if (!list) {
          const query = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''
          const res = await fetch(`/calendar/weather${query}`)
          if (!res.ok) throw new Error('날씨 API 요청 실패')
          list = await res.json()
          try {
            localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() }))
          } catch { /* 저장 실패는 무시 */ }
        }

        if (cancelled) return

        const todayStr = formatDateYMD(new Date())
        const tomorrowStr = formatDateYMD(new Date(Date.now() + 24 * 60 * 60 * 1000))
        const today = list.find(w => w.date === todayStr) || list[0]
        const tomorrow = list.find(w => w.date === tomorrowStr)
        if (!today) throw new Error('오늘 날씨 데이터 없음')
        setWeather({ today, tomorrow })

        if (coords) {
          setLocationLabel('📍 현재 위치')
          const city = await getCityName(coords.lat, coords.lon)
          if (!cancelled && city) setLocationLabel(`📍 ${city}`)
        } else {
          setLocationLabel('📍 서울특별시 (기본)')
        }
      } catch {
        if (!cancelled) setWeatherError('날씨 정보를 불러올 수 없습니다')
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/calendar/timetables')
      .then(res => {
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then(timetables => {
        if (cancelled) return
        const today = new Date()
        const dow = today.getDay()
        const todays = []
        timetables.forEach(item => {
          if (!isTodayInSemester(today, item.semester)) return
          ;(item.schedule || []).forEach(sch => {
            if (Number(sch.dayOfWeek) !== dow) return
            todays.push({
              title: item.title,
              location: item.location,
              professorName: item.professorName,
              startTime: sch.startTime,
              endTime: sch.endTime,
              color: item.color || '#60A5FA',
            })
          })
        })
        todays.sort((a, b) => a.startTime.localeCompare(b.startTime))
        setLectures(todays)
      })
      .catch(() => { if (!cancelled) setLectures('error') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/ai/weekly-plan/today')
      .then(res => res.json())
      .then(res => {
        if (cancelled) return
        if (!res.success || !res.items || res.items.length === 0) {
          setAiPlan([])
        } else {
          setAiPlan(res.items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        }
      })
      .catch(() => { if (!cancelled) setAiPlan('unavailable') })
    return () => { cancelled = true }
  }, [])

  const toggleAiPlanItem = useCallback(async (itemId) => {
    try {
      const res = await apiPost(`/ai/weekly-plan/checklist/${itemId}/toggle`)
      if (!res?.success) return
      setAiPlan(prev => (Array.isArray(prev) ? prev.map(it => (it._id === itemId ? { ...it, isCompleted: res.isCompleted } : it)) : prev))
    } catch {
      // 네트워크 실패 시 조용히 무시 (원본 동작과 동일)
    }
  }, [])

  const toggleTodoCheck = useCallback((id) => {
    setCheckedTodos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const flushHabitChanges = useCallback(() => {
    if (Object.keys(pendingChanges.current).length === 0) return
    const blob = new Blob([JSON.stringify({ changes: pendingChanges.current })], { type: 'application/json' })
    navigator.sendBeacon('/user/saveIsCompleted', blob)
    pendingChanges.current = {}
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushHabitChanges()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', flushHabitChanges)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', flushHabitChanges)
      flushHabitChanges() 
    }
  }, [flushHabitChanges])

  const toggleHabit = useCallback((habitId) => {
    setHabitList(prev => prev.map(h => {
      if (h._id !== habitId) return h
      const next = { ...h, isCompleted: !h.isCompleted }
      pendingChanges.current[habitId] = next.isCompleted
      return next
    }))
  }, [])

  const completedCount = useMemo(() => habitList.filter(h => h.isCompleted).length, [habitList])

  if (loadState === 'loading') {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>불러오는 중...</div>
  }
  if (loadState === 'error' || !data) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>홈 화면을 불러오지 못했습니다.</div>
  }

  const role = sessionUser?.role
  if (role === 'staff') {
    return <Navigate to="/staff/home" replace />
  }
  if (role === 'admin') {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p>관리자 계정은 아직 React 홈 대시보드가 준비되지 않았습니다.</p>
        <a href="/admin/staff">기존 화면으로 이동 →</a>
      </div>
    )
  }

  const { todoList, topNotices, ddayCerts, examSchedules, generalSchedules } = data

  return (
    <>
      {/* 날씨 + 프로필 */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="weather-widget">
          <div className="weather-left">
            <div className="temp" id="weather-temp">{weather ? `${weather.today.temp ?? '--'}°C` : '--°C'}</div>
            <div className="desc" id="weather-desc">
              {weatherError || (weather ? weather.today.description : '날씨 불러오는 중...')}
            </div>
            <div className="location" id="weather-location">{locationLabel}</div>
            <div className="weather-detail" id="weather-base" style={{ marginTop: 8 }}>
              {weather?.today?.time ? `${weather.today.time.slice(0, 2)}시 예보 기준` : ''}
            </div>
          </div>
          <div className="weather-right">
            <div className="weather-icon" id="weather-icon">{weather ? weather.today.icon : '🌤️'}</div>
            <div className="weather-detail" id="weather-tomorrow" style={{ textAlign: 'center' }}>
              {weather?.tomorrow ? `내일 ${weather.tomorrow.icon} ${weather.tomorrow.temp ?? '--'}°` : ''}
            </div>
          </div>
        </div>

        <a className="portfolio-banner" href="/mystatus" style={{ textDecoration: 'none' }}>
          <div className="portfolio-name" id="profile-name">{sessionUser?.name}</div>
          <div className="portfolio-meta" id="profile-meta">
            {[sessionUser?.university, sessionUser?.major, sessionUser?.grade ? `${sessionUser.grade}학년` : null].filter(Boolean).join(' · ')}
          </div>
        </a>
      </div>

      {/* D-Day 슬라이더 3종 */}
      <div className="dday-row">
        <DdaySlider
          colorClass="blue"
          label="자격증 시험"
          items={ddayCerts || []}
          emptyText="등록된 목표 자격증이 없습니다."
          renderItem={cert => (
            <>
              <div className="dday-title">{cert.title}</div>
              <div className="dday-count">{cert.dDayText}</div>
            </>
          )}
        />
        <DdaySlider
          colorClass="red"
          label="시험 일정"
          items={examSchedules || []}
          emptyText="예정된 시험 일정이 없습니다."
          renderItem={exam => (
            <>
              <div className="dday-title">{exam.title}</div>
              <div className="dday-count">{exam.dDayLabel}</div>
            </>
          )}
        />
        <DdaySlider
          colorClass="green"
          label="학사 일정"
          items={generalSchedules || []}
          emptyText="예정된 학사 일정이 없습니다."
          renderItem={sch => (
            <>
              <div className="dday-title">{sch.title}</div>
              <div className="dday-count">{sch.dDayLabel}</div>
            </>
          )}
        />
      </div>

      {/* 오늘의 강의 & 할 일 / 최근 공지사항 */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 오늘의 강의 & 할 일</span>
          </div>
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab-btn ${activeTab === 'lecture' ? 'active' : ''}`} onClick={() => setActiveTab('lecture')}>강의 일정</button>
            <button className={`tab-btn ${activeTab === 'todo' ? 'active' : ''}`} onClick={() => setActiveTab('todo')}>할 일</button>
            <button className={`tab-btn ${activeTab === 'aiplan' ? 'active' : ''}`} onClick={() => setActiveTab('aiplan')}>AI 계획</button>
          </div>

          <div style={{ display: activeTab === 'lecture' ? 'block' : 'none' }}>
            {lectures === null && <div className="check-item"><span className="check-text">오늘의 강의 불러오는 중...</span></div>}
            {lectures === 'error' && <div className="check-item"><span className="check-text">오늘의 강의를 불러오지 못했습니다.</span></div>}
            {Array.isArray(lectures) && lectures.length === 0 && (
              <div className="check-item"><span className="check-text">오늘 등록된 강의가 없습니다.</span></div>
            )}
            {Array.isArray(lectures) && lectures.map((lec, i) => (
              <div className="check-item home-lecture-item" key={i}>
                <span className="selected-event-dot" style={{ background: lec.color }} />
                <span className="check-text">
                  {lec.title}
                  <small style={{ display: 'block', color: 'var(--text2)', marginTop: 2 }}>
                    {lec.location || '장소 미정'}{lec.professorName ? ` · ${lec.professorName}` : ''}
                  </small>
                </span>
                <span className="check-time">{lec.startTime} ~ {lec.endTime}</span>
              </div>
            ))}
          </div>

          <div style={{ display: activeTab === 'todo' ? 'block' : 'none' }}>
            {(!todoList || todoList.length === 0) ? (
              <div className="check-item todo-exam"><span className="check-text">오늘의 할 일을 추가하세요</span></div>
            ) : (
              todoList.map(todo => (
                <div className="check-item" key={todo._id}>
                  <div
                    className={`check-box ${checkedTodos.has(todo._id) ? 'checked' : ''}`}
                    onClick={() => toggleTodoCheck(todo._id)}
                  >
                    {checkedTodos.has(todo._id) ? '✓' : ''}
                  </div>
                  <span className={`check-text ${checkedTodos.has(todo._id) ? 'done' : ''}`}>{todo.title}</span>
                  <span className="check-time">{todo.note}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: activeTab === 'aiplan' ? 'block' : 'none' }}>
            {aiPlan === null && <div className="check-item"><span className="check-text">오늘의 AI 계획을 불러오는 중...</span></div>}
            {aiPlan === 'unavailable' && <div className="check-item"><span className="check-text">오늘의 AI 계획을 불러오지 못했습니다.</span></div>}
            {Array.isArray(aiPlan) && aiPlan.length === 0 && (
              <>
                <div className="check-item todo-exam"><span className="check-text">오늘 배정된 AI 계획이 없습니다</span></div>
                <a className="card-action" style={{ bottom: 0 }} href="/career/plan">계획 만들기</a>
              </>
            )}
            {Array.isArray(aiPlan) && aiPlan.length > 0 && (
              <>
                {aiPlan.map(item => (
                  <div className="check-item" key={item._id}>
                    <div className={`check-box ${item.isCompleted ? 'checked' : ''}`} onClick={() => toggleAiPlanItem(item._id)}>
                      {item.isCompleted ? '✓' : ''}
                    </div>
                    <span className={`check-text ${item.isCompleted ? 'done' : ''}`}>{item.content}</span>
                  </div>
                ))}
                <a className="card-action" style={{ bottom: 0 }} href="/career/plan">전체 보기</a>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">📢 최근 공지사항</span>
            <a className="card-action" href="/notice">전체보기</a>
          </div>
          <div className="notice-body-container">
            {(!topNotices || topNotices.length === 0) ? (
              <div className="notice-empty" style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                최근 공지가 없습니다.
              </div>
            ) : (
              topNotices.map(notice => (
                <a className="home-notice-item" href="/notice" key={notice._id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="home-notice-left">
                    <div className="home-notice-icon-box" style={{ background: notice.iconBgColor }}>{notice.icon}</div>
                    <div className="home-notice-content">
                      <div className="home-notice-title">{notice.title}</div>
                      <div className="home-notice-meta">
                        <span className={`badge ${notice.categoryBadgeClass} home-notice-category-badge`}>{notice.categoryName}</span>
                        {notice.formattedDate}
                      </div>
                    </div>
                  </div>
                  <div className="home-notice-right">
                    <span className={`home-notice-dday-badge ${notice.dDayBadgeClass}`}>{notice.dDayText}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 습관 트래커 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🌱 오늘의 습관 트래커</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span id="habit-summary" style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              {completedCount} / {habitList.length} 완료
            </span>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              id="habit-progress-bar"
              style={{
                height: '100%',
                width: `${habitList.length ? Math.round((completedCount / habitList.length) * 100) : 0}%`,
                background: 'linear-gradient(90deg,var(--green),#34d399)',
                borderRadius: 3,
                transition: 'width .4s ease',
              }}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }} id="habit-list">
          {habitList.map(habit => (
            <div
              className="habit-item"
              key={habit._id}
              data-done={habit.isCompleted}
              onClick={() => toggleHabit(habit._id)}
            >
              <div className={`habit-check ${habit.isCompleted ? 'done' : ''}`}>{habit.isCompleted ? '✓' : ''}</div>
              <div className="habit-body">
                <div className={`habit-name ${habit.isCompleted ? 'done' : ''}`}>{habit.title}</div>
                <div className="habit-sub">{habit.category} · 매일</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default Home
