import { useState } from 'react'
import { apiPost } from '../../api'
import { PasswordField } from './icons'

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({ current: false, newPw: false, confirm: false })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentOk = currentPassword.length > 0
  const newPwOk = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && newPassword.length >= 8
  const confirmOk = confirmPassword.length > 0 && confirmPassword === newPassword

  const handleSubmit = async () => {
    setTouched({ current: true, newPw: true, confirm: true })
    setError('')
    setSuccess('')
    if (!currentOk || !newPwOk || !confirmOk) return

    setSubmitting(true)
    try {
      const data = await apiPost('/auth/change-password', { currentPassword, newPassword })
      setSuccess(data.message || '비밀번호가 변경되었습니다.')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,43,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: 420, maxWidth: '92vw', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 18 }}>비밀번호 변경</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>현재 비밀번호</label>
          <PasswordField
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, current: true }))}
            placeholder="현재 비밀번호 입력"
          />
          {touched.current && !currentOk && <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: 'var(--red)' }}>현재 비밀번호를 입력해주세요.</span>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>새 비밀번호</label>
          <PasswordField
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setTouched(t => ({ ...t, newPw: true })) }}
            placeholder="영문+숫자 포함 8자 이상"
          />
          {touched.newPw && newPassword.length > 0 && (
            <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: newPwOk ? '#22c55e' : 'var(--red)' }}>
              {newPwOk ? '사용 가능한 비밀번호입니다.' : '영문+숫자 포함 8자 이상이어야 합니다.'}
            </span>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>새 비밀번호 확인</label>
          <PasswordField
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setTouched(t => ({ ...t, confirm: true })) }}
            placeholder="새 비밀번호 재입력"
          />
          {touched.confirm && confirmPassword.length > 0 && (
            <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: confirmOk ? '#22c55e' : 'var(--red)' }}>
              {confirmOk ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
            </span>
          )}
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>{success}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-accent btn-sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '변경 중...' : '변경하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordModal
