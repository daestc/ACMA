import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import EventModal from '../components/Calendar/EventModal'
import TimetableModal from '../components/Calendar/TimetableModal'
import LectureSearchModal from '../components/Calendar/LectureSearchModal'
import { fetchWeatherList } from '../utils/weather'
import {
  formatDate,
  getEventsByDate,
  isMultiDayEvent,
  formatEventDate,
  timeToMinutes,
} from '../components/Calendar/calendarUtils'

const MONTH_DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']

const WEEK_DAYS = [
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
]
const TT_START_HOUR = 8
const TT_END_HOUR = 22
const TT_SLOT_MIN = 30
const TT_SLOT_HEIGHT = 40

function TimetableGrid({ timetables, onSelect }) {
  const slotCount = ((TT_END_HOUR - TT_START_HOUR) * 60) / TT_SLOT_MIN
  const startMinutes = TT_START_HOUR * 60
  const endMinutes = TT_END_HOUR * 60

  const blocks = []
  ;(timetables || []).forEach((item) => {
    ;(item.schedule || []).forEach((sch, idx) => {
      const dayIndex = WEEK_DAYS.findIndex((d) => d.value === Number(sch.dayOfWeek))
      if (dayIndex === -1) return

      const start = timeToMinutes(sch.startTime)
      const end = timeToMinutes(sch.endTime)
      if (end <= startMinutes || start >= endMinutes) return

      const visibleStart = Math.max(start, startMinutes)
      const visibleEnd = Math.min(end, endMinutes)
      const startLine = Math.floor((visibleStart - startMinutes) / TT_SLOT_MIN) + 2
      const endLine = Math.ceil((visibleEnd - startMinutes) / TT_SLOT_MIN) + 2

      blocks.push({
        key: `${item._id}-${idx}`,
        dayIndex,
        startLine,
        endLine,
        color: item.color || '#60A5FA',
        title: item.title,
        time: `${sch.startTime}~${sch.endTime}`,
        location: item.location || '',
        onClick: () => onSelect(item),
      })
    })
  })

  return (
    <div
      id="timetable-grid"
      className="timetable"
      style={{
        display: 'grid',
        gridTemplateColumns: `72px repeat(${WEEK_DAYS.length}, 1fr)`,
        gridTemplateRows: `56px repeat(${slotCount}, ${TT_SLOT_HEIGHT}px)`,
        position: 'relative',
      }}
    >
      <div className="tt-header" style={{ gridColumn: 1, gridRow: 1 }} />
      {WEEK_DAYS.map((d, i) => (
        <div key={d.value} className="tt-header" style={{ gridColumn: i + 2, gridRow: 1 }}>{d.label}</div>
      ))}

      {Array.from({ length: slotCount }).map((_, i) => {
        const minutes = startMinutes + i * TT_SLOT_MIN
        const hour = Math.floor(minutes / 60)
        const minute = minutes % 60
        const row = i + 2
        return (
          <Fragment key={`slot-${i}`}>
            <div className="tt-time" style={{ gridColumn: 1, gridRow: row }}>
              {minute === 0 ? `${String(hour).padStart(2, '0')}:00` : ''}
            </div>
            {WEEK_DAYS.map((d, dayIndex) => (
              <div key={`cell-${i}-${d.value}`} className="tt-cell" style={{ gridColumn: dayIndex + 2, gridRow: row }} />
            ))}
          </Fragment>
        )
      })}

      {blocks.map((b) => (
        <div
          key={b.key}
          className="tt-class-block"
          style={{ gridColumn: b.dayIndex + 2, gridRow: `${b.startLine} / ${b.endLine}`, background: b.color }}
          onClick={b.onClick}
        >
          <strong>{b.title}</strong><br /><small>{b.time}</small><br /><small>{b.location}</small>
        </div>
      ))}
    </div>
  )
}

