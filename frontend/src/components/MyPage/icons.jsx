import { useState } from 'react'

const EYE_OPEN = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
)
const EYE_OFF = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export function PasswordField({ id, value, onChange, onBlur, placeholder, className }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id} type={show ? 'text' : 'password'} className={`input-field ${className || ''}`}
        placeholder={placeholder} style={{ width: '100%', paddingRight: 38 }}
        value={value} onChange={onChange} onBlur={onBlur}
      />
      <button
        type="button" onClick={() => setShow(v => !v)}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
      >
        {show ? EYE_OFF : EYE_OPEN}
      </button>
    </div>
  )
}
