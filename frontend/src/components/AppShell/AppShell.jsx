import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import SidebarStaff from './SidebarStaff'
import Topbar from './Topbar'
import MyPageModal from '../MyPage/MyPageModal'

function AppShell({ currentPage, pageTitle, children }) {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [myPageOpen, setMyPageOpen] = useState(false)

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 769) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isStaff = user?.role === 'staff' && user?.staffStatus === 'approved'

  return (
    <div className="app-shell">
      {isStaff ? (
        <SidebarStaff
          currentPage={currentPage}
          onLogout={logout}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      ) : (
        <Sidebar
          user={user}
          currentPage={currentPage}
          onLogout={logout}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      )}

      <main className="main-content">
        <Topbar
          user={user}
          pageTitle={pageTitle}
          onToggleMobileSidebar={() => {
            if (window.innerWidth >= 769) return
            setMobileOpen(open => !open)
          }}
          onAvatarClick={() => setMyPageOpen(true)}
        />

        <div className="page-content">{children}</div>
      </main>

      {myPageOpen && <MyPageModal onClose={() => setMyPageOpen(false)} />}
    </div>
  )
}

export default AppShell
