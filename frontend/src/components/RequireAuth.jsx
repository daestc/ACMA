import { useAuth } from '../context/AuthContext'

function RequireAuth({ children }) {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2, #94a3b8)' }}>불러오는 중...</div>
  }

  if (!user) {
    window.location.href = '/auth/login?expired=1'
    return null
  }

  return children
}

export default RequireAuth
