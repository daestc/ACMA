import { useState } from 'react'
import { apiPost } from '../../api'
import { PasswordField } from './icons'

function WithdrawModal({ provider, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isLocal = provider === 'local'

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const data = await apiPost('/auth/withdraw', { password: isLocal ? password : '' })
      if (!data.ok) {
        setError(data.message || '탈퇴에 실패했습니다.')
        return
      }
      window.location.href = '/auth/login'
    } catch (err) {
      setError(err.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,43,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: 420, maxWidth: '92vw', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>계정 탈퇴</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          탈퇴하면 모든 데이터가 <strong>영구 삭제</strong>되며 복구할 수 없습니다.
        </p>

        {isLocal ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
              본인 확인을 위해 비밀번호를 입력해주세요
            </label>
            <PasswordField value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호 입력" />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 8, padding: 12 }}>
              소셜 계정으로 로그인된 상태입니다.<br />아래 버튼을 누르면 즉시 탈퇴 처리됩니다.
            </p>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button
            className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
            onClick={handleSubmit} disabled={submitting}
          >
            {submitting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WithdrawModal
