import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiPost } from '../../api'
import { useAuth } from '../../context/AuthContext'

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

function homeByRole(role) {
  if (role === 'staff') return '/staff/home'
  if (role === 'admin') return '/admin/staff'
  return '/home'
}

function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, authLoading, applySession } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saveEmail, setSaveEmail] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && user) navigate(homeByRole(user.role), { replace: true })
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (searchParams.get('suspended') === '1') setError('계정이 정지되었습니다. 관리자에게 문의하세요.')
    else if (searchParams.get('expired') === '1') setError('세션이 만료되었습니다. 다시 로그인해주세요.')
  }, [searchParams])

  useEffect(() => {
    const saved = localStorage.getItem('savedEmail')
    if (saved) {
      setEmail(saved)
      setSaveEmail(true)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const data = await apiPost('/api/auth/login', { email, password })
      if (saveEmail) localStorage.setItem('savedEmail', email); else localStorage.removeItem('savedEmail')
      applySession(data.user)
      navigate(data.redirectTo || '/home', { replace: true })
    } catch (err) {
      setError(err.message || '이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link className="auth-logo" to="/"><div className="logo-icon">A</div><span className="logo-text">AcadMe</span></Link>
        <h2>다시 만나서 반가워요 👋</h2>
        <p className="auth-sub">학사관리 플랫폼에 로그인하세요</p>
        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>이메일</label>
            <input
              type="email" placeholder="example@university.ac.kr" required
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} placeholder="비밀번호 입력" required
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: 38 }}
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
              >
                {showPw ? EYE_OFF : EYE_OPEN}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" id="save-email" checked={saveEmail} onChange={e => setSaveEmail(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="save-email" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>이메일 저장</label>
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="auth-divider">또는 간편 로그인</div>
        <div className="social-btns">
          <a className="social-btn" href="/auth/kakao">🟡 카카오</a>
          <a className="social-btn" href="/auth/naver">🟢 네이버</a>
          <a className="social-btn" href="/auth/google">🔵 구글</a>
        </div>
        <div className="auth-footer">
          계정이 없으신가요? <Link to="/auth/register">회원가입</Link> &nbsp;·&nbsp; <span>비밀번호 찾기</span>
        </div>
      </div>
    </div>
  )
}

export default Login
