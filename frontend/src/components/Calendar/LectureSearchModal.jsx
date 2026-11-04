import { useEffect, useState } from 'react'
import { getTimeOptions } from './calendarUtils'

const TIME_OPTIONS = getTimeOptions()
const CLASSIFICATION_OPTIONS = ['전필', '전선', '교필', '교선']
const CREDITS_OPTIONS = ['1', '2', '3']
const DEFAULT_LECTURE_COLOR = '#60A5FA'

const emptyPage = () => ({ items: [], page: 1, totalPages: 0, total: 0, loading: false })

// 학기 선택: 값은 "2026|2학기" 형식. 시간표에 넣을 수 있는 정규 학기는 1·2학기뿐이다(계절학기는 표시만).
const REGULAR_SEMESTERS = ['1학기', '2학기']
const termKey = (t) => (t ? `${t.year}|${t.semester}` : '')
const parseTermKey = (key) => {
  if (!key) return null
  const [year, semester] = key.split('|')
  return { year: Number(year), semester }
}

// 오늘(한국 시간)이 속한 학기: 3~6월 1학기, 9~12월 2학기. 그 밖의 달은 없음.
function currentTerm() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const year = Number(parts.find((p) => p.type === 'year').value)
  const month = Number(parts.find((p) => p.type === 'month').value)
  if (month >= 3 && month <= 6) return { year, semester: '1학기' }
  if (month >= 9) return { year, semester: '2학기' }
  return null
}

// 기본 선택: 오늘이 속한 학기가 목록에 있으면 그 학기, 없으면 목록의 첫 항목(가장 최근). 목록이 비면 학기 필터 없음.
function defaultTermKey(semesters) {
  if (!semesters.length) return ''
  const now = termKey(currentTerm())
  return semesters.some((s) => termKey(s) === now) ? now : termKey(semesters[0])
}

function Pagination({ state, onPage }) {
  if (state.total === 0) return null
  if (state.totalPages <= 1) {
    return <span className="page-info">총 {state.total}개</span>
  }
  return (
    <>
      <button type="button" className="btn btn-sm" disabled={state.page <= 1} onClick={() => onPage(state.page - 1)}>이전</button>
      <span className="page-info">{state.page} / {state.totalPages}</span>
      <button type="button" className="btn btn-sm" disabled={state.page >= state.totalPages} onClick={() => onPage(state.page + 1)}>다음</button>
    </>
  )
}

