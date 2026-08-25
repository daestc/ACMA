import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const NAV_GROUPS = [
  {
    icon: '🏠',
    label: '메인',
    items: [
      { page: 'home', href: '/home', label: '홈', spa: true },
      { page: 'calendar', href: '/calendar', label: '캘린더', spa: true },
      { page: 'mystatus', href: '/mystatus', label: 'MyStatus', spa: true },
    ],
  },
  {
    icon: '📚',
    label: '학업',
    items: [
      { page: 'notice', href: '/notice', label: '공지사항', spa: true },
      { page: 'academic', href: '/academic', label: '학사관리', spa: true },
      { page: 'study', href: '/study', label: '공부', spa: true },
      { page: 'suggestions', href: '/suggestions', label: '건의 게시판', spa: true },
    ],
  },
  {
    icon: '💼',
    label: '진로 및 채용',
    items: [
      { page: 'career', href: '/career', label: '진로정보', spa: true },
      { page: 'recruit', href: '/recruit', label: '채용정보', spa: true },
      { page: 'careerPlan', href: '/career/plan', label: '주간 계획', spa: true },
      { page: 'careerPortfolio', href: '/career/portfolio', label: '포트폴리오', spa: true },
      { page: 'careerDiagnosis', href: '/career/diagnosis', label: '진단', spa: true },
    ],
  },
  {
    icon: '💳',
    label: '플랜',
    items: [{ page: 'payment', href: '/payment', label: '구독 플랜', spa: true }],
  },
]

const ADMIN_ITEMS = [
  { page: 'adminUsers', href: '/admin/users', label: '사용자 관리', spa: true },
  { page: 'adminStaff', href: '/admin/staff', label: '가입 승인', spa: true },
  { page: 'adminStatistics', href: '/admin/adminStatistics', label: '통계', spa: true },
]

function NavLink({ item, currentPage }) {
  const className = `sb-mi ${currentPage === item.page ? 'active' : ''}`
  if (item.spa) {
    return (
      <Link to={item.href} className={className}>
        <span className="sb-mi-dot" />{item.label}
      </Link>
    )
  }
  return (
    <a href={item.href} className={className}>
      <span className="sb-mi-dot" />{item.label}
    </a>
  )
}

function PlanCard({ user }) {
  const isPremium = user?.planType === 'premium'
  const today = new Date().toISOString().slice(0, 10)
  const quizUsed = user?.dailyUsage?.quiz?.date === today ? (user.dailyUsage.quiz.count || 0) : 0
  const sumUsed = user?.dailyUsage?.summary?.date === today ? (user.dailyUsage.summary.count || 0) : 0
  const quizPct = Math.min(100, Math.round((quizUsed / 10) * 100))
  const sumPct = Math.min(100, Math.round((sumUsed / 5) * 100))

  return (
    <div className="sb-plan-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>내 플랜</span>
        {isPremium ? (
          <span style={{ fontSize: 11, background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: 20 }}>프리미엄</span>
        ) : (
          <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 20 }}>무료</span>
        )}
      </div>

      {!isPremium ? (
        <>
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
              <span>퀴즈</span><span style={{ color: 'var(--text1)', fontWeight: 600 }}>{quizUsed} / 10</span>
            </div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${quizPct}%`, background: '#534AB7', borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
              <span>요약</span><span style={{ color: 'var(--text1)', fontWeight: 600 }}>{sumUsed} / 5</span>
            </div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sumPct}%`, background: '#1D9E75', borderRadius: 2 }} />
            </div>
          </div>
          <Link to="/payment" className="sb-upgrade-link">업그레이드 →</Link>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>퀴즈 · 요약 무제한 이용 중</div>
          <Link to="/payment" className="sb-upgrade-link">플랜 관리</Link>
        </>
      )}
    </div>
  )
}

function Sidebar({ user, currentPage, onLogout, mobileOpen, onCloseMobile }) {
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

          {user?.role === 'admin' && (
            <>
              <div className="sb-divider" />
              <div className="sb-cat-row">
                <span className="sb-cat-icon">⚙️</span>
                <span className="sb-cat-name">관리</span>
              </div>
              <div className="sb-sub-list">
                {ADMIN_ITEMS.map(item => (
                  <NavLink key={item.page} item={item} currentPage={currentPage} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <PlanCard user={user} />
          <div className="nav-item" onClick={onLogout}>
            <span className="nav-icon">🚪</span><span className="sb-item-label">로그아웃</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
