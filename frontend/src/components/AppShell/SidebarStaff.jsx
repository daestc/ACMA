import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const NAV_GROUPS = [
  {
    icon: '🏠',
    label: '메인',
    items: [{ page: 'staffHome', href: '/staff/home', label: '홈' }],
  },
  {
    icon: '🏫',
    label: '학사관리',
    items: [
      { page: 'lectureAdmin', href: '/staff/lectures', label: '강의 관리' },
      { page: 'staffSchedule', href: '/staff/schedules', label: '학교 일정 등록' },
      { page: 'staffGraduation', href: '/staff/graduation', label: '졸업요건 설정' },
    ],
  },
  {
    icon: '👥',
    label: '학생관리',
    items: [
      { page: 'staffStudents', href: '/staff/students', label: '학생 목록' },
      { page: 'staffSuggestions', href: '/staff/suggestions', label: '학생 건의' },
    ],
  },
]

function NavLink({ item, currentPage }) {
  const className = `sb-mi ${currentPage === item.page ? 'active' : ''}`
  return (
    <Link to={item.href} className={className}>
      <span className="sb-mi-dot" />{item.label}
    </Link>
  )
}

function SidebarStaff({ currentPage, onLogout, mobileOpen, onCloseMobile }) {
  const [expanded, setExpanded] = useState(false)
  const collapseTimer = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(collapseTimer.current)
    setExpanded(true)
  }
  const handleMouseLeave = () => {
    collapseTimer.current = setTimeout(() => setExpanded(false), 150)
  }

  return (
    <>
      <div
        id="sidebar-backdrop"
        className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`}
        onClick={onCloseMobile}
      />

      <aside
        className={`sidebar ${expanded ? 'expanded' : ''} ${mobileOpen ? 'open' : ''}`}
        id="app-sidebar"
        data-role="staff"
        style={{ width: expanded ? 220 : 52 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="sb-logo-row">
          <div className="s-logo">A</div>
          <span className="s-logo-text">AcadMe</span>
        </div>

        <div className="sb-scroll">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label}>
              <div className="sb-cat-row">
                <span className="sb-cat-icon">{group.icon}</span>
                <span className="sb-cat-name">{group.label}</span>
              </div>
              <div className="sb-sub-list">
                {group.items.map(item => (
                  <NavLink key={item.page} item={item} currentPage={currentPage} />
                ))}
              </div>
              {i < NAV_GROUPS.length - 1 && <div className="sb-divider" />}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="nav-item" onClick={onLogout}>
            <span className="nav-icon">🚪</span><span className="sb-item-label">로그아웃</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default SidebarStaff
