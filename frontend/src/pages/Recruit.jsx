import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

function getCategoryBadge(cat) {
  if (!cat) return '기타'
  return cat.split('·')[0]
}

// 채용정보(/recruit) — 페이지네이션 대신 무한스크롤로 바꾼 버전 + 지역/카테고리 필터를
// "조건 검색" 버튼 대신 체크박스를 누르는 즉시 반영되게 바꾼 버전.
// 백엔드(controllers/recruitController.js getRecruitList, GET /recruit/list)는 이미
// page/limit=12로 페이지네이션되어 있어서 서버는 그대로 두고, 클라이언트에서 1페이지부터
// 순서대로 계속 불러와 jobs 배열에 이어붙이는 방식으로만 바꿨다. URL에서는 이제 page를
// 쓰지 않는다(스크롤 위치는 새로고침 시 다시 처음부터 쌓이는 게 자연스러운 무한스크롤
// 동작이라 원래 페이지네이션의 "URL로 특정 페이지 공유" 기능은 의도적으로 없앴다).
//
// 필터: 원래는 체크박스를 눌러도 draftRegions/draftCategories라는 임시 상태에만 쌓이고
// "조건 검색" 버튼을 눌러야 실제 검색(URL) 상태에 반영되는 2단계 구조였다. 이제는 그
// draft 단계를 없애고 체크박스가 selectedRegions/selectedCategories(=URL)를 바로 바꾼다
// — filterKey(=searchParams 문자열)가 바뀌면 useEffect가 그 즉시 1페이지부터 다시
// 불러온다. 체크박스는 사람이 하나씩 클릭하는 이산적인 동작이라(자유 텍스트 타이핑처럼
// 타자마다 요청이 쏟아지는 상황이 아님) 디바운스는 넣지 않았다.
function Recruit() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const currentStatus = searchParams.get('status') || 'open'
  const selectedRegions = searchParams.getAll('region').filter((r) => r && r !== 'all')
  const selectedCategories = searchParams.getAll('category')
  const filterKey = searchParams.toString() // status/region/category만 들어있음(page는 URL에 없음)

  const [jobs, setJobs] = useState([])
  const [page, setPage] = useState(0) // 지금까지 불러온 마지막 페이지 (0 = 아직 없음)
  const [totalPages, setTotalPages] = useState(0)
  const [categories, setCategories] = useState([])
  const [aiMissingInfo, setAiMissingInfo] = useState(false)
  const [loading, setLoading] = useState(true) // 필터 변경 등으로 처음부터 다시 불러오는 중
  const [loadingMore, setLoadingMore] = useState(false) // 스크롤로 다음 페이지 추가 로딩 중
  const [aiLoadingOverlay, setAiLoadingOverlay] = useState(false)

  // 필터가 바뀔 때마다 이전 요청의 응답이 늦게 도착해서 새 필터 결과에 섞여 들어가는 걸
  // 막기 위한 토큰 — fetchToken이 바뀐 뒤 도착한 응답은 버린다.
  const fetchToken = useRef(0)

  // 필터/탭이 바뀌어 목록을 처음부터 다시 불러올 때, 무한스크롤로 아래로 내려가 있던
  // 스크롤 위치를 자연스럽게 맨 위로 되돌리기 위한 참조. main-content(sidebar/topbar를
  // 감싸는 실제 스크롤 컨테이너, .main-content{overflow-y:auto})가 window가 아니라서
  // window.scrollTo는 안 먹는다 — scrollIntoView는 실제 스크롤 가능한 조상을 알아서
  // 찾아 스크롤해주므로 이 방식을 쓴다(Study.jsx의 기존 scrollIntoView 패턴과 동일).
  const topRef = useRef(null)

  const loadPage = useCallback((pageNum, isReset) => {
    const token = ++fetchToken.current
    if (isReset) setLoading(true)
    else setLoadingMore(true)

    const params = new URLSearchParams()
    params.set('status', currentStatus)
    params.set('page', String(pageNum))
    selectedRegions.forEach((r) => params.append('region', r))
    selectedCategories.forEach((c) => params.append('category', c))

    fetch(`/recruit/list?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (token !== fetchToken.current) return // 필터가 이미 바뀌어서 무시
        setCategories(json.categories || [])
        setAiMissingInfo(json.aiMissingInfo || false)
        setTotalPages(json.totalPages || 0)
        setJobs((prev) => (isReset ? (json.jobs || []) : [...prev, ...(json.jobs || [])]))
        setPage(json.page || pageNum)
        setAiLoadingOverlay(false)
      })
      .catch((err) => {
        console.error('채용공고 목록 로딩 실패:', err)
        setAiLoadingOverlay(false)
      })
      .finally(() => {
        if (token !== fetchToken.current) return
        setLoading(false)
        setLoadingMore(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus, selectedRegions.join(','), selectedCategories.join(',')])

  // 필터(탭/지역/카테고리)가 바뀔 때: jobs를 비우고 1페이지부터 다시 쌓는다 + 무한스크롤로
  // 내려가 있던 화면을 목록 맨 위로 부드럽게 스크롤한다.
  useEffect(() => {
    setJobs([])
    setPage(0)
    setTotalPages(0)
    loadPage(1, true)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  // 스크롤이 하단 감지용 div에 닿으면 다음 페이지를 불러온다(IntersectionObserver).
  const sentinelRef = useRef(null)
  const hasMore = page > 0 && page < totalPages
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

  function goToStatus(status) {
    if (status === 'ai') setAiLoadingOverlay(true)
    setSearchParams({ status })
  }

  // 지역/카테고리 체크박스를 누르는 즉시 검색이 반영된다(원래는 "조건 검색" 버튼을
  // 눌러야 적용되는 임시 draft 상태를 거쳤는데, 그 draft 단계를 없애고 체크박스가 바로
  // URL(searchParams)을 바꾸도록 했다 — filterKey가 바뀌면 아래 useEffect가 자동으로
  // 목록을 다시 불러온다).
  function applyFilters(nextRegions, nextCategories) {
    const params = new URLSearchParams()
    params.set('status', currentStatus)
    nextRegions.forEach((r) => params.append('region', r))
    nextCategories.forEach((c) => params.append('category', c))
    setSearchParams(params)
  }

  function toggleRegion(region) {
    const next = selectedRegions.includes(region)
      ? selectedRegions.filter((r) => r !== region)
      : [...selectedRegions, region]
    applyFilters(next, selectedCategories)
  }

  function toggleCategory(cat) {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat]
    applyFilters(selectedRegions, next)
  }

  function removeRegion(region) {
    toggleRegion(region) // 이미 선택된 지역이므로 토글하면 제거됨
  }

  async function toggleScrap(e, job) {
    e.stopPropagation()
    try {
      const res = await fetch(`/recruit/${job._id}/scrap`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const result = await res.json()
      if (result.success) {
        if (currentStatus === 'scrap' && !result.isScrapped) {
          setJobs((prev) => prev.filter((j) => j._id !== job._id))
        } else {
          setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isScrapped: result.isScrapped } : j)))
        }
      } else {
        alert(result.message || '로그인이 필요합니다.')
      }
    } catch (err) {
      console.error('스크랩 요청 에러:', err)
      alert('서버와 통신할 수 없습니다.')
    }
  }

  return (
    <>
      <div className="tabs recruit-status-tabs" ref={topRef}>
        <button type="button" className={`tab-btn ${currentStatus === 'open' ? 'active' : ''}`} onClick={() => goToStatus('open')}>모집중</button>
        <button type="button" className={`tab-btn ${currentStatus === 'closed' ? 'active' : ''}`} onClick={() => goToStatus('closed')}>모집 마감</button>
        <button type="button" className={`tab-btn ${currentStatus === 'scrap' ? 'active' : ''}`} onClick={() => goToStatus('scrap')}>스크랩</button>
        <button
          type="button"
          className={`tab-btn ${currentStatus === 'ai' ? 'active' : ''}`}
          style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
          onClick={() => goToStatus('ai')}
        >
          🚀 AI 추천 공고
        </button>
      </div>

      <div className="recruit-region-select" style={{ marginBottom: 16 }}>
        <label className="recruit-region-select-label">지역 검색</label>

        <div className="selected-tags-container" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {selectedRegions.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--text2)', padding: '4px 0' }}>전체 지역 (선택된 지역 없음)</span>
          ) : selectedRegions.map((reg) => (
            <span key={reg} className="filter-tag-badge" style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent, #4f46e5)', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
              {reg}
              <button type="button" onClick={() => removeRegion(reg)} style={{ background: 'none', border: 'none', marginLeft: 6, cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}>×</button>
            </span>
          ))}
        </div>

        <div className="recruit-category-box open" style={{ marginTop: 8 }}>
          <div className="recruit-category-wrap">
            {REGIONS.map((reg) => (
              <label className="category-toggle-btn" key={reg}>
                <input type="checkbox" checked={selectedRegions.includes(reg)} onChange={() => toggleRegion(reg)} />
                <span className="category-label-text">{reg}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="recruit-category-box open">
        <div className="recruit-category-wrap">
          {categories.map((cat) => (
            <label className="category-toggle-btn" key={cat}>
              <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
              <span className="category-label-text">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="recruit-list-head">
        <h3>이 공고, 놓치지 마세요!</h3>
      </div>

      {loading ? (
        <div className="career-empty-state">채용 공고를 불러오는 중입니다...</div>
      ) : jobs.length > 0 ? (
        <>
          <div className="recruit-card-grid">
            {jobs.map((job) => (
              <div className="recruit-card" key={job._id} onClick={() => window.open(job.url, '_blank')}>
                <div className="recruit-job-title">{job.title}</div>
                <div className="recruit-company-name">{job.company}</div>

                <div className="recruit-job-meta">
                  <span className="loc-icon">📍</span>
                  <span>{job.region || '지역 무관'}</span><span className="dot">·</span>
                  <span>{job.experience || '경력 무관'}</span><span className="dot">·</span>
                  <span>{job.education || '학력 무관'}</span>
                </div>

                <div className="recruit-card-bottom">
                  <span className="recruit-category-label">{getCategoryBadge(job.saraminCategory)}</span>

                  <div className="recruit-bottom-right">
                    <span className="recruit-dday">{job.deadlineText || '상시채용'}</span>
                    <button
                      type="button"
                      className={`recruit-scrap-btn ${job.isScrapped ? 'active' : ''}`}
                      aria-label="스크랩"
                      onClick={(e) => toggleScrap(e, job)}
                    >⭐</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 무한스크롤 감지 지점 — 화면에 들어오면 다음 페이지를 불러온다 */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text2)', fontSize: 13 }}>
              불러오는 중...
            </div>
          )}
          {!loadingMore && !hasMore && page > 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text2)', fontSize: 13 }}>
              모든 공고를 확인했습니다.
            </div>
          )}
        </>
      ) : (
        <div className="recruit-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, padding: '40px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 10 }}>
          {currentStatus === 'closed' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>아직 모집 마감된 공고가 없어요!</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>마감된 공고가 생기면 이곳에서 확인할 수 있습니다.</p>
            </>
          )}
          {currentStatus === 'scrap' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⭐</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>아직 스크랩 한 공고가 없어요!</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>지금 공고 보러 갈까요?</p>
              <button type="button" onClick={() => goToStatus('open')} style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                공고 보러가기 🚀
              </button>
            </>
          )}
          {currentStatus === 'ai' && aiMissingInfo && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>설정한 직무와 자격증 정보가 없습니다.</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>지금 설정하러 갈까요?</p>
              <button type="button" onClick={() => navigate('/career')} style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                직무/자격증 설정하러 가기 🚀
              </button>
            </>
          )}
          {currentStatus === 'ai' && !aiMissingInfo && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>조건에 맞는 추천 공고를 찾지 못했습니다.</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>관심 직무나 자격증을 추가해 보시면 어떨까요?</p>
            </>
          )}
          {currentStatus === 'open' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>해당 조건에 맞는 채용 공고가 없습니다.</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>다른 카테고리나 조건을 선택해 보세요!</p>
            </>
          )}
        </div>
      )}

      {aiLoadingOverlay && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,.85)', zIndex: 9999, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ fontSize: 50, marginBottom: 20 }}>🤖</div>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 10 }}>맞춤 공고 찾는 중입니다...</h3>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>AI가 스펙을 분석하고 있어요. (최대 10~15초 소요)</p>
        </div>
      )}
    </>
  )
}

export default Recruit
