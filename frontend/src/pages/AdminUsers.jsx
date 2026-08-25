import { useEffect, useMemo, useState } from 'react'

const STATUS_LABEL = { active: '정상', dormant: '휴면', suspended: '정지' }
const STATUS_STYLE = {
  active: { background: '#F1F5F9', color: '#475569' },
  dormant: { background: '#FEF3C7', color: '#92400E' },
  suspended: { background: '#FEE2E2', color: '#991B1B' },
}
const ACTION_LABEL = { dormant: '휴면 처리', suspended: '계정 정지', active: '정상 복구' }

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
}

function AdminUsers() {
  const [payload, setPayload] = useState(null) // {universities, staffList, studentList, stats}
  const [selectedUniv, setSelectedUniv] = useState(null) // 대학교명 | '__none__' | null(아무것도 선택 안 됨 — 원본과 동일하게 대학교가 하나도 없으면 초기 선택 없음)
  const [filterByUniv, setFilterByUniv] = useState({}) // { [univ]: 'all'|'online'|'suspended'|'dormant' }

  const [modal, setModal] = useState(null) // { id, role, loading, user } | null

  async function loadData() {
    try {
      const res = await fetch('/admin/users/list')
      const data = await res.json()
      if (!data.ok) throw new Error('load failed')
      setPayload(data)
      setSelectedUniv((prev) => (prev !== null ? prev : (data.universities?.length ? data.universities[0] : null)))
    } catch (err) {
      console.error('사용자 관리 목록 로딩 실패:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const universities = payload?.universities || []
  const staffList = payload?.staffList || []
  const studentList = payload?.studentList || []
  const stats = payload?.stats || { univCount: 0, staffCount: 0, studentCount: 0, onlineCount: 0 }
  const noneStudents = useMemo(() => studentList.filter((s) => !s.university), [studentList])

  async function openModal(id, role) {
    setModal({ id, role, loading: true, user: null })
    try {
      const res = await fetch(`/admin/users/${id}`)
      const data = await res.json()
      if (!data.ok) {
        alert('조회 실패')
        setModal(null)
        return
      }
      setModal({ id, role, loading: false, user: data.user })
    } catch {
      alert('서버 오류가 발생했습니다.')
      setModal(null)
    }
  }

  function closeModal() {
    setModal(null)
  }

  async function changeRole(targetRole) {
    if (!modal?.id) return
    const label = targetRole === 'staff' ? '학교관리자로 승격' : '일반사용자로 변경'
    if (!confirm(`${label}하시겠습니까?`)) return
    try {
      const res = await fetch(`/admin/users/${modal.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole }),
      })
      const data = await res.json()
      if (!data.ok) return alert(data.message || '처리 실패')
      alert(`${label} 완료`)
      closeModal()
      loadData()
    } catch {
      alert('서버 오류')
    }
  }

  async function handleStatus(action) {
    if (!modal?.id) return
    if (!confirm(`${ACTION_LABEL[action]}하시겠습니까?`)) return
    try {
      const res = await fetch(`/admin/users/${modal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!data.ok) return alert(data.message || '처리 실패')
      alert(`${ACTION_LABEL[action]} 완료`)
      closeModal()
      loadData()
    } catch {
      alert('서버 오류')
    }
  }

  async function handleResetPw() {
    if (!modal?.id || !confirm('임시 비밀번호로 초기화하시겠습니까?')) return
    try {
      const res = await fetch(`/admin/users/${modal.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) return alert('초기화 실패')
      alert(`임시 비밀번호: ${data.tempPassword}\n\n학생에게 안내 후 변경을 요청하세요.`)
    } catch {
      alert('서버 오류')
    }
  }

  async function handleDelete() {
    if (!modal?.id || !confirm('계정을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/admin/users/${modal.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) return alert(data.message || '삭제 실패')
      alert('계정이 삭제되었습니다.')
      closeModal()
      loadData()
    } catch {
      alert('서버 오류')
    }
  }

  function setFilter(univ, f) {
    setFilterByUniv((prev) => ({ ...prev, [univ]: f }))
  }

  const u = modal?.user

  return (
    <>
      {/* adminUsers.ejs 원본에 있던 페이지 전용 <style> 블록 그대로 — 공용
          design system(public/css/style.css)에는 없는, 이 페이지만 쓰는 클래스들. */}
      <style>{`
        .stab{height:36px;padding:0 16px;font-size:13px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;white-space:nowrap;}
        .stab:hover{background:var(--bg3);}
        .active-stab{background:#EEEDFE;border-color:#AFA9EC;color:#3C3489;font-weight:600;}
        .au-fchip{height:28px;padding:0 12px;font-size:12px;border-radius:20px;border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;}
        .au-fchip:hover{background:var(--bg3);}
        .active-fchip{background:#EEEDFE;border-color:#AFA9EC;color:#3C3489;}
        .au-btn-warn{height:28px;padding:0 10px;font-size:12px;border-radius:6px;border:1px solid #FCD34D;background:transparent;color:#92400E;cursor:pointer;}
        .au-btn-warn:hover{background:#FEF3C7;}
        .au-btn-danger{height:28px;padding:0 10px;font-size:12px;border-radius:6px;border:1px solid #FCA5A5;background:transparent;color:#991B1B;cursor:pointer;}
        .au-btn-danger:hover{background:#FEE2E2;}
        .au-action-btn{height:38px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:13px;cursor:pointer;}
        .au-action-btn:hover{background:var(--bg4, var(--bg3));}
        .au-warn-btn{border-color:#FCD34D;color:#92400E;}
        .au-warn-btn:hover{background:#FEF3C7;}
        .au-danger-btn{border-color:#FCA5A5;color:#991B1B;}
        .au-danger-btn:hover{background:#FEE2E2;}
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>사용자 관리</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)' }}>전체 학교 · 관리자 및 학생 계정 현황</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>등록 학교</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.univCount}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 2 }}>개교</span></div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>학교관리자</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#534AB7' }}>{stats.staffCount}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 2 }}>명</span></div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>전체 학생</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.studentCount}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 2 }}>명</span></div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>현재 접속 중</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1D9E75' }}>{stats.onlineCount}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 2 }}>명</span></div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 20, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          {universities.map((univ) => {
            const uc = studentList.filter((s) => s.university === univ).length
            return (
              <button type="button" key={univ} className={`stab ${selectedUniv === univ ? 'active-stab' : ''}`} onClick={() => setSelectedUniv(univ)}>
                {univ}<span style={{ fontSize: 11, marginLeft: 6, opacity: .65 }}>학생 {uc}명</span>
              </button>
            )
          })}
          {noneStudents.length > 0 && (
            <button type="button" className={`stab ${selectedUniv === '__none__' ? 'active-stab' : ''}`} onClick={() => setSelectedUniv('__none__')}>
              미분류<span style={{ fontSize: 11, marginLeft: 6, opacity: .65, color: '#B45309' }}>⚠</span>
            </button>
          )}
        </div>
      </div>

      {universities.map((univ) => {
        if (selectedUniv !== univ) return null
        const univStaff = staffList.filter((s) => s.university === univ)
        const univStudents = studentList.filter((s) => s.university === univ)
        const onlineCnt = [...univStaff, ...univStudents].filter((x) => x.isOnline).length
        const filter = filterByUniv[univ] || 'all'
        const visibleStudents = filter === 'all' ? univStudents : univStudents.filter((s) => (s.isOnline ? 'online' : (s.accountStatus || 'active')) === filter)

        return (
          <div key={univ}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#3C3489', flexShrink: 0 }}>{univ[0]}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{univ}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>학생 {univStudents.length}명 · 현재 접속 {onlineCnt}명 · 관리자 {univStaff.length}명</div>
              </div>
            </div>

            {univStaff.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>학교관리자</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {univStaff.map((st) => (
                    <div key={st._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.isOnline ? '#1D9E75' : '#94a3b8', flexShrink: 0 }} />
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#3C3489', flexShrink: 0 }}>{st.name[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{st.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{st.email}</div>
                      </div>
                      {st.isOnline ? (
                        <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>접속 중</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>{fmtDate(st.lastLoginAt)}</span>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button type="button" className="au-btn-warn" onClick={() => openModal(st._id, 'staff')}>관리자 해제</button>
                        <button type="button" className="au-btn-danger" onClick={() => openModal(st._id, 'staff')}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.07em', textTransform: 'uppercase' }}>일반사용자</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['all', 'online', 'suspended', 'dormant'].map((f) => (
                    <button type="button" key={f} className={`au-fchip ${filter === f ? 'active-fchip' : ''}`} onClick={() => setFilter(univ, f)}>
                      {f === 'all' ? '전체' : f === 'online' ? '접속 중' : f === 'suspended' ? '정지' : '휴면'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      <th style={{ width: 42, padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>접속</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>이름</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>전공</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>학번</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>상태</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>마지막 접속</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text2)' }}>등록된 학생이 없습니다.</td></tr>
                    ) : visibleStudents.map((s) => {
                      const st = s.accountStatus || 'active'
                      return (
                        <tr key={s._id} className="au-srow" style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openModal(s._id, 'student')}>
                          <td style={{ padding: '10px 12px' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.isOnline ? '#1D9E75' : '#94a3b8' }} /></td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#534AB7' }}>{s.name}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text1)' }}>{s.major || '-'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{s.studentId || '-'}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, ...STATUS_STYLE[st], padding: '2px 8px', borderRadius: 20 }}>{STATUS_LABEL[st]}</span></td>
                          <td style={{ padding: '10px 12px', fontSize: 12 }}>
                            {s.isOnline ? <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 20 }}>접속 중</span> : <span style={{ color: 'var(--text2)' }}>{fmtDate(s.lastLoginAt)}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}

      {selectedUniv === '__none__' && noneStudents.length > 0 && (
        <div>
          <div style={{ padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
            소속 대학교 정보가 없는 계정입니다. 확인 후 삭제하거나 학교관리자로 역할 변경 시 대학교 정보를 먼저 설정해야 합니다.
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ width: 42, padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>접속</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>이름</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>이메일</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {noneStudents.map((s) => (
                  <tr key={s._id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openModal(s._id, 'student')}>
                    <td style={{ padding: '10px 12px' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.isOnline ? '#1D9E75' : '#94a3b8' }} /></td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#534AB7' }}>{s.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{s.email}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 20 }}>미분류</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(23,25,43,.5)', zIndex: 1000, backdropFilter: 'blur(4px)', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10, borderRadius: '20px 20px 0 0' }}>
              {modal.loading || !u ? (
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>불러오는 중...</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#EEEDFE', color: '#3C3489', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.name[0]}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{u.name}</span>
                      {u.role === 'staff' ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489' }}>학교관리자</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>일반사용자</span>
                      )}
                      {u.isOnline && <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 20 }}>접속 중</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{[u.university, u.major, u.studentId, u.enrollmentStatus].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              )}
              <button type="button" onClick={closeModal} style={{ width: 32, height: 32, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 16, color: 'var(--text2)' }}>✕</button>
            </div>

            {!modal.loading && u && (
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>계정 상태</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {(() => {
                        const st = u.accountStatus || 'active'
                        const color = st === 'active' ? '#475569' : st === 'dormant' ? '#92400E' : '#991B1B'
                        return <span style={{ color }}>{STATUS_LABEL[st]}</span>
                      })()}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>재학 상태</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.enrollmentStatus || '-'}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>마지막 접속</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.isOnline ? <span style={{ color: '#1D9E75' }}>접속 중</span> : (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '-')}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>최근 접속 기록</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {(u.loginHistory || []).length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>접속 기록이 없습니다.</div>
                    ) : u.loginHistory.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < u.loginHistory.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: h.action === 'login' ? '#E1F5EE' : '#F1F5F9', color: h.action === 'login' ? '#0F6E56' : '#475569' }}>{h.action === 'login' ? '로그인' : '로그아웃'}</span>
                        <span style={{ flex: 1, color: 'var(--text1)' }}>{new Date(h.at).toLocaleString('ko-KR')}</span>
                        <span style={{ color: 'var(--text2)' }}>{h.ip || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>역할 변경</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {u.role === 'student' && <button type="button" onClick={() => changeRole('staff')} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #AFA9EC', background: '#EEEDFE', color: '#3C3489', fontSize: 13, cursor: 'pointer' }}>학교관리자로 승격</button>}
                    {u.role === 'staff' && <button type="button" onClick={() => changeRole('student')} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text1)', fontSize: 13, cursor: 'pointer' }}>일반사용자로 변경</button>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>계정 관리</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button type="button" onClick={() => handleStatus('dormant')} className="au-action-btn au-warn-btn">🌙 휴면 처리</button>
                    <button type="button" onClick={() => handleStatus('suspended')} className="au-action-btn au-danger-btn">🚫 계정 정지</button>
                    <button type="button" onClick={() => handleStatus('active')} className="au-action-btn">✅ 정상 복구</button>
                    <button type="button" onClick={handleResetPw} className="au-action-btn">🔑 비밀번호 초기화</button>
                    <button type="button" onClick={handleDelete} className="au-action-btn au-danger-btn" style={{ gridColumn: 'span 2' }}>🗑 계정 삭제</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default AdminUsers
