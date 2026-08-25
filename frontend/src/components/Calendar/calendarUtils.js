export function formatDate(year, month, date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
}

export function toInputDate(dateValue) {
  const date = new Date(dateValue)
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function toInputTime(dateValue) {
  const date = new Date(dateValue)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function isMultiDayEvent(event) {
  const start = toInputDate(event.startDate)
  const end = toInputDate(event.endDate || event.startDate)
  return start !== end
}

export function formatEventDate(event) {
  const startDate = toInputDate(event.startDate)
  const endDate = toInputDate(event.endDate || event.startDate)

  if (event.isAllDay) {
    return startDate === endDate ? startDate : `${startDate} ~ ${endDate}`
  }

  const startTime = toInputTime(event.startDate)
  const endTime = toInputTime(event.endDate || event.startDate)

  if (startDate === endDate) return `${startDate} ${startTime} ~ ${endTime}`
  return `${startDate} ${startTime} ~ ${endDate} ${endTime}`
}

function parseSemesterRange(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-([12])$/)
  if (!match) return null

  const year = Number(match[1])
  const term = Number(match[2])

  if (term === 1) {
    return { start: new Date(year, 2, 1), end: new Date(year, 5, 30, 23, 59, 59, 999) }
  }
  return { start: new Date(year, 8, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) }
}

export function isDateInSemester(dateStr, semester) {
  if (!semester) return true
  const range = parseSemesterRange(semester)
  if (!range) return true
  const target = new Date(`${dateStr}T12:00:00`)
  return target >= range.start && target <= range.end
}

// 특정 날짜(dateStr)에 해당하는 시간표 항목들을 '일정' 형태 객체로 변환 (요일 매칭 + 학기 범위 체크)
export function getTimetableEventsForDate(timetables, dateStr) {
  const target = new Date(`${dateStr}T12:00:00`)
  const dayOfWeek = target.getDay()
  const result = []

  ;(timetables || []).forEach((timetable) => {
    if (!isDateInSemester(dateStr, timetable.semester)) return

    ;(timetable.schedule || []).forEach((sch, schIndex) => {
      if (Number(sch.dayOfWeek) !== dayOfWeek) return

      result.push({
        _id: `tt-${timetable._id}-${schIndex}-${dateStr}`,
        isTimetable: true,
        timetableId: timetable._id,
        title: `${timetable.title} ${sch.startTime}~${sch.endTime}`,
        description: timetable.professorName ? `교수: ${timetable.professorName}` : (timetable.location || null),
        startDate: `${dateStr}T${sch.startTime}`,
        endDate: `${dateStr}T${sch.endTime}`,
        isAllDay: false,
        category: timetable.type === 'lecture' ? 'lecture' : timetable.type,
        color: timetable.color || '#60A5FA',
      })
    })
  })

  return result.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
}

// 특정 날짜의 모든 일정(직접 등록 일정 + 시간표에서 파생된 일정), 정렬 규칙은 원본과 동일
// (하루 종일 일정 먼저, 그 다음 시작 시간 순)
export function getEventsByDate(events, timetables, dateStr) {
  const target = new Date(`${dateStr}T12:00:00`)

  const manualEvents = (events || []).filter((event) => {
    const start = new Date(`${toInputDate(event.startDate)}T00:00:00`)
    const end = new Date(`${toInputDate(event.endDate || event.startDate)}T23:59:59`)
    return target >= start && target <= end
  })

  const timetableEvents = getTimetableEventsForDate(timetables, dateStr)

  return [...manualEvents, ...timetableEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return new Date(a.startDate) - new Date(b.startDate)
  })
}

// 08:00~22:00, 30분 단위 시간 옵션 목록 (placeholder는 각 사용처에서 따로 붙인다)
export function getTimeOptions() {
  const options = []
  for (let hour = 8; hour <= 22; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 22 && minute === 30) continue
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return options
}

export function isValidTimetableTime(time) {
  const minutes = timeToMinutes(time)
  if (minutes < 8 * 60 || minutes > 22 * 60) return false
  return minutes % 30 === 0
}
