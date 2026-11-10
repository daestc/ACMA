// views/pages/staffSchedule.ejs + public/js/staffSchedule.js를 옮긴 React 버전.
// 원본 GET /staff/schedules는 SSR 전용이라 controllers/staffController.js에
// getScheduleData(GET /staff/schedules/list)를 새로 추가했다 — 쿼리(staffService.
// getSchedules, 페이지당 5건 고정)는 원본과 동일, 응답만 JSON.
//
// 등록은 POST '/staff/schedules/create'(새 별칭 경로, LectureAdmin.jsx와 동일한 이유)로
// 보낸다. 원본처럼 등록/삭제 후 location.href로 페이지 이동하는 대신 목록만 다시 불러온다.
//
// 날짜 표시: 원본 EJS도 서버가 dateLabel 문자열을 내려주는 게 아니라
// new Date(s.startDate).toLocaleDateString('ko-KR')를 원본 그대로 클라이언트에서
// 그대로 재현한다(옵션 없이 호출 — "2026. 8. 24." 형식, staffHome.jsx의 대시보드가 쓰는
// formatScheduleRange의 "2026년 8월 24일" 장문 형식과는 다른 포맷임을 원본 그대로 보존).
//
// 목록은 숫자 페이지네이션 대신 /recruit·/notice·LectureAdmin.jsx와 동일한 무한스크롤로
// 바꿨다. 서버(getScheduleData)는 그대로 페이지당 5건씩 주는 API라 백엔드는 안 건드리고,
// 스크롤할 때마다 다음 페이지를 이어붙인다. 삭제도 LectureAdmin.jsx와 같은 이유로
// "그 페이지만 다시 불러오기" 대신 로컬 목록에서 바로 제거하는 방식으로 바꿨다.
import { useEffect, useRef, useState } from 'react'

// 일정 종류(UniversitySchedule.type) — 서버 허용 값은 모델 enum이고, 표시 이름은 여기 한 곳에만 둔다.
// 중간·기말고사는 주간 계획의 시험 기간 판단에, 방학·개강·수강신청은 학사 단계 판단에 쓰인다.
const SCHEDULE_TYPES = [
  { value: 'semester_start', label: '개강', placeholder: '예: 2026-2학기 개강' },
  { value: 'midterm', label: '중간고사', placeholder: '예: 2026-2학기 중간고사' },
  { value: 'final', label: '기말고사', placeholder: '예: 2026-2학기 기말고사' },
  { value: 'vacation', label: '방학', placeholder: '예: 2026 겨울방학' },
  { value: 'registration', label: '수강신청', placeholder: '예: 2026-1학기 수강신청' },
  { value: 'holiday', label: '휴일', placeholder: '예: 개교기념일' },
  { value: 'orientation', label: '오리엔테이션', placeholder: '예: 신입생 오리엔테이션' },
  { value: 'other', label: '기타', placeholder: '예: 2026-1학기 수강신청' },
]
const TYPE_BY_VALUE = Object.fromEntries(SCHEDULE_TYPES.map((t) => [t.value, t]))
const EXAM_TYPES = ['midterm', 'final']
// 기간이 의미 있는 종류 — 종료일이 없으면 시작일 하루만 그 기간으로 인식된다
const PERIOD_TYPES = ['semester_start', 'midterm', 'final', 'vacation', 'registration']
// 종류를 고르기 전에 등록된 일정('기타')인데 제목이 시험처럼 보이면 관계자가 알아보게 표시한다
const LOOKS_LIKE_EXAM = /중간고사|기말고사|시험/

function TypeBadge({ schedule }) {
  const type = TYPE_BY_VALUE[schedule.type] ? schedule.type : 'other'
  const needsCheck = type === 'other' && LOOKS_LIKE_EXAM.test(schedule.title || '')
  return (
    <>
      <span className={`badge ${EXAM_TYPES.includes(type) ? 'badge-red' : 'badge-gray'}`} style={{ marginRight: 6 }}>{TYPE_BY_VALUE[type].label}</span>
      {needsCheck && <span style={{ fontSize: 11, color: 'var(--text2)', marginRight: 6 }}>종류 확인 필요</span>}
    </>
  )
}

