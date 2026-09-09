import { useEffect, useState } from 'react'

function AdminStaff() {
  const [pendingStaff, setPendingStaff] = useState(null)
  const [processedStaff, setProcessedStaff] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function loadData() {
    try {
      const res = await fetch('/admin/staff/list')
      const data = await res.json()
      if (!data.ok) throw new Error('load failed')
      setPendingStaff(data.pendingStaff || [])
      setProcessedStaff(data.processedStaff || [])
    } catch (err) {
      console.error('가입 승인 목록 로딩 실패:', err)
      setPendingStaff([])
      setProcessedStaff([])
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function processStaff(id, action) {
    const label = action === 'approve' ? '승인' : '거절'
    if (!confirm(`이 가입 신청을 ${label}하시겠습니까?`)) return
    setBusyId(id)
    try {
      const res = await fetch(`/admin/staff/${id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        loadData()
      } else {
        alert(data.message || '처리에 실패했습니다.')
      }
    } catch {
      alert('서버와 통신할 수 없습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">🏫 대학관계자 가입 신청</span>
          <span className="badge badge-amber">{pendingStaff?.length ?? 0}건 대기</span>
        </div>

        {pendingStaff === null ? (
          <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>불러오는 중...</p>
        ) : pendingStaff.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>대기 중인 가입 신청이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid var(--border)', color: 'var(--text2)' }}>이름</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid var(--border)', color: 'var(--text2)' }}>이메일</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid var(--border)', color: 'var(--text2)' }}>대학교</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid var(--border)', color: 'var(--text2)' }}>신청일</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text2)' }}>증빙</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text2)' }}>처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingStaff.map((s) => (
                  <tr key={s._id}>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)', color: 'var(--text2)' }}>{s.email}</td>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)' }}>{s.university || '-'}</td>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)', color: 'var(--text2)' }}>{new Date(s.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                      {s.verificationImage ? (
                        <a href={`/admin/staff/${s._id}/verification`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📷 보기</a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>없음</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', border: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-accent btn-sm" disabled={busyId === s._id} onClick={() => processStaff(s._id, 'approve')}>✓ 승인</button>
                      {' '}
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === s._id} onClick={() => processStaff(s._id, 'reject')}>✕ 거절</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">처리 내역</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>최근 30건</span>
        </div>

        {processedStaff === null ? (
          <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>불러오는 중...</p>
        ) : processedStaff.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>처리된 내역이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {processedStaff.map((s) => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontWeight: 600, minWidth: 70 }}>{s.name}</span>
                <span style={{ color: 'var(--text2)', flex: 1 }}>{s.email} · {s.university || '-'}</span>
                {s.staffStatus === 'approved' ? (
                  <span className="badge badge-green">승인됨</span>
                ) : (
                  <span className="badge badge-amber">거절됨</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default AdminStaff
