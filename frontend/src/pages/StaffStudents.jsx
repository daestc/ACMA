import { useEffect, useState } from 'react'

function StaffStudents() {
  const [students, setStudents] = useState([])
  const [stats, setStats] = useState({ totalCount: 0, onlineCount: 0, premiumCount: 0, dormantCount: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const [modalId, setModalId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadList = () => {
    setLoading(true)
    fetch('/staff/students/list')
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) return
        setStudents(data.students || [])
        setStats(data.stats || { totalCount: 0, onlineCount: 0, premiumCount: 0, dormantCount: 0 })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [])

  const openModal = async (id) => {
    setModalId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/staff/students/${id}`)
      const data = await res.json()
      if (!data.ok) { window.alert('조회 실패'); return }
      setDetail(data.student)
    } catch {
      window.alert('서버 오류가 발생했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }
  const closeModal = () => { setModalId(null); setDetail(null) }

  const statusLabel = { dormant: '휴면 처리', suspended: '계정 정지', active: '정상 복구' }

  const handleStatus = async (action) => {
    if (!modalId) return
    if (!window.confirm(`${statusLabel[action]}하시겠습니까?`)) return
    try {
      const res = await fetch(`/staff/students/${modalId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!data.ok) { window.alert('처리 실패'); return }
      window.alert(`${statusLabel[action]} 완료`)
      closeModal()
      loadList()
    } catch {
      window.alert('서버 오류')
    }
  }

  const handleResetPw = async () => {
    if (!modalId) return
    if (!window.confirm('임시 비밀번호로 초기화하시겠습니까?')) return
    try {
      const res = await fetch(`/staff/students/${modalId}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) { window.alert('초기화 실패'); return }
      window.alert(`임시 비밀번호: ${data.tempPassword}\n\n학생에게 안내 후 변경을 요청하세요.`)
    } catch {
      window.alert('서버 오류')
    }
  }

  const handleDelete = async () => {
    if (!modalId) return
    if (!window.confirm('계정을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/staff/students/${modalId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) { window.alert('삭제 실패'); return }
      window.alert('계정이 삭제되었습니다.')
      closeModal()
      loadList()
    } catch {
      window.alert('서버 오류')
    }
  }

  const q = search.toLowerCase()
  const filtered = students.filter((s) => {
    const searchStr = `${s.name || ''}${s.studentId || ''}${s.major || ''}`.toLowerCase()
    const matchSearch = !q || searchStr.includes(q)
    const matchOnline = filter !== 'online' || s.isOnline
    const matchPremium = filter !== 'premium' || s.planType === 'premium'
    const matchDormant = filter !== 'dormant' || s.isDormant
    return matchSearch && matchOnline && matchPremium && matchDormant
  })

  const statusMap = { active: '정상', dormant: '휴면', suspended: '정지' }
  const statusColor = { active: '#475569', dormant: '#92400E', suspended: '#991B1B' }

  const today = new Date().toISOString().slice(0, 10)
  const quizUsed = detail?.dailyUsage?.quiz?.date === today ? (detail.dailyUsage.quiz.count || 0) : 0
  const summaryUsed = detail?.dailyUsage?.summary?.date === today ? (detail.dailyUsage.summary.count || 0) : 0

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>학생 관리</h2>
      <p style={{ color: 'var(--text2)', marginBottom: 20 }}>소속 학생 계정 현황</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '전체 학생', value: stats.totalCount, color: 'var(--text)' },
          { label: '현재 접속 중', value: stats.onlineCount, color: '#1D9E75' },
          { label: '프리미엄 구독', value: stats.premiumCount, color: '#534AB7' },
          { label: '휴면 대상 (6개월↑)', value: stats.dormantCount, color: '#B45309' },
        ].map((c) => (
          <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>
              {c.value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 2 }}>명</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input-field" placeholder="이름, 학번, 전공으로 검색" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: '1 1 220px' }}
        />
        {[
          { key: 'all', label: '전체' },
          { key: 'online', label: '접속 중' },
          { key: 'premium', label: '프리미엄' },
          { key: 'dormant', label: '휴면 대상' },
        ].map((f) => (
          <button
            key={f.key} type="button" onClick={() => setFilter(f.key)}
            style={{
              height: 32, padding: '0 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              border: filter === f.key ? '1px solid #AFA9EC' : '1px solid var(--border)',
              background: filter === f.key ? '#EEEDFE' : 'var(--bg2)',
              color: filter === f.key ? '#3C3489' : 'var(--text2)',
            }}
          >{f.label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ width: 48, padding: '10px 12px' }}></th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>이름</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>전공</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>학번</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>플랜</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>상태</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>마지막 접속</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>등록된 학생이 없습니다.</td></tr>
              ) : filtered.map((s) => {
                const st = s.accountStatus === 'suspended' ? 'suspended' : (s.accountStatus === 'dormant' || s.isDormant) ? 'dormant' : 'active'
                const statusBg = st === 'suspended' ? '#FEE2E2' : st === 'dormant' ? '#FEF3C7' : '#F1F5F9'
                const statusFg = st === 'suspended' ? '#991B1B' : st === 'dormant' ? '#92400E' : '#475569'
                return (
                  <tr key={s._id} onClick={() => openModal(s._id)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span title={s.isOnline ? '접속 중' : '오프라인'} style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: s.isOnline ? '#1D9E75' : '#94a3b8' }} />
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#534AB7' }}>{s.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{s.major || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>{s.studentId || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.planType === 'premium' ? (
                        <span style={{ fontSize: 11, background: '#EEEDFE', color: '#3C3489', padding: '2px 10px', borderRadius: 20 }}>프리미엄</span>
                      ) : (
                        <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 10px', borderRadius: 20 }}>무료</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, background: statusBg, color: statusFg, padding: '2px 10px', borderRadius: 20 }}>{statusMap[st]}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.isOnline ? (
                        <span style={{ fontSize: 11, background: '#E1F5EE', color: '#1D9E75', padding: '2px 10px', borderRadius: 20 }}>접속 중</span>
                      ) : s.lastLoginAt ? (
                        new Date(s.lastLoginAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      ) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,43,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div style={{ background: 'var(--bg2)', borderRadius: 16, width: 460, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', padding: 24 }}>
            {detailLoading || !detail ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>불러오는 중...</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEEDFE', color: '#3C3489', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                    {detail.name?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{detail.name}</span>
                      {detail.isOnline && <span style={{ fontSize: 11, background: '#E1F5EE', color: '#1D9E75', padding: '2px 8px', borderRadius: 20 }}>접속 중</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{[detail.major, detail.studentId, detail.enrollmentStatus].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>구독 플랜</div>
                    <div style={{ fontWeight: 600, color: detail.planType === 'premium' ? '#3C3489' : '#0F6E56' }}>
                      {detail.planType === 'premium' ? '프리미엄' : '무료'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>포인트 잔액</div>
                    <div style={{ fontWeight: 600 }}>{(detail.pointBalance || 0).toLocaleString()}원</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>계정 상태</div>
                    <div style={{ fontWeight: 600, color: statusColor[detail.accountStatus || 'active'] }}>{statusMap[detail.accountStatus || 'active']}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>오늘 사용량</div>
                    <div style={{ fontWeight: 600 }}>
                      {detail.planType === 'premium' ? '무제한' : `퀴즈 ${quizUsed}/10 · 요약 ${summaryUsed}/5`}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>최근 접속 기록</div>
                <div style={{ marginBottom: 16 }}>
                  {(!detail.loginHistory || detail.loginHistory.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>접속 기록이 없습니다.</div>
                  ) : detail.loginHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: i < detail.loginHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ background: h.action === 'login' ? '#E1F5EE' : '#F1F5F9', color: h.action === 'login' ? '#0F6E56' : '#475569', padding: '1px 8px', borderRadius: 20 }}>
                        {h.action === 'login' ? '로그인' : '로그아웃'}
                      </span>
                      <span style={{ color: 'var(--text2)' }}>{new Date(h.at).toLocaleString('ko-KR')}</span>
                      <span style={{ color: 'var(--text2)' }}>{h.ip || ''}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => handleStatus('dormant')} style={{ height: 38, borderRadius: 10, border: '1px solid #FCD34D', color: '#92400E', background: 'var(--bg3)', cursor: 'pointer' }}>🌙 휴면 처리</button>
                  <button type="button" onClick={() => handleStatus('suspended')} style={{ height: 38, borderRadius: 10, border: '1px solid #FCA5A5', color: '#991B1B', background: 'var(--bg3)', cursor: 'pointer' }}>🚫 계정 정지</button>
                  <button type="button" onClick={() => handleStatus('active')} style={{ height: 38, borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--bg3)', cursor: 'pointer' }}>✅ 정상 복구</button>
                  <button type="button" onClick={handleResetPw} style={{ height: 38, borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--bg3)', cursor: 'pointer' }}>🔑 비밀번호 초기화</button>
                  <button type="button" onClick={handleDelete} style={{ gridColumn: 'span 2', height: 38, borderRadius: 10, border: '1px solid #FCA5A5', color: '#991B1B', background: 'var(--bg3)', cursor: 'pointer' }}>🗑 계정 삭제</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default StaffStudents