function StaffSchedule() {
  const [type, setType] = useState('other')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState(null) // { text, isError }
  const [submitting, setSubmitting] = useState(false)

  const [schedules, setSchedules] = useState([])
  const [totalSchedules, setTotalSchedules] = useState(0)
  const [page, setPage] = useState(0) // 지금까지 불러온 마지막 페이지 (0 = 아직 없음)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true) // 처음부터 다시 불러오는 중
  const [loadingMore, setLoadingMore] = useState(false) // 스크롤로 다음 페이지 추가 로딩 중
  const fetchToken = useRef(0)

  const loadList = (p, isReset = true) => {
    const token = ++fetchToken.current
    if (isReset) setLoading(true)
    else setLoadingMore(true)
    fetch(`/staff/schedules/list?page=${p}`)
      .then((res) => res.json())
      .then((data) => {
        if (token !== fetchToken.current) return
        if (!data.ok) return
        setSchedules((prev) => (isReset ? (data.schedules || []) : [...prev, ...(data.schedules || [])]))
        setTotalSchedules(data.totalSchedules || 0)
        setPage(data.currentPageNum || p)
        setTotalPages(data.totalPages || 0)
      })
      .finally(() => {
        if (token !== fetchToken.current) return
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(() => { loadList(1, true) }, [])

  // 스크롤이 하단 감지용 div에 닿으면 다음 페이지를 이어서 불러온다.
  const sentinelRef = useRef(null)
  const hasMore = page > 0 && page < totalPages
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          loadList(page + 1, false)
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page])

  const submitSchedule = async () => {
    const t = title.trim()
    const d = description.trim()
    if (!t || !startDate) {
      setMsg({ text: '제목과 시작일을 입력해주세요.', isError: true })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/staff/schedules/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: t, startDate, endDate, description: d }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg({ text: '일정이 등록되었습니다.', isError: false })
        setType('other'); setTitle(''); setStartDate(''); setEndDate(''); setDescription('')
        loadList(1, true)
      } else {
        setMsg({ text: data.message || '등록에 실패했습니다.', isError: true })
      }
    } catch {
      setMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setSubmitting(false)
    }
  }

  const deleteSchedule = async (id) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/staff/schedules/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setSchedules((prev) => prev.filter((s) => s._id !== id))
        setTotalSchedules((prev) => Math.max(0, prev - 1))
      } else {
        window.alert(data.message || '삭제에 실패했습니다.')
      }
    } catch {
      window.alert('서버와 통신할 수 없습니다.')
    }
  }

  const msgBoxStyle = (isError) => ({
    display: 'block',
    fontSize: 12,
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    background: isError ? 'var(--bg3)' : 'var(--green-bg)',
    border: `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`,
    color: isError ? 'var(--text)' : 'var(--green)',
  })

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label>일정 종류</label>
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%' }}>
              {SCHEDULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label>제목</label>
            <input className="input-field" placeholder={TYPE_BY_VALUE[type].placeholder} value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label>시작일</label>
              <input className="input-field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>종료일 (선택)</label>
              <input className="input-field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          {PERIOD_TYPES.includes(type) && !endDate && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: -4 }}>종료일이 없으면 시작일 하루만 기간으로 인식됩니다.</div>
          )}
          <div>
            <label>설명 (선택)</label>
            <textarea className="input-field" rows="3" placeholder="일정 안내 내용" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <button type="button" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting} onClick={submitSchedule}>
            {submitting ? '등록 중...' : '일정 등록'}
          </button>
          {msg && <div style={msgBoxStyle(msg.isError)}>{msg.text}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">등록된 학교 일정</span>
          <span>총 {totalSchedules}건</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
        ) : schedules.length === 0 ? (
          <p>등록된 일정이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {schedules.map((s) => (
              <div key={s._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}><TypeBadge schedule={s} />{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      {new Date(s.startDate).toLocaleDateString('ko-KR')}
                      {s.endDate && <> ~ {new Date(s.endDate).toLocaleDateString('ko-KR')}</>}
                    </div>
                    {s.description && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>{s.description}</div>
                    )}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteSchedule(s._id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && schedules.length > 0 && (
          <>
            {/* 무한스크롤 감지 지점 — 화면에 들어오면 다음 페이지를 불러온다 */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
            )}
            {!loadingMore && !hasMore && (
              <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text2)', fontSize: 13 }}>모든 일정을 확인했습니다.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StaffSchedule
