import { useAuth } from '../context/AuthContext'

function RequireAdmin({ children }) {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2, #94a3b8)' }}>불러오는 중...</div>
  }

  if (!user) {
    window.location.href = '/auth/login?expired=1'
    return null
  }

  if (user.role !== 'admin') {
    window.location.href = '/home'
    return null
  }

  return children
}

export default RequireAdmin
