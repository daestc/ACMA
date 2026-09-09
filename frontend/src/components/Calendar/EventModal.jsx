import { useEffect, useState } from 'react'
import { toInputDate, toInputTime } from './calendarUtils'

const CATEGORY_OPTIONS = [
  { value: 'personal', label: '개인' },
  { value: 'lecture', label: '강의' },
  { value: 'exam', label: '시험' },
  { value: 'assignment', label: '과제' },
  { value: 'certification', label: '자격증' },
  { value: 'notice', label: '공지' },
  { value: 'other', label: '기타' },
]

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  allDay: true,
  category: 'personal',
  color: '#3B82F6',
}

function EventModal({ open, mode, event, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    if (mode !== 'edit' && mode !== 'university') {
      setForm(EMPTY_FORM)
      return
    }
    if (!event) return

    const startDate = toInputDate(event.startDate)
    const endDate = toInputDate(event.endDate || event.startDate)
    const allDay = mode === 'university' ? true : (event.isAllDay ?? true)

    setForm({
      id: mode === 'edit' ? event._id : '',
      title: event.title || '',
      description: event.description || '',
      startDate,
      endDate,
      allDay,
      category: event.category || (mode === 'university' ? 'notice' : 'personal'),
      color: event.color || (mode === 'university' ? '#F59E0B' : '#3B82F6'),
      startTime: !allDay ? toInputTime(event.startDate) : '',
      endTime: !allDay ? toInputTime(event.endDate || event.startDate) : '',
    })
  }, [open, mode, event])

  if (!open) return null

  const readOnly = mode === 'university'
  const title = readOnly ? '학교 일정' : (form.id ? '일정 상세 / 수정' : '일정 추가')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (readOnly) return

    const { allDay, startDate, startTime, endTime } = form
    const endDate = form.endDate || startDate

    if (!allDay) {
      if (!startTime || !endTime) {
        alert('시간 일정은 시작 시간과 종료 시간을 모두 입력해야 합니다.')
        return
      }
      const start = new Date(`${startDate}T${startTime}`)
      const end = new Date(`${endDate}T${endTime}`)
      if (end <= start) {
        alert('종료 시간은 시작 시간보다 늦어야 합니다.')
        return
      }
    }

    const eventData = {
      title: form.title,
      description: form.description,
      startDate: allDay ? startDate : `${startDate}T${startTime}`,
      endDate: allDay ? endDate : `${endDate}T${endTime}`,
      category: form.category,
      color: form.color,
      isAllDay: allDay,
    }

    const url = form.id ? `/calendar/events/${form.id}` : '/calendar/events'
    const method = form.id ? 'PUT' : 'POST'

    setSaving(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      })

      if (!res.ok) {
        alert(form.id ? '일정 수정 실패' : '일정 저장 실패')
        return
      }

      await onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!form.id) return
    if (!window.confirm('이 일정을 삭제할까요?')) return

    const res = await fetch(`/calendar/events/${form.id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('일정 삭제 실패')
      return
    }

    await onSaved()
    onClose()
  }

  return (
    <div className="event-modal" style={{ display: 'flex' }}>
      <div className="event-modal-content">
        <h3>{title}</h3>

        <form onSubmit={handleSubmit}>
          <label>
            제목
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required disabled={readOnly} />
          </label>

          <label>
            설명
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} disabled={readOnly} />
          </label>

          <label>
            시작 날짜
            <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required disabled={readOnly} />
          </label>

          {!form.allDay && (
            <label className="event-time-field">
              시작 시간
              <input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} disabled={readOnly} />
            </label>
          )}

          <label>
            종료 날짜
            <input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} disabled={readOnly} />
          </label>

          {!form.allDay && (
            <label className="event-time-field">
              종료 시간
              <input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} disabled={readOnly} />
            </label>
          )}

          <label>
            하루 종일 일정
            <input type="checkbox" checked={form.allDay} onChange={(e) => update('allDay', e.target.checked)} disabled={readOnly} />
          </label>

          <label>
            카테고리
            <select value={form.category} onChange={(e) => update('category', e.target.value)} disabled={readOnly}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label>
            색상
            <input type="color" value={form.color} onChange={(e) => update('color', e.target.value)} disabled={readOnly} />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {!readOnly && (
              <button type="submit" className="btn btn-accent btn-sm" disabled={saving}>저장</button>
            )}
            {!readOnly && form.id && (
              <button type="button" className="btn btn-sm" onClick={handleDelete}>삭제</button>
            )}
            <button type="button" className="btn btn-sm" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EventModal