function Calendar() {
  const { user } = useAuth()

  const [view, setView] = useState('month') // 'month' | 'week'
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [timetables, setTimetables] = useState([])
  const [weatherMap, setWeatherMap] = useState({})
  const [selectedDateStr, setSelectedDateStr] = useState(null)

  const [eventModal, setEventModal] = useState({ open: false, mode: 'create', event: null })
  const [timetableModal, setTimetableModal] = useState({ open: false, timetable: null })
  const [lectureSearchOpen, setLectureSearchOpen] = useState(false)

  const loadCalendarData = useCallback(async () => {
    const [eventRes, timetableRes] = await Promise.all([
      fetch('/calendar/events'),
      fetch('/calendar/timetables'),
    ])
    setEvents(await eventRes.json())
    setTimetables(await timetableRes.json())
  }, [])

  useEffect(() => {
    loadCalendarData()
  }, [loadCalendarData])

  useEffect(() => {
    let cancelled = false
    fetchWeatherList()
      .then((list) => {
        if (cancelled) return
        const map = {}
        list.forEach((w) => {
          map[w.date] = w
        })
        setWeatherMap(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function openCalendarEvent(event) {
    if (event.isTimetable) {
      const tt = timetables.find((t) => t._id === event.timetableId)
      if (tt) setTimetableModal({ open: true, timetable: tt })
      return
    }
    if (event.isUniversityEvent) {
      setEventModal({ open: true, mode: 'university', event })
      return
    }
    setEventModal({ open: true, mode: 'edit', event })
  }

  async function afterSaved() {
    await loadCalendarData()
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const dayCells = useMemo(() => {
    const cells = []
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
    for (let d = 1; d <= lastDate; d++) cells.push(d)
    return cells
  }, [firstDayOfWeek, lastDate])

  const selectedDayEvents = selectedDateStr ? getEventsByDate(events, timetables, selectedDateStr) : []

  return (
    <>
      <div className="view-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>월간 달력</button>
        <button className={`btn btn-sm ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>시간표</button>
      </div>

      {view === 'month' && (
        <div className="card">
          <div className="cal-header">
            <div className="cal-nav">
              <button
                className="cal-nav-btn"
                onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <span className="cal-month">{year}년 {month + 1}월</span>
              <button
                className="cal-nav-btn"
                onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
            <button
              className="btn btn-accent btn-sm"
              onClick={() => setEventModal({ open: true, mode: 'create', event: null })}
            >
              + 일정 추가
            </button>
          </div>

          <div id="calendar-grid" className="cal-grid">
            {MONTH_DAY_HEADERS.map((d) => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}

            {dayCells.map((d, i) => {
              if (d === null) return <div key={`empty-${i}`} className="cal-day other-month" />

              const dateStr = formatDate(year, month + 1, d)
              const dayEvents = getEventsByDate(events, timetables, dateStr)
              const weather = weatherMap[dateStr]

              return (
                <div key={dateStr} className="cal-day" onClick={() => setSelectedDateStr(dateStr)}>
                  <div className="day-num">{d}</div>

                  {weather && (
                    <div className="day-weather-icon" title={`${weather.description} / ${weather.temp ?? '-'}℃`}>
                      {weather.icon}
                    </div>
                  )}

                  <div className="day-events">
                    {dayEvents.map((event) => {
                      const multiDay = !event.isTimetable && isMultiDayEvent(event)
                      const cls = [
                        multiDay ? 'multi-day-event-bar' : 'single-day-event-bar',
                        event.isTimetable ? 'timetable-event-bar' : '',
                        event.isUniversityEvent ? 'university-event-bar' : '',
                      ].filter(Boolean).join(' ')

                      return (
                        <div
                          key={event._id}
                          className={cls}
                          title={`${event.isUniversityEvent ? '[학교 일정] ' : ''}${event.title}\n${event.description || ''}\n${formatEventDate(event)}`}
                          style={{ background: event.color || '#3B82F6' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openCalendarEvent(event)
                          }}
                        >
                          {event.isUniversityEvent ? '[학교] ' : ''}{event.title}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedDateStr && (
            <div className="selected-day-panel">
              <h3>{selectedDateStr} 일정</h3>

              {selectedDayEvents.length === 0 ? (
                <p>등록된 일정이 없습니다.</p>
              ) : (
                <div>
                  {selectedDayEvents.map((event) => (
                    <div key={event._id} className="selected-event-item" onClick={() => openCalendarEvent(event)}>
                      <span className="selected-event-dot" style={{ background: event.color || '#3B82F6' }} />
                      <span>
                        {event.isUniversityEvent ? '[학교] ' : ''}{event.title}
                        {(event.isTimetable || event.isUniversityEvent) && (
                          <small style={{ display: 'block', color: 'var(--text2)', marginTop: 2 }}>{formatEventDate(event)}</small>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'week' && (
        <div className="card">
          <div className="cal-header">
            <span className="cal-month">주간 시간표</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLectureSearchOpen(true)}>강의 검색</button>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => setTimetableModal({ open: true, timetable: null })}
              >
                + 시간표 추가
              </button>
            </div>
          </div>

          <TimetableGrid
            timetables={timetables}
            onSelect={(tt) => setTimetableModal({ open: true, timetable: tt })}
          />
        </div>
      )}

      <EventModal
        open={eventModal.open}
        mode={eventModal.mode}
        event={eventModal.event}
        onClose={() => setEventModal({ open: false, mode: 'create', event: null })}
        onSaved={afterSaved}
      />

      <TimetableModal
        open={timetableModal.open}
        timetable={timetableModal.timetable}
        onClose={() => setTimetableModal({ open: false, timetable: null })}
        onSaved={afterSaved}
      />

      <LectureSearchModal
        open={lectureSearchOpen}
        university={user?.university}
        onClose={() => setLectureSearchOpen(false)}
        onAdded={afterSaved}
      />
    </>
  )
}

export default Calendar
