import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiPostForm } from '../../api'
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

const EMAIL_REGEX = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/

function FieldMsg({ msg }) {
  if (!msg) return null
  return <span className={`field-msg ${msg.isError ? 'field-error' : 'field-ok'}`}>{msg.text}</span>
}

function fieldClass(msg) {
  if (!msg) return ''
  return msg.isError ? 'input-error' : 'input-ok'
}

function Register() {
  const navigate = useNavigate()
  const { user, authLoading, applySession } = useAuth()

  const [role, setRole] = useState('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [file, setFile] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const [msgs, setMsgs] = useState({}) // { name, email, university, major, verification, password, passwordConfirm }
  const [emailState, setEmailState] = useState('idle') // idle | checking | valid | invalid
  const emailTimer = useRef(null)

  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && user) navigate('/home', { replace: true })
  }, [authLoading, user, navigate])

  const setMsg = (field, text, isError) => setMsgs(prev => ({ ...prev, [field]: { text, isError } }))
  const clearMsg = (field) => setMsgs(prev => ({ ...prev, [field]: null }))

  // ── 필드별 검증 (public/js/register.js 규칙 그대로) ──────
  const validateName = () => {
    const val = name.trim()
    if (!val) { setMsg('name', '이름을 입력해주세요.', true); return false }
    if (val.length < 2) { setMsg('name', '이름은 2자 이상 입력해주세요.', true); return false }
    setMsg('name', '확인되었습니다.', false)
    return true
  }

  const validateUniversity = () => {
    const val = university.trim()
    if (!val || val.length < 2) { setMsg('university', '대학교 이름을 입력해주세요.', true); return false }
    setMsg('university', '확인되었습니다.', false)
    return true
  }

  const validateMajor = () => {
    if (role === 'staff') return true
    const val = major.trim()
    if (!val || val.length < 2) { setMsg('major', '전공을 입력해주세요.', true); return false }
    setMsg('major', '확인되었습니다.', false)
    return true
  }

  const validatePassword = () => {
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    if (!password) { setMsg('password', '비밀번호를 입력해주세요.', true); return false }
    if (password.length < 8) { setMsg('password', '비밀번호는 8자 이상이어야 합니다.', true); return false }
    if (!hasLetter || !hasNumber) { setMsg('password', '영문과 숫자를 모두 포함해야 합니다.', true); return false }
    setMsg('password', '사용 가능한 비밀번호입니다.', false)
    return true
  }

  const validatePasswordConfirm = () => {
    if (!passwordConfirm) { setMsg('passwordConfirm', '비밀번호를 다시 입력해주세요.', true); return false }
    if (passwordConfirm !== password) { setMsg('passwordConfirm', '비밀번호가 일치하지 않습니다.', true); return false }
    setMsg('passwordConfirm', '비밀번호가 일치합니다.', false)
    return true
  }

  const validateVerification = () => {
    if (role !== 'staff') return true
    if (!file) { setMsg('verification', '관계자 인증 사진을 첨부해주세요.', true); return false }
    return true
  }

  const handleEmailChange = (val) => {
    setEmail(val)
    clearTimeout(emailTimer.current)
    setEmailState('idle')

    const trimmed = val.trim()
    if (!trimmed) { setMsg('email', '이메일을 입력해주세요.', true); return }
    if (!EMAIL_REGEX.test(trimmed)) { setMsg('email', '유효하지 않은 이메일 형식입니다.', true); return }

    setMsg('email', '중복 확인 중...', false)
    setEmailState('checking')
    emailTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/auth/check-email?email=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        if (data.exists) {
          setMsg('email', '이미 사용 중인 이메일입니다.', true)
          setEmailState('invalid')
        } else {
          setMsg('email', '사용 가능한 이메일입니다.', false)
          setEmailState('valid')
        }
      } catch {
        clearMsg('email')
        setEmailState('invalid')
      }
    }, 500)
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) { setFile(null); return }
    if (f.size > 5 * 1024 * 1024) {
      e.target.value = ''
      setFile(null)
      setMsg('verification', '5MB 이하의 이미지만 업로드할 수 있습니다.', true)
      return
    }
    setFile(f)
    clearMsg('verification')
  }

  const handleSelectRole = (nextRole) => {
    setRole(nextRole)
    setMajor('')
    clearMsg('major')
    if (nextRole !== 'staff') {
      setFile(null)
      clearMsg('verification')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)

    const okName = validateName()
    const okUniversity = validateUniversity()
    const okMajor = validateMajor()
    const okVerify = validateVerification()
    const okPassword = validatePassword()
    const okConfirm = validatePasswordConfirm()

    if (emailState !== 'valid') {
      setMsg('email', '이메일 중복 확인이 필요합니다.', true)
    }

    if (!okName || emailState !== 'valid' || !okUniversity || !okMajor || !okVerify || !okPassword || !okConfirm) {
      return
    }

    const formData = new FormData()
    formData.append('role', role)
    formData.append('name', name)
    formData.append('email', email)
    formData.append('university', university)
    if (role === 'student') formData.append('major', major)
    formData.append('password', password)
    formData.append('passwordConfirm', passwordConfirm)
    if (role === 'staff' && file) formData.append('verificationImage', file)

    setSubmitting(true)
    try {
      const data = await apiPostForm('/api/auth/register', formData)
      applySession(data.user)
      navigate(data.redirectTo || '/home', { replace: true })
    } catch (err) {
      setServerError(err.message || '회원가입에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link className="auth-logo" to="/"><div className="logo-icon">A</div><span className="logo-text">AcadMe</span></Link>
        <h2>회원가입</h2>
        <p className="auth-sub">가입 유형을 선택해주세요</p>

        <div className="user-type-select">
          <div className={`user-type-btn ${role === 'student' ? 'active' : ''}`} onClick={() => handleSelectRole('student')}>
            <div className="icon">🎓</div><div className="label">대학생</div>
          </div>
          <div className={`user-type-btn ${role === 'staff' ? 'active' : ''}`} onClick={() => handleSelectRole('staff')}>
            <div className="icon">🏫</div><div className="label">대학관계자</div>
          </div>
        </div>

        {role === 'staff' && (
          <p style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, lineHeight: 1.6 }}>
            🏫 대학관계자 계정은 가입 후 <strong>관리자 승인</strong>이 완료되어야 강의 등록 기능을 사용할 수 있습니다.
          </p>
        )}

        {serverError && <p className="auth-error">{serverError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>이름</label>
            <input type="text" placeholder="홍길동" autoComplete="name" className={fieldClass(msgs.name)}
              value={name} onChange={e => setName(e.target.value)} onBlur={validateName} />
            <FieldMsg msg={msgs.name} />
          </div>

          <div className="form-group">
            <label>이메일</label>
            <input type="email" placeholder="example@university.ac.kr" autoComplete="email" className={fieldClass(msgs.email)}
              value={email} onChange={e => handleEmailChange(e.target.value)} />
            <FieldMsg msg={msgs.email} />
          </div>

          <div className="form-group">
            <label>대학교</label>
            <input type="text" placeholder="한국대학교" className={fieldClass(msgs.university)}
              value={university} onChange={e => setUniversity(e.target.value)} onBlur={validateUniversity} />
            <FieldMsg msg={msgs.university} />
          </div>

          {role !== 'staff' && (
            <div className="form-group">
              <label>전공</label>
              <input type="text" placeholder="컴퓨터공학과" className={fieldClass(msgs.major)}
                value={major} onChange={e => setMajor(e.target.value)} onBlur={validateMajor} />
              <FieldMsg msg={msgs.major} />
            </div>
          )}

          {role === 'staff' && (
            <div className="form-group">
              <label>관계자 인증 사진</label>
              <label htmlFor="verificationImage" style={{ display: 'flex', alignItems: 'center', gap: 10, border: `2px dashed ${file ? 'var(--green)' : 'var(--border2)'}`, borderRadius: 8, padding: '12px 14px', cursor: 'pointer', background: 'var(--bg3)', transition: 'all .2s' }}>
                <span style={{ fontSize: 20 }}>📷</span>
                <span style={{ fontSize: 12, color: file ? 'var(--green)' : 'var(--text2)' }}>
                  {file ? `📄 ${file.name}` : '재직증명서, 교직원증 등 (jpg/png/webp, 5MB 이하)'}
                </span>
              </label>
              <input type="file" id="verificationImage" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileChange} />
              <FieldMsg msg={msgs.verification} />
            </div>
          )}

          <div className="form-group">
            <label>비밀번호</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} placeholder="영문 + 숫자 포함 8자 이상" autoComplete="new-password"
                className={fieldClass(msgs.password)} style={{ width: '100%', paddingRight: 38 }}
                value={password} onChange={e => setPassword(e.target.value)} onInput={validatePassword} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                {showPw ? EYE_OFF : EYE_OPEN}
              </button>
            </div>
            <FieldMsg msg={msgs.password} />
          </div>

          <div className="form-group">
            <label>비밀번호 확인</label>
            <div style={{ position: 'relative' }}>
              <input type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호 재입력" autoComplete="new-password"
                className={fieldClass(msgs.passwordConfirm)} style={{ width: '100%', paddingRight: 38 }}
                value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onInput={validatePasswordConfirm} />
              <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                {showPwConfirm ? EYE_OFF : EYE_OPEN}
              </button>
            </div>
            <FieldMsg msg={msgs.passwordConfirm} />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '가입 처리 중...' : '가입 완료'}
          </button>
        </form>

        <div className="auth-footer">이미 계정이 있으신가요? <Link to="/auth/login">로그인</Link></div>
      </div>
    </div>
  )
}

export default Register
