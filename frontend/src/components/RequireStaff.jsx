import { useAuth } from '../context/AuthContext'

function RequireStaff({ children }) {
  const { user, authLoading, refreshUser } = useAuth()

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2, #94a3b8)' }}>불러오는 중...</div>
  }

  if (!user) {
    window.location.href = '/auth/login?expired=1'
    return null
  }

  if (user.role !== 'staff') {
    window.location.href = '/home'
    return null
  }

  if (user.staffStatus === 'pending') {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <a className="auth-logo" href="/"><div className="logo-icon">A</div><span className="logo-text">AcadMe</span></a>
          <div style={{ fontSize: 48, margin: '18px 0 10px' }}>⏳</div>
          <h2>관리자 승인 대기 중입니다</h2>
          <p className="auth-sub" style={{ lineHeight: 1.7, marginTop: 10 }}>
            <strong>{user.name}</strong>님의 대학관계자 가입 신청이 접수되었습니다.<br />
            관리자 승인이 완료되면 강의 등록 기능을 사용할 수 있습니다.
          </p>
          <button className="btn-primary" style={{ marginTop: 18 }} onClick={refreshUser}>승인 상태 새로고침</button>
        </div>
      </div>
    )
  }

  if (user.staffStatus !== 'approved') {
    window.location.href = '/home'
    return null
  }

  if (!user.university?.trim()) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>소속 대학 정보 없음</h2>
        <p style={{ color: 'var(--text2)' }}>이 기능을 사용하려면 소속 대학 정보가 필요합니다.</p>
      </div>
    )
  }

  return children
}

export default RequireStaff