function LectureSearchModal({ open, university, onClose, onAdded }) {
  const hasUniversity = !!(university && university.trim())

  const [keyword, setKeyword] = useState('')
  const [classification, setClassification] = useState('')
  const [credits, setCredits] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [semesters, setSemesters] = useState([]) // [{ year, semester }] 최신순
  const [term, setTerm] = useState('')

  const [lectures, setLectures] = useState(emptyPage)
  const [universities, setUniversities] = useState(emptyPage)

  useEffect(() => {
    if (!open) return
    if (hasUniversity) {
      setKeyword('')
      loadSemestersThenLectures()
    } else {
      loadUniversities(1)
    }

  }, [open, hasUniversity])

  if (!open) return null

  async function loadSemestersThenLectures() {
    let list = []
    try {
      const res = await fetch('/calendar/lectures/semesters')
      if (res.ok) list = (await res.json()).semesters || []
    } catch {
      list = []
    }
    const key = defaultTermKey(list)
    setSemesters(list)
    setTerm(key)
    loadLectures(1, '', key)
  }

  function handleTermChange(key) {
    setTerm(key)
    loadLectures(1, undefined, key) // 학기를 바꾸면 1페이지부터
  }

  async function loadLectures(page, keywordOverride, termOverride) {
    setLectures((l) => ({ ...l, loading: true }))

    const params = new URLSearchParams({ page, limit: 10 })
    const selectedTerm = parseTermKey(termOverride !== undefined ? termOverride : term)
    if (selectedTerm) {
      params.append('year', selectedTerm.year)
      params.append('semester', selectedTerm.semester)
    }
    const kw = (keywordOverride !== undefined ? keywordOverride : keyword).trim()
    if (kw) params.append('keyword', kw)
    if (classification) params.append('classification', classification)
    if (credits) params.append('credits', credits)
    if (startTime) params.append('startTime', startTime)
    if (endTime) params.append('endTime', endTime)

    try {
      const res = await fetch(`/calendar/lectures?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        if (err?.code === 'NO_UNIVERSITY') alert(err.message || '대학등록이 필요합니다')
        setLectures(emptyPage())
        return
      }
      const data = await res.json()
      setLectures({ items: data.items || [], page: data.page, totalPages: data.totalPages, total: data.total, loading: false })
    } catch {
      setLectures(emptyPage())
    }
  }

  async function loadUniversities(page) {
    setUniversities((u) => ({ ...u, loading: true }))
    try {
      const res = await fetch(`/calendar/universities?page=${page}&limit=10`)
      if (!res.ok) {
        setUniversities(emptyPage())
        return
      }
      const data = await res.json()
      setUniversities({ items: data.items || [], page: data.page, totalPages: data.totalPages, total: data.total, loading: false })
    } catch {
      setUniversities(emptyPage())
    }
  }

  async function handleAdd(lectureId) {
    const res = await fetch('/calendar/timetables/lecture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lectureId, color: DEFAULT_LECTURE_COLOR }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      alert(err?.error || '강의 추가 실패')
      return
    }

    await onAdded()
    alert('강의가 시간표에 추가되었습니다.')
  }

  return (
    <div className="event-modal" style={{ display: 'flex' }}>
      <div className="event-modal-content lecture-search-modal-content">
        <h3>강의 검색</h3>

        {!hasUniversity ? (
          <div className="lecture-search-no-univ">
            <p className="lecture-search-no-univ-title">대학등록이 필요합니다</p>
            <p className="lecture-search-no-univ-desc">
              마이페이지에서 소속 대학을 등록하면 해당 대학 강의를 검색할 수 있습니다.
            </p>
            <h4 className="lecture-search-univ-heading">등록 가능한 대학</h4>
            <ul className="available-university-list">
              {universities.loading ? (
                <li className="empty">불러오는 중...</li>
              ) : universities.items.length === 0 ? (
                <li className="empty">등록된 대학이 없습니다.</li>
              ) : (
                universities.items.map((name) => <li key={name}>{name}</li>)
              )}
            </ul>
            <div className="available-university-pagination">
              <Pagination state={universities} onPage={loadUniversities} />
            </div>
          </div>
        ) : (
          <div>
            <div className="lecture-search-controls">
              {semesters.length > 0 && (
                <select value={term} onChange={(e) => handleTermChange(e.target.value)} aria-label="학기">
                  {semesters.map((s) => (
                    <option key={termKey(s)} value={termKey(s)}>{s.year}년 {s.semester}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="강의명 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    loadLectures(1)
                  }
                }}
              />

              <select value={classification} onChange={(e) => setClassification(e.target.value)}>
                <option value="">이수구분 전체</option>
                {CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select value={credits} onChange={(e) => setCredits(e.target.value)}>
                <option value="">학점 전체</option>
                {CREDITS_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}학점</option>
                ))}
              </select>

              <select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                <option value="">시작 시간</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                <option value="">끝 시간</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <button type="button" className="btn btn-sm" onClick={() => loadLectures(1)}>검색</button>
            </div>

            <div className="lecture-search-list">
              {lectures.loading ? (
                <p className="lecture-search-loading">불러오는 중...</p>
              ) : lectures.items.length === 0 ? (
                <p>등록된 강의가 없습니다.</p>
              ) : (
                lectures.items.map((lecture) => (
                  <div className="lecture-search-item" key={lecture._id}>
                    <div>
                      <strong>{lecture.courseName}</strong>
                      <span> {lecture.section}분반</span>
                      {!REGULAR_SEMESTERS.includes(lecture.semester) && (
                        <span className="badge badge-amber" style={{ marginLeft: 6 }} title="계절학기 강의는 아직 시간표에 추가할 수 없습니다.">계절학기</span>
                      )}
                      <br />
                      <small>{lecture.classification} / {lecture.credits}학점 / {lecture.professor || '미정'}</small><br />
                      <small>{(lecture.schedules || []).map((s) => `${s.day} ${s.startTime}~${s.endTime}`).join(', ')}</small>
                    </div>
                    <button type="button" className="btn btn-sm btn-accent" onClick={() => handleAdd(lecture._id)}>담기</button>
                  </div>
                ))
              )}
            </div>

            <div className="available-university-pagination">
              <Pagination state={lectures} onPage={loadLectures} />
            </div>
          </div>
        )}

        <button type="button" className="btn btn-sm" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

export default LectureSearchModal
