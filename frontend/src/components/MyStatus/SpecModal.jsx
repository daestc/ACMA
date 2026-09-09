import { useEffect, useState } from 'react'
import { TEST_OPTIONS } from './specConfigs'

function toDateInputValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function buildInitialValues(config, item) {
  const values = {}
  config.fields.forEach((f) => {
    let v = item ? (item[f.key] ?? '') : ''
    if (v && f.type === 'date') v = toDateInputValue(v)
    values[f.key] = v
  })
  return values
}

function SpecModal({ open, config, editingItem, onClose, onSaved }) {
  const [values, setValues] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!editingItem?._id

  useEffect(() => {
    if (!open) return
    setValues(buildInitialValues(config, editingItem))
    setError('')
  }, [open, config, editingItem])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const modalTitle = config.dynamicTitles
    ? (isEdit ? config.dynamicTitles.edit : config.dynamicTitles.add)
    : config.title

  function updateField(field, raw) {
    setValues((prev) => {
      const next = { ...prev, [field.key]: raw }
      config.fields.forEach((f) => {
        if (f.dependsOn === field.key) next[f.key] = ''
      })
      return next
    })
  }

  function optionsFor(field) {
    if (field.options) return field.options
    if (field.dependsOn) {
      const depValue = values[field.dependsOn]
      return (TEST_OPTIONS[depValue] || []).map((t) => ({ value: t, label: t }))
    }
    return []
  }

  async function handleSubmit() {
    const payload = {}
    for (const f of config.fields) {
      const raw = typeof values[f.key] === 'string' ? values[f.key].trim() : values[f.key]
      if (f.required && !raw) {
        setError(`${f.label}은(는) 필수입니다.`)
        return
      }
      payload[f.key] = raw || null
    }

    const url = isEdit ? `${config.endpoint}/${editingItem._id}` : config.endpoint
    const method = isEdit ? 'PUT' : 'POST'

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('저장에 실패했습니다.')
      const data = await res.json()
      if (!data.success) throw new Error(data.message || '저장에 실패했습니다.')
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!window.confirm('정말 삭제하시겠어요?')) return

    try {
      const res = await fetch(`${config.endpoint}/${editingItem._id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('삭제에 실패했습니다.')
      const data = await res.json()
      if (!data.success) throw new Error(data.message || '삭제에 실패했습니다.')
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="spec-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="spec-modal-content" role="dialog" aria-modal="true">
        <div className="spec-modal-header">
          <h3>{modalTitle}</h3>
          <button type="button" className="spec-modal-close" aria-label="닫기" onClick={onClose}>&times;</button>
        </div>

        <div className="spec-modal-form">
          {config.fields.map((f) => (
            <div className="spec-field" key={f.key}>
              <label htmlFor={`spec-${config.type}-${f.key}`}>
                {f.label} {f.required && <span className="spec-required">*</span>}
              </label>

              {f.type === 'select' ? (
                <select
                  id={`spec-${config.type}-${f.key}`}
                  value={values[f.key] || ''}
                  onChange={(e) => updateField(f, e.target.value)}
                >
                  <option value="" disabled>{f.placeholder}</option>
                  {optionsFor(f).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  id={`spec-${config.type}-${f.key}`}
                  value={values[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={(e) => updateField(f, e.target.value)}
                />
              ) : (
                <input
                  id={`spec-${config.type}-${f.key}`}
                  type={f.type}
                  value={values[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={(e) => updateField(f, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && <p className="spec-error">{error}</p>}

          <div className="spec-modal-footer">
            {isEdit && (
              <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={handleDelete}>삭제</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
            <button type="button" className="btn btn-accent" disabled={submitting} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpecModal
