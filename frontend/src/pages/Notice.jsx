import { useCallback, useEffect, useRef, useState } from 'react'

const CATEGORIES = [
  { value: '', label: '전체' },
  { value: 'certification', label: '🏆 자격증' },
  { value: 'academic', label: '📅 학사일정' },
]

// 공지사항(/notice) — /recruit과 동일한 방식으로 페이지네이션(숫자 버튼) 대신
// 무한스크롤로 바꾼 버전. 백엔드(controller/noticeController.js getNoticesApi,
// GET /api/notices)는 이미 { notices, hasMore, totalItems } 형태로 응답하고 있었고
// 컨트롤러 주석에도 "React 프론트엔드(Notice.jsx, 무한스크롤)가 쓰는 JSON 버전"이라고
// 적혀 있었다 — 즉 백엔드는 처음부터 무한스크롤을 염두에 두고 만들어져 있었는데
// 프론트(Notice.jsx)만 예전 방식의 숫자 페이지네이션을 쓰고 있던 상태였다. 이번에
// 프론트를 그 의도에 맞게 무한스크롤로 맞췄다 — 백엔드 변경 없음.
//
// 카테고리 필터(전체/자격증/학사일정)는 원래부터 칩을 누르는 즉시 반영되는 구조라
// (조건 검색 버튼 같은 게 없었음) 실시간 필터는 이미 되어 있었다 — /recruit처럼 새로
// 만들 필요는 없었고, 그대로 유지.
//
// 원본 quirk 보존: 카테고리가 'academic'(학사일정)일 때만 페이지당 50개, 나머지는
// 10개(itemsPerPage = category === 'academic' ? 50 : 10) — getNoticePage(SSR)와
// 동일한 규칙이라 그대로 따랐다.
//
// /recruit과 동일하게, 필터가 바뀌어 목록을 처음부터 다시 불러올 때 스크롤을 상단
// 칩 영역으로 부드럽게 되돌린다(topRef + scrollIntoView) — 무한스크롤 페이지 공통
// 패턴이라 여기도 맞췄다.
function Notice() {
  const [category, setCategory] = useState('')
  const [notices, setNotices] = useState([])
  const [page, setPage] = useState(0) // 지금까지 불러온 마지막 페이지 (0 = 아직 없음)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true) // 처음부터 다시 불러오는 중
  const [loadingMore, setLoadingMore] = useState(false) // 스크롤로 다음 페이지 추가 로딩 중
  const [errorMessage, setErrorMessage] = useState('')

  const itemsPerPage = category === 'academic' ? 50 : 10

  // 필터가 바뀔 때마다 이전 요청의 응답이 늦게 도착해서 새 필터 결과에 섞여 들어가는 걸
  // 막기 위한 토큰 — fetchToken이 바뀐 뒤 도착한 응답은 버린다. (Recruit.jsx와 동일 패턴)
  const fetchToken = useRef(0)
  const topRef = useRef(null)

  const loadPage = useCallback((pageNum, isReset) => {
    const token = ++fetchToken.current
    if (isReset) { setLoading(true); setErrorMessage('') }
    else setLoadingMore(true)

    const params = new URLSearchParams({ page: String(pageNum), limit: String(itemsPerPage) })
    if (category) params.set('category', category)

    fetch(`/api/notices?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '공지사항을 불러오지 못했습니다.')
        if (token !== fetchToken.current) return // 필터가 이미 바뀌어서 무시
        setNotices((prev) => (isReset ? (data.notices || []) : [...prev, ...(data.notices || [])]))
        setHasMore(!!data.hasMore)
        setPage(pageNum)
      })
      .catch((err) => {
        if (token !== fetchToken.current) return
        if (isReset) setErrorMessage(err.message || '공지사항을 불러오지 못했습니다.')
        else console.error('공지사항 추가 로딩 실패:', err)
      })
      .finally(() => {
        if (token !== fetchToken.current) return
        setLoading(false)
        setLoadingMore(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, itemsPerPage])

  // 카테고리가 바뀔 때: notices를 비우고 1페이지부터 다시 쌓는다 + 스크롤을 맨 위로.
  useEffect(() => {
    setNotices([])
    setPage(0)
    setHasMore(false)
    loadPage(1, true)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, itemsPerPage])

  // 스크롤이 하단 감지용 div에 닿으면 다음 페이지를 불러온다(IntersectionObserver).
  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          loadPage(page + 1, false)
        }
      },
      { rootMargin: '400px' }, // 화면 하단에 닿기 전에 미리 불러와서 스크롤이 끊기지 않게
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, loadPage])

  function handleCategoryClick(value) {
    setCategory(value)
  }

  return (
    <>
      <div className="filter-row" style={{ marginBottom: 20, display: 'flex', gap: 15, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }} ref={topRef}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip ${category === c.value ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
            onClick={() => handleCategoryClick(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {errorMessage ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--red, #ef4444)' }}>{errorMessage}</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>불러오는 중...</div>
        ) : notices.length > 0 ? (
          notices.map((item) => (
            <div className="notice-item" data-category={item.categoryName} key={item._id}>
              <div
                className="notice-icon"
                style={{ background: item.iconBgColor, marginRight: 20, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, fontSize: '1.3rem' }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notice-title">{item.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`badge ${item.categoryBadgeClass}`} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 6 }}>
                    {item.categoryName}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    일정: {item.startDate ? new Date(item.startDate).toLocaleDateString() : ''}
                    {item.endDate && item.startDate && new Date(item.startDate).getTime() !== new Date(item.endDate).getTime() && (
                      <> ~ {new Date(item.endDate).toLocaleDateString()}</>
                    )}
                  </span>
                </div>
              </div>
              {item.dDayText && (
                <div style={{ marginLeft: 20 }}>
                  <span className={`badge ${item.dDayBadgeClass}`} style={{ fontWeight: 700, fontSize: '0.9rem', padding: '6px 14px', borderRadius: 10 }}>
                    {item.dDayText}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>표시할 일정이 없습니다.</div>
        )}
      </div>

      {!errorMessage && !loading && notices.length > 0 && (
        <>
          {/* 무한스크롤 감지 지점 — 화면에 들어오면 다음 페이지를 불러온다 */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              불러오는 중...
            </div>
          )}
          {!loadingMore && !hasMore && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              모든 공지사항을 확인했습니다.
            </div>
          )}
        </>
      )}
    </>
  )
}

export default Notice
