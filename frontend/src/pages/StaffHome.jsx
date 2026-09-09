import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function StaffHome() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/staff/home/data')
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setDashboard(data.dashboard) })
      .catch((err) => console.error('대시보드 로딩 실패:', err))
    return () => { cancelled = true }
  }, [])

  if (!dashboard) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)', fontSize: 14 }}>불러오는 중...</div>
  }

  const { stats, upcomingSchedules, recentSchedules } = dashboard

  return (
    <>
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg,var(--accent-bg),var(--bg2))', borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>대학관계자 대시보드</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{user?.name}님, 안녕하세요</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
              <span className="badge badge-blue">{user?.university}</span>
              <span style={{ marginLeft: 8 }}>학생 캘린더·학사관리에 반영되는 학교 데이터를 관리합니다.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/staff/lectures" className="btn btn-accent btn-sm">🏫 강의 등록</Link>
            <Link to="/staff/schedules" className="btn btn-ghost btn-sm">📅 일정 등록</Link>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-card blue">
          <div className="stat-icon">🏫</div>
          <div className="stat-label">등록 강의</div>
          <div className="stat-value">{stats.lectureCount}</div>
          <div className="stat-sub">학생 시간표 검색 대상</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon">📅</div>
          <div className="stat-label">학교 일정</div>
          <div className="stat-value">{stats.scheduleCount}</div>
          <div className="stat-sub">학생 캘린더 연동</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">🎓</div>
          <div className="stat-label">학과별 졸업요건</div>
          <div className="stat-value">{stats.majorCount}</div>
          <div className="stat-sub">{stats.hasSchoolGraduation ? '학교 기본값 설정됨' : '학교 기본값 미설정'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">👨‍🎓</div>
          <div className="stat-label">소속 학생</div>
          <div className="stat-value">{stats.studentCount}</div>
          <div className="stat-sub">AcadMe 가입 학생</div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Link
          to="/staff/lectures"
          className="card"
          style={{ textDecoration: 'none', color: 'inherit', transition: 'transform .2s, box-shadow .2s' }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={(e) => { e.currentTarget.style.transform = '' }}
        >
          <div className="card-header" style={{ marginBottom: 10 }}>
            <span className="card-title">🏫 강의 관리</span>
            <span className="badge badge-blue">CSV 업로드</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
            개설 강의를 등록하고 CSV/XLSX로 일괄 업로드합니다. 학생이 시간표에 강의를 추가할 수 있습니다.
          </p>
        </Link>
        <Link
          to="/staff/schedules"
          className="card"
          style={{ textDecoration: 'none', color: 'inherit', transition: 'transform .2s, box-shadow .2s' }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={(e) => { e.currentTarget.style.transform = '' }}
        >
          <div className="card-header" style={{ marginBottom: 10 }}>
            <span className="card-title">📅 학교 일정</span>
            <span className="badge badge-amber">캘린더</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
            수강신청, 기말고사 등 학교 일정을 등록하면 소속 학생 캘린더에 자동 표시됩니다.
          </p>
        </Link>
        <Link
          to="/staff/graduation"
          className="card"
          style={{ textDecoration: 'none', color: 'inherit', transition: 'transform .2s, box-shadow .2s' }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={(e) => { e.currentTarget.style.transform = '' }}
        >
          <div className="card-header" style={{ marginBottom: 10 }}>
            <span className="card-title">🎓 졸업요건</span>
            <span className="badge badge-purple">학과별</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
            학교 기본 졸업요건과 학과별 추가 이수 조건을 설정합니다. 학생 학사관리에 반영됩니다.
          </p>
        </Link>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📌 다가오는 학교 일정</span>
            <Link to="/staff/schedules" className="card-action" style={{ textDecoration: 'none' }}>관리하기</Link>
          </div>

          {upcomingSchedules.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>등록된 예정 일정이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingSchedules.map((schedule) => (
                <div key={schedule._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{schedule.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{schedule.dateLabel}</div>
                  </div>
                  <span className="badge badge-blue">{schedule.dDayLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">📝 최근 등록 일정</span>
          </div>

          {recentSchedules.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>아직 등록한 일정이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentSchedules.map((schedule) => (
                <div key={schedule._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{schedule.title}</div>
                    <span className="badge badge-amber">{schedule.dDayLabel}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{schedule.dateLabel}</div>
                  {schedule.description && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>{schedule.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default StaffHome
