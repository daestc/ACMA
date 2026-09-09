import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPostForm } from '../api'

const MAX_IMAGES = 3

const PAGE_STYLE = `
.suggestion-row {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  cursor: pointer;
  transition: background .15s;
}
.suggestion-row:hover { background: var(--bg2); }
.status-pending { background: var(--amber-bg); color: var(--amber); }
.status-completed { background: var(--green-bg); color: var(--green); }
.suggestion-modal-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 3000;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.suggestion-modal-backdrop.open { display: flex; }
.suggestion-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow: auto;
  padding: 24px;
}
.sg-image-preview-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.sg-image-preview {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.sg-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}
.sg-image-grid img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
  cursor: pointer;
}
`

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('ko-KR')
}

function Suggestions() {
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [suggestions, setSuggestions] = useState([])
  const [categories, setCategories] = useState({})
  const [hasUniversity, setHasUniversity] = useState(true)

  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null) // { text, isError }
  const fileInputRef = useRef(null)

  const [detail, setDetail] = useState(null) // 선택된 건의 상세 (모달)

  async function loadList() {
    try {
      const data = await apiGet('/api/suggestions')
      setSuggestions(data.suggestions || [])
      setCategories(data.categories || {})
      setHasUniversity(data.hasUniversity !== false)
      if (!category && data.categories) {
        setCategory(Object.keys(data.categories)[0] || '')
      }
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [previewUrls])

  function handleImagesChange(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_IMAGES)
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImages(files)
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)))
  }

  function resetForm() {
    setTitle('')
    setContent('')
    setImages([])
    setPreviewUrls((urls) => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      return []
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setMsg({ text: '제목과 내용을 입력해주세요.', isError: true })
      return
    }
    if (images.length > MAX_IMAGES) {
      setMsg({ text: `사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`, isError: true })
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('title', title.trim())
      formData.append('content', content.trim())
      images.forEach((file) => formData.append('images', file))

      const data = await apiPostForm('/api/suggestions', formData)

      if (data.ok) {
        setMsg({ text: '건의가 등록되었습니다.', isError: false })
        resetForm()
        await loadList()
      } else {
        setMsg({ text: data.message || '등록에 실패했습니다.', isError: true })
      }
    } catch (err) {
      setMsg({ text: err.message || '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setSubmitting(false)
    }
  }

  async function openSuggestion(id) {
    try {
      const data = await apiGet(`/api/suggestions/${id}`)
      if (!data.ok) {
        alert(data.message || '건의를 불러올 수 없습니다.')
        return
      }
      setDetail(data.suggestion)
    } catch (err) {
      alert(err.message || '서버와 통신할 수 없습니다.')
    }
  }

  if (loadState === 'loading') {
    return <p style={{ padding: 24, color: 'var(--text2)' }}>불러오는 중...</p>
  }
  if (loadState === 'error') {
    return <p style={{ padding: 24, color: 'var(--text2)' }}>건의 게시판을 불러오지 못했습니다.</p>
  }

  return (
    <>
      <style>{PAGE_STYLE}</style>

      {!hasUniversity ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
          소속 대학 정보가 없어 건의를 등록할 수 없습니다. 마이페이지에서 대학 정보를 등록해주세요.
        </div>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">✏️ 건의 작성</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>카테고리</label>
                <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>제목</label>
                <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="건의 제목" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>내용</label>
                <textarea className="input-field" value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="건의 내용을 입력해주세요." style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>사진 첨부 (선택, 최대 3장)</label>
                <input
                  ref={fileInputRef}
                  className="input-field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImagesChange}
                  style={{ width: '100%' }}
                />
                <div className="sg-image-preview-wrap">
                  {previewUrls.map((url, i) => (
                    <img key={url} className="sg-image-preview" src={url} alt={images[i]?.name || ''} />
                  ))}
                </div>
              </div>
              <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '등록 중...' : '등록하기'}
              </button>
              {msg && (
                <div
                  style={{
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    background: msg.isError ? 'var(--bg3)' : 'var(--green-bg)',
                    border: `1px solid ${msg.isError ? 'var(--border2)' : 'var(--green)'}`,
                    color: msg.isError ? 'var(--text)' : 'var(--green)',
                  }}
                >
                  {msg.text}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 내 건의 목록</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>총 {suggestions.length}건</span>
            </div>

            {suggestions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text2)', padding: '18px 0', textAlign: 'center' }}>등록한 건의가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((item) => (
                  <div key={item._id} className="suggestion-row" onClick={() => openSuggestion(item._id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                          <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 8px' }}>{item.categoryName}</span>
                          <span style={{ marginLeft: 6 }}>{formatDate(item.createdAt)}</span>
                          {item.hasImages && <span style={{ marginLeft: 6 }}>📷</span>}
                        </div>
                      </div>
                      <span
                        className={`badge ${item.status === 'completed' ? 'status-completed' : 'status-pending'}`}
                        style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                      >
                        {item.statusName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detail && (
        <div className="suggestion-modal-backdrop open" onClick={() => setDetail(null)}>
          <div className="suggestion-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detail.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              <span className="badge badge-blue">{detail.categoryName}</span>
              <span style={{ marginLeft: 8 }}>{detail.statusName}</span>
              <span style={{ marginLeft: 8 }}>{formatDate(detail.createdAt)}</span>
            </div>

            {detail.imageUrls?.length > 0 && (
              <div className="sg-image-grid">
                {detail.imageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="첨부 사진" />
                  </a>
                ))}
              </div>
            )}

            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{detail.content}</div>

            {detail.status === 'completed' && detail.staffReply && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>대학 답변</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg2)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                  {detail.staffReply}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
                  {(detail.repliedByName || '대학관계자')} · {formatDate(detail.repliedAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Suggestions
