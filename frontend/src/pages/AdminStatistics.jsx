import { useEffect, useState } from 'react'

const FILL_COLORS = ['fill-blue', 'fill-green', 'fill-amber', 'fill-purple']

function AdminStatistics() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/admin/adminStatistics/data')
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setStats(data.stats) })
      .catch((err) => console.error('관리자 통계 로딩 실패:', err))
    return () => { cancelled = true }
  }, [])

  const totalStudents = stats?.totalStudents ?? 0
  const totalUniversities = stats?.totalUniversities ?? 0
  const universities = stats?.universities || []
  const avgPerUniv = totalUniversities ? Math.round(totalStudents / totalUniversities) : 0
  const maxCount = Math.max(...universities.map((u) => u.studentCount || 0), 1)

  return (
    <>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card blue">
          <div className="stat-icon">🏫</div>
          <div className="stat-label">등록된 대학교</div>
          <div className="stat-value">{totalUniversities}</div>
          <div className="stat-sub">개 대학</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">👥</div>
          <div className="stat-label">전체 학생 수</div>
          <div className="stat-value">{totalStudents.toLocaleString()}</div>
          <div className="stat-sub">명 등록</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon">📊</div>
          <div className="stat-label">대학당 평균 학생</div>
          <div className="stat-value">{avgPerUniv.toLocaleString()}</div>
          <div className="stat-sub">명 평균</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">🥇</div>
          <div className="stat-label">최다 학생 대학</div>
          <div className="stat-value" style={{ fontSize: 18, lineHeight: 1.4 }}>{universities.length ? universities[0].name : '-'}</div>
          <div className="stat-sub">{universities.length ? `${(universities[0].studentCount || 0).toLocaleString()}명` : ''}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">대학교별 학생 분포</div>
          <span className="badge badge-blue">총 {universities.length}개 대학</span>
        </div>

        {universities.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>등록된 대학교 데이터가 없습니다.</div>
        ) : universities.map((uni, index) => (
          <div className="progress-wrap" key={uni.name}>
            <div className="progress-header">
              <span className="progress-label">{uni.name}</span>
              <span className="progress-value">{(uni.studentCount || 0).toLocaleString()}명</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${FILL_COLORS[index % FILL_COLORS.length]}`} style={{ width: `${Math.round(((uni.studentCount || 0) / maxCount) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">대학교별 상세 현황</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px' }}>순위</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px' }}>대학교</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: 10, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.5px' }}>학생 수</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: 10, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.5px' }}>비율</th>
              </tr>
            </thead>
            <tbody>
              {universities.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '20px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>데이터가 없습니다.</td>
                </tr>
              ) : universities.map((uni, index) => (
                <tr key={uni.name} style={{ borderBottom: '1px solid var(--border)', background: index % 2 === 1 ? 'var(--bg3)' : undefined }}>
                  <td style={{ padding: 10, fontSize: 13, color: 'var(--text2)' }}>{index + 1}</td>
                  <td style={{ padding: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{uni.name}</td>
                  <td style={{ padding: 10, fontSize: 13, textAlign: 'right', color: 'var(--text)' }}>{(uni.studentCount || 0).toLocaleString()}</td>
                  <td style={{ padding: 10, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>{totalStudents ? (((uni.studentCount || 0) / totalStudents) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default AdminStatistics
