import { useEffect, useState } from 'react'

function StaffSuggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [modalId, setModalId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyMsg, setReplyMsg] = useState(null)
  const [replying, setReplying] = useState(false)

  const loadList = (status) => {
    setLoading(true)
    const params = status ? `?status=${status}` : ''
    fetch(`/staff/suggestions/list${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) return
        setSuggestions(data.suggestions || [])
        setPendingCount(data.pendingCount || 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadList('') }, [])

  const changeFilter = (status) => {
    setStatusFilter(status)
    loadList(status)
  }

  const openModal = async (id) => {
    setModalId(id)
    setDetail(null)
    setReplyText('')
    setReplyMsg(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/staff/suggestions/${id}`)
      const data = await res.json()
      if (!data.ok) { window.alert(data.message || '건의를 불러올 수 없습니다.'); setModalId(null); return }
      setDetail(data.suggestion)
    } catch {
      window.alert('서버와 통신할 수 없습니다.')
      setModalId(null)
    } finally {
      setDetailLoading(false)
    }
  }
  const closeModal = () => { setModalId(null); setDetail(null) }

  const submitReply = async () => {
    const text = replyText.trim()
    if (!text) {
      setReplyMsg({ text: '답변 내용을 입력해주세요.', isError: true })
      return
    }
    setReplying(true)
    try {
      const res = await fetch(`/staff/suggestions/${modalId}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: text }),
      })
      const data = await res.json()
      if (data.ok) {
        setReplyMsg({ text: '답변이 등록되었습니다.', isError: false })
        setDetail(data.suggestion)
        loadList(statusFilter)
      } else {
        setReplyMsg({ text: data.message || '등록에 실패했습니다.', isError: true })
      }
    } catch {
      setReplyMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setReplying(false)
    }
  }

  const msgBoxStyle = (isError) => ({
    display: 'block', fontSize: 12, borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginTop: 8,
    background: isError ? 'var(--bg3)' : 'var(--green-bg)',
    border: `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`,
    color: isError ? 'var(--text)' : 'var(--green)',
  })

  const chips = [
    { key: '', label: '전체' },
    { key: 'pending', label: `처리중 (${pendingCount})` },
    { key: 'completed', label: '처리완료' },
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <button
            key={c.key} type="button" onClick={() => changeFilter(c.key)}
            style={{
              height: 32, padding: '0 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
              border: statusFilter === c.key ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: statusFilter === c.key ? 'var(--accent-bg)' : 'var(--bg2)',
              color: statusFilter === c.key ? 'var(--accent)' : 'var(--text2)',
            }}
          >{c.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📬 학생 건의 목록</span>
          <span>{suggestions.length}건</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
        ) : suggestions.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text2)', fontSize: 13 }}>표시할 건의가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((item) => (
              <div
                key={item._id} onClick={() => openModal(item._id)}
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 20,
                    background: item.status === 'completed' ? 'var(--green-bg)' : '#FEF3C7',
                    color: item.status === 'completed' ? 'var(--green)' : '#92400E',
                  }}>{item.statusName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>{item.categoryName}</span>
                  <span>{item.authorName}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
                  {item.hasImages && <span>📷</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,43,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div style={{ background: 'var(--bg2)', borderRadius: 16, width: 620, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            {detailLoading || !detail ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>불러오는 중...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>{detail.title}</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  <span className="badge badge-blue">{detail.categoryName}</span>
                  <span>{detail.authorName}</span>
                  <span>{detail.statusName}</span>
                  <span>{new Date(detail.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>

                {detail.hasImages && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginBottom: 12 }}>
                    {detail.imageUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="첨부 사진" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                      </a>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 20 }}>{detail.content}</div>

                {detail.status === 'completed' && detail.staffReply ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>등록된 답변</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: 12 }}>{detail.staffReply}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
                      {detail.repliedByName || '대학관계자'} · {detail.repliedAt ? new Date(detail.repliedAt).toLocaleString('ko-KR') : ''}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>답변 작성</label>
                    <textarea
                      rows="5" className="input-field" placeholder="학생에게 전달할 답변을 입력해주세요."
                      value={replyText} onChange={(e) => setReplyText(e.target.value)}
                      style={{ width: '100%', resize: 'vertical', marginTop: 6 }}
                    />
                    <button type="button" className="btn btn-accent" style={{ marginTop: 8 }} disabled={replying} onClick={submitReply}>
                      {replying ? '등록 중...' : '답변 등록 · 처리완료'}
                    </button>
                    {replyMsg && <div style={msgBoxStyle(replyMsg.isError)}>{replyMsg.text}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default StaffSuggestions
