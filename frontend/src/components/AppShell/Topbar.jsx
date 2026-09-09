import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'
import { useStudyTimer } from '../../context/StudyTimerContext'
import { formatClock } from '../Study/studyUtils'

const ITEMS_PER_PAGE = 5

function badgeStyle(dDayBadgeClass) {
  if (dDayBadgeClass === 'red') return { color: '#ef4444', background: '#fee2e2' }
  if (dDayBadgeClass === 'amber') return { color: '#f59e0b', background: '#fef3c7' }
  return { color: '#3b82f6', background: '#dbeafe' }
}

function Topbar({ user, pageTitle, onToggleMobileSidebar, onAvatarClick }) {
  const { liveClock, setStudyTab, studyTab } = useStudyTimer()
  const location = useLocation()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    apiGet('/notice/urgent')
      .then(data => {
        if (cancelled) return
        const list = data?.success && Array.isArray(data.alerts) ? data.alerts : []
        setAlerts(list)
        if (list.length > 0) {
          const currentKey = list.map(a => a.title).join('|')
          const lastRead = localStorage.getItem('last_read_alerts')
          setHasUnread(currentKey !== lastRead)
        }
      })
      .catch(() => setAlerts([]))
    return () => { cancelled = true }
  }, [])

  const totalPages = Math.max(1, Math.ceil(alerts.length / ITEMS_PER_PAGE))
  const pageItems = alerts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const togglePanel = () => {
    const next = !panelOpen
    setPanelOpen(next)
    if (next && alerts.length > 0) {
      localStorage.setItem('last_read_alerts', alerts.map(a => a.title).join('|'))
      setHasUnread(false)
    }
  }

  const homeHref = user?.role === 'staff' ? '/staff/home' : user?.role === 'admin' ? '/admin/staff' : '/home'

  return (
    <div className="global-header" id="global-header">
      <div className="gh-left">
        <button className="gh-hamburger" onClick={onToggleMobileSidebar} aria-label="메뉴">
          <div className="gh-hamburger-icon"><span /><span /><span /></div>
        </button>
        <div className="gh-logo" onClick={() => navigate(homeHref)} style={{ cursor: 'pointer' }}>
          <div className="gh-logo-icon">A</div>
          <span className="gh-logo-text">AcadMe</span>
        </div>
      </div>

      <div className="gh-center">
        <span className="gh-title">{pageTitle || '홈'}</span>
      </div>

      {liveClock && !(location.pathname === '/study' && studyTab === 'timer') && (
        <button
          type="button"
          onClick={() => { setStudyTab('timer'); navigate('/study') }}
          title="공부 타이머가 진행 중입니다"
          style={{
            marginRight: 4,
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: 'var(--accent-bg)',
            border: '1.5px solid var(--accent)',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {liveClock.label} {formatClock(liveClock.seconds)}
        </button>
      )}

      <div
        className="notification-icon-wrapper"
        onClick={togglePanel}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        <i className="icon-bell" /> 🔔
        {hasUnread && (
          <span
            id="notif-badge-dot"
            className="notification-dot"
            style={{ position: 'absolute', top: -2, right: -2, width: 5, height: 5, background: '#ef4444', borderRadius: '50%', display: 'block' }}
          />
        )}
      </div>

      <div className="gh-avatar" onClick={onAvatarClick}>
        {user?.name ? user.name[0] : '김'}
      </div>

      <div id="notif-panel" className={`notif-panel ${panelOpen ? 'open' : ''}`} ref={panelRef}>
        <div className="notif-header">
          <span>새로운 알림</span>
          <button onClick={() => setPanelOpen(false)} className="notif-close-btn">닫기</button>
        </div>

        <div className="notif-list" id="dynamic-notif-list">
          {pageItems.length === 0 ? (
            <p className="notif-empty" style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>표시할 알림이 없습니다.</p>
          ) : (
            pageItems.map((notice, i) => {
              const style = badgeStyle(notice.dDayBadgeClass)
              const content = (
                <>
                  <div style={{ fontWeight: 600, color: '#334155', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {notice.title || '알림'}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: 6, flexShrink: 0, ...style }}>
                    {notice.dDayText || 'D-Day'}
                  </div>
                </>
              )
              const itemStyle = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', color: 'inherit' }
              return notice.url ? (
                <a key={notice._id || i} href={notice.url} target="_blank" rel="noreferrer" className="notif-item" style={{ ...itemStyle, cursor: 'pointer' }}>{content}</a>
              ) : (
                <div key={notice._id || i} className="notif-item" style={itemStyle}>{content}</div>
              )
            })
          )}
        </div>

        {alerts.length > ITEMS_PER_PAGE && (
          <div id="notif-more-btn-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 10 }}>
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>◂</button>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{page}/{totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>▸</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Topbar
