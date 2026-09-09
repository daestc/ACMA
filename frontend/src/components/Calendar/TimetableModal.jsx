import { useEffect, useState } from 'react'
import { getTimeOptions, isValidTimetableTime } from './calendarUtils'

const TIME_OPTIONS = getTimeOptions()

const DAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
]

function semesterOptions() {
  const year = new Date().getFullYear()
  return [
    { value: '', label: '학기 없음' },
    { value: `${year}-1`, label: `${year}-1` },
    { value: `${year}-2`, label: `${year}-2` },
  ]
}

const emptyRow = () => ({ dayOfWeek: 1, startTime: '', endTime: '' })
const emptyForm = () => ({ id: '', semester: '', title: '', location: '', type: 'lecture', professorName: '', credits: 0, color: '#60A5FA' })

function TimetableModal({ open, timetable, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [schedule, setSchedule] = useState([emptyRow()])

  useEffect(() => {
    if (!open) return

    if (!timetable) {
      setForm(emptyForm())
      setSchedule([emptyRow()])
      return
    }

    setForm({
      id: timetable._id,
      semester: timetable.semester || '',
      title: timetable.title || '',
      location: timetable.location || '',
      type: timetable.type || 'lecture',
      professorName: timetable.professorName || '',
      credits: timetable.credits || 0,
      color: timetable.color || '#60A5FA',
    })
    setSchedule((timetable.schedule || []).map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })))
  }, [open, timetable])

  if (!open) return null

  const isLecture = form.semester.trim() !== ''

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updateRow(index, field, value) {
    setSchedule((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setSchedule((rows) => [...rows, emptyRow()])
  }

  function removeRow(index) {
    setSchedule((rows) => {
      if (rows.length <= 1) {
        alert('시간 정보는 최소 1개 이상 필요합니다.')
        return rows
      }
      return rows.filter((_, i) => i !== index)
    })
  }

  function validateSchedule() {
    for (const row of schedule) {
      if (!row.startTime || !row.endTime) {
        alert('모든 시간 정보의 시작 시간과 종료 시간을 입력해 주세요.')
        return false
      }
      if (row.startTime >= row.endTime) {
        alert('종료 시간은 시작 시간보다 늦어야 합니다.')
        return false
      }
      if (!isValidTimetableTime(row.startTime) || !isValidTimetableTime(row.endTime)) {
        alert('시간은 08:00~22:00 사이에서 30분 단위로 입력해야 합니다.')
        return false
      }
    }
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const title = form.title.trim()
    if (!title) {
      alert('제목을 입력해 주세요.')
      return
    }
    if (!validateSchedule()) return

    const semester = form.semester.trim()
    const timetableData = {
      semester: semester || null,
      title,
      location: form.location || null,
      type: form.type || (semester ? 'lecture' : 'other'),
      professorName: semester ? (form.professorName || null) : null,
      credits: semester ? Number(form.credits || 0) : 0,
      color: form.color || '#60A5FA',
      schedule: schedule.map((r) => ({ dayOfWeek: Number(r.dayOfWeek), startTime: r.startTime, endTime: r.endTime })),
    }

    const url = form.id ? `/calendar/timetables/${form.id}` : '/calendar/timetables'
    const method = form.id ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timetableData),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => null)
      alert(errorData?.error || '시간표 저장 실패')
      return
    }

    await onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!form.id) return
    if (!window.confirm('이 시간표를 삭제할까요?')) return

    const res = await fetch(`/calendar/timetables/${form.id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('시간표 삭제 실패')
      return
    }

    await onSaved()
    onClose()
  }

  return (
    <div className="event-modal" style={{ display: 'flex' }}>
      <div className="event-modal-content">
        <h3>{form.id ? '시간표 상세 / 수정' : '시간표 추가'}</h3>

        <form onSubmit={handleSubmit}>
          <label>
            학기 구분
            <select value={form.semester} onChange={(e) => update('semester', e.target.value)}>
              {semesterOptions().map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label>
            제목
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </label>

          <label>
            장소
            <input type="text" value={form.location} onChange={(e) => update('location', e.target.value)} />
          </label>

          <label>
            유형
            <input type="text" value={form.type} onChange={(e) => update('type', e.target.value)} placeholder="lecture, partTime, study 등" />
          </label>

          <label>
            교수 이름
            <input type="text" value={form.professorName} onChange={(e) => update('professorName', e.target.value)} disabled={!isLecture} />
          </label>

          <label>
            학점
            <input type="number" min="0" value={form.credits} onChange={(e) => update('credits', e.target.value)} disabled={!isLecture} />
          </label>

          <label>
            색상
            <input type="color" value={form.color} onChange={(e) => update('color', e.target.value)} />
          </label>

          <div id="tt-schedule-list">
            {schedule.map((row, i) => (
              <div className="tt-schedule-row" key={i}>
                <select value={row.dayOfWeek} onChange={(e) => updateRow(i, 'dayOfWeek', Number(e.target.value))} required>
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <select value={row.startTime} onChange={(e) => updateRow(i, 'startTime', e.target.value)} required>
                  <option value="">시간 선택</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select value={row.endTime} onChange={(e) => updateRow(i, 'endTime', e.target.value)} required>
                  <option value="">시간 선택</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm remove-schedule-row-btn" onClick={() => removeRow(i)}>삭제</button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-sm" onClick={addRow}>+시간 추가</button>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn-accent btn-sm">저장</button>
            {form.id && (
              <button type="button" className="btn btn-sm" onClick={handleDelete}>삭제</button>
            )}
            <button type="button" className="btn btn-sm" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TimetableModal
