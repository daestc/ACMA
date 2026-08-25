// views/pages/lectureAdmin.ejs + public/js/lectureAdmin.js를 옮긴 React 버전.
// 원본 GET /staff/lectures는 SSR 전용이라 controllers/lectureAdminController.js에
// getLectureData(GET /staff/lectures/list)를 새로 추가했다 — 쿼리(lectureAdminService.
// getLectures)는 원본과 동일, 응답만 JSON.
//
// POST(강의 등록)/저장은 원본과 같은 로직(postLecture)이지만, GET '/staff/lectures'가
// 이제 React SPA 라우트라 같은 경로로 POST를 프록시하면 새로고침 시 GET까지 백엔드로
// 넘어가 SPA가 깨진다 — 그래서 React 폼은 새로 뚫어둔 별칭 경로 POST '/staff/lectures/create'
// 로 보낸다(routes/staffRouter.js, vite.config.js 참고).
//
// 원본과 다르게 등록/삭제 성공 후 location.reload() 대신 목록만 다시 불러온다(fetch) —
// 다른 페이지들(AdminStaff.jsx 등)에서도 이미 쓴 패턴.
//
// 목록(하단 강의 카드)은 숫자 페이지네이션 대신 /recruit·/notice와 동일한 무한스크롤로
// 바꿨다. 서버(getLectureData, GET /staff/lectures/list)는 그대로 page=20개씩 주는
// 페이지네이션 API라 백엔드는 안 건드리고, 클라이언트에서 스크롤할 때마다 다음
// 페이지를 이어붙이는 방식으로만 바꿨다.
//
// 삭제는 원래 "같은 페이지를 다시 불러오기"였는데, 무한스크롤로 여러 페이지가 누적된
// 상태에서는 "페이지 하나만 다시 불러와서 통째로 교체"가 더 이상 맞지 않는다(누적된
// 나머지가 날아감) — 그래서 서버 삭제가 성공하면 로컬 items 배열에서 해당 항목만
// 바로 제거한다(Recruit.jsx의 toggleScrap과 같은 로컬 갱신 패턴).
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const CLASSIFICATIONS = ['교필', '교선', '전필', '전선', '일선']
const SEMESTERS = ['1학기', '2학기', '여름학기', '겨울학기']
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

function LectureAdmin() {
  const { user } = useAuth()
  const university = user?.university
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0) // 지금까지 불러온 마지막 페이지 (0 = 아직 없음)
  const [totalPages, setTotalPages] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true) // 처음부터 다시 불러오는 중
  const [loadingMore, setLoadingMore] = useState(false) // 스크롤로 다음 페이지 추가 로딩 중
  // 검색어가 바뀌는 등으로 리스트를 처음부터 다시 부를 때, 이전 요청의 응답이 늦게
  // 도착해서 새 결과에 섞여 들어가는 걸 막기 위한 토큰(Recruit.jsx와 동일 패턴).
  const fetchToken = useRef(0)

  // CSV 업로드
  const [csvFile, setCsvFile] = useState(null)
  const [csvYear, setCsvYear] = useState('2026')
  const [csvSemester, setCsvSemester] = useState('1학기')
  const [csvResult, setCsvResult] = useState(null) // { html, isError }
  const [csvUploading, setCsvUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const csvInputRef = useRef(null)

  // 개별 등록
  const [classification, setClassification] = useState('교필')
  const [courseName, setCourseName] = useState('')
  const [section, setSection] = useState('')
  const [credits, setCredits] = useState('')
  const [professor, setProfessor] = useState('')
  const [lecYear, setLecYear] = useState('2026')
  const [lecSemester, setLecSemester] = useState('1학기')
  const [scheduleRows, setScheduleRows] = useState([{ day: '월', startTime: '09:00', endTime: '10:30' }])
  const [lecMsg, setLecMsg] = useState(null) // { text, isError }
  const [lecSubmitting, setLecSubmitting] = useState(false)

  // isReset=true면 처음부터 다시(목록 교체), false면 무한스크롤로 다음 페이지를
  // 이어붙인다. 검색어(s)는 항상 호출부에서 명시적으로 넘긴다(원본 loadList(p, s)와
  // 같은 시그니처를 유지 — search state를 반응형으로 watch하지 않으므로 CSV
  // 업로드 후 "검색어는 비우지만 목록은 다시 안 부른다"는 원본 동작이 그대로 유지된다).
  const loadList = (p, s, isReset = true) => {
    const token = ++fetchToken.current
    if (isReset) setLoading(true)
    else setLoadingMore(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s) params.set('search', s)
    fetch(`/staff/lectures/list?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (token !== fetchToken.current) return // 그 사이 새 요청이 나가서 무시
        if (!data.ok) return
        setItems((prev) => (isReset ? (data.items || []) : [...prev, ...(data.items || [])]))
        setTotal(data.total || 0)
        setPage(data.page || p)
        setTotalPages(data.totalPages || 0)
      })
      .finally(() => {
        if (token !== fetchToken.current) return
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(() => {
    loadList(1, '', true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    loadList(1, searchInput, true)
  }

  // 스크롤이 하단 감지용 div에 닿으면 다음 페이지를 이어서 불러온다.
  const sentinelRef = useRef(null)
  const hasMore = page > 0 && page < totalPages
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          loadList(page + 1, search, false)
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, search])

  // ── CSV 업로드 ──────────────────────────────────────────
  const isLectureFile = (f) => /\.(csv|xlsx)$/i.test(f.name)

  const setFile = (f) => {
    if (!f || !isLectureFile(f)) return
    setCsvFile(f)
  }

  const clearCsvFile = () => {
    setCsvFile(null)
    if (csvInputRef.current) csvInputRef.current.value = ''
    setCsvResult(null)
  }

  const uploadCsv = async () => {
    if (!csvFile) {
      setCsvResult({ html: '업로드할 CSV 또는 XLSX 파일을 먼저 선택해주세요.', isError: true })
      return
    }
    setCsvUploading(true)
    try {
      const formData = new FormData()
      formData.append('csvFile', csvFile)
      formData.append('year', csvYear)
      formData.append('semester', csvSemester)
      const res = await fetch('/staff/lectures/csv', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ok) {
        let html = `처리 완료 — 신규 <strong>${data.inserted}</strong>건 / 갱신 <strong>${data.updated}</strong>건 (총 ${data.total}건)`
        if (data.failedRows?.length) {
          const rows = data.failedRows.slice(0, 5).map((f) => `${f.row}행`).join(', ')
          html += `<br>건너뛴 행 ${data.failedRows.length}건: ${rows}${data.failedRows.length > 5 ? ' 외' : ''}`
        }
        setCsvResult({ html, isError: false })
        clearCsvFile()
        loadList(1, search, true)
        setSearch('')
        setSearchInput('')
      } else {
        setCsvResult({ html: data.message || '업로드에 실패했습니다.', isError: true })
      }
    } catch {
      setCsvResult({ html: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setCsvUploading(false)
    }
  }

  // ── 개별 등록 ──────────────────────────────────────────
  const addScheduleRow = () => {
    setScheduleRows((rows) => [...rows, { day: '월', startTime: '09:00', endTime: '10:30' }])
  }
  const removeScheduleRow = (idx) => {
    setScheduleRows((rows) => rows.filter((_, i) => i !== idx))
  }
  const updateScheduleRow = (idx, field, value) => {
    setScheduleRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  const submitLecture = async () => {
    if (!courseName) { setLecMsg({ text: '교과명을 입력해주세요.', isError: true }); return }
    if (!credits) { setLecMsg({ text: '학점을 입력해주세요.', isError: true }); return }
    if (scheduleRows.length === 0) { setLecMsg({ text: '강의시간을 1개 이상 추가해주세요.', isError: true }); return }
    for (const s of scheduleRows) {
      if (!s.startTime || !s.endTime) { setLecMsg({ text: '강의시간의 시작/종료 시각을 입력해주세요.', isError: true }); return }
      if (s.startTime >= s.endTime) { setLecMsg({ text: '종료 시간은 시작 시간보다 늦어야 합니다.', isError: true }); return }
    }

    setLecSubmitting(true)
    const body = { classification, courseName, section, credits, professor, year: lecYear, semester: lecSemester, schedules: scheduleRows }
    try {
      const res = await fetch('/staff/lectures/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        const sectionLabel = section ? `${section}분반` : '분반 없음'
        setLecMsg({ text: `"${courseName} ${sectionLabel}" 등록 완료`, isError: false })
        setCourseName(''); setSection(''); setCredits(''); setProfessor('')
        setScheduleRows([{ day: '월', startTime: '09:00', endTime: '10:30' }])
        loadList(1, search, true)
      } else {
        setLecMsg({ text: data.message || '등록에 실패했습니다.', isError: true })
      }
    } catch {
      setLecMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setLecSubmitting(false)
    }
  }

  // ── 삭제 ──────────────────────────────────────────
  const deleteLecture = async (id, label) => {
    if (!window.confirm(`"${label}" 강의를 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/staff/lectures/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        // 무한스크롤로 여러 페이지가 누적된 상태라 "그 페이지만 다시 불러오기"는
        // 더 이상 안 맞는다 — 로컬 목록에서 바로 제거한다.
        setItems((prev) => prev.filter((lec) => lec._id !== id))
        setTotal((prev) => Math.max(0, prev - 1))
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
    <>
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📄 CSV / XLSX 일괄 등록</span>
            <span className="badge badge-blue">upsert</span>
          </div>

          <div
            onClick={() => csvInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) setFile(f)
            }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)', padding: '24px 16px', textAlign: 'center',
              cursor: 'pointer', display: csvFile ? 'none' : 'block',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>CSV 또는 XLSX 파일을 드래그하거나 클릭해서 업로드</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
              헤더: 이수구분, 교과명, 분반, 학점, 담당교수, 강의시간 (최대 5MB)
            </div>
            <input
              ref={csvInputRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
            />
          </div>

          {csvFile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <span>📄 <span>{csvFile.name}</span></span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearCsvFile}>✕</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div>
              <label>개설 연도</label>
              <input className="input-field" type="number" min="2000" max="2100" value={csvYear} onChange={(e) => setCsvYear(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>학기</label>
              <select className="input-field" value={csvSemester} onChange={(e) => setCsvSemester(e.target.value)} style={{ width: '100%' }}>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button
            type="button" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
            disabled={csvUploading} onClick={uploadCsv}
          >
            {csvUploading ? '⏳ 업로드 중...' : '⬆ 파일 업로드'}
          </button>

          {csvResult && (
            <div style={{ ...msgBoxStyle(csvResult.isError), marginTop: 10 }} dangerouslySetInnerHTML={{ __html: csvResult.html }} />
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">✏️ 개별 강의 등록</span></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label>이수구분 *</label>
                <select className="input-field" value={classification} onChange={(e) => setClassification(e.target.value)} style={{ width: '100%' }}>
                  {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>교과명 *</label>
                <input className="input-field" placeholder="자료구조" value={courseName} onChange={(e) => setCourseName(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
              <div>
                <label>분반</label>
                <input className="input-field" type="number" min="0" placeholder="없으면 비움" value={section} onChange={(e) => setSection(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label>학점 *</label>
                <input className="input-field" type="number" min="1" max="10" placeholder="3" value={credits} onChange={(e) => setCredits(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label>담당교수</label>
                <input className="input-field" placeholder="미정" value={professor} onChange={(e) => setProfessor(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label>개설 연도</label>
                <input className="input-field" type="number" min="2000" max="2100" value={lecYear} onChange={(e) => setLecYear(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label>학기</label>
                <select className="input-field" value={lecSemester} onChange={(e) => setLecSemester(e.target.value)} style={{ width: '100%' }}>
                  {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label>강의시간 *</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addScheduleRow}>+ 시간 추가</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduleRows.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select className="input-field sch-day" value={row.day} onChange={(e) => updateScheduleRow(idx, 'day', e.target.value)}>
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input className="input-field sch-start" type="time" value={row.startTime} onChange={(e) => updateScheduleRow(idx, 'startTime', e.target.value)} />
                    <span>~</span>
                    <input className="input-field sch-end" type="time" value={row.endTime} onChange={(e) => updateScheduleRow(idx, 'endTime', e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeScheduleRow(idx)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} disabled={lecSubmitting} onClick={submitLecture}>
              {lecSubmitting ? '⏳ 등록 중...' : '강의 등록'}
            </button>

            {lecMsg && <div style={msgBoxStyle(lecMsg.isError)}>{lecMsg.text}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📚 {university || '소속 대학'} 강의</span>
          <span>총 {total}건</span>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input-field" placeholder="교과명 또는 교수명 검색" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-ghost">검색</button>
        </form>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text2)', fontSize: 13 }}>
            {search ? '검색 결과가 없습니다.' : '아직 등록한 강의가 없습니다. CSV 업로드 또는 개별 등록으로 시작하세요.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>이수구분</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>교과명</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>분반</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>학점</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>담당교수</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)' }}>강의시간</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lec) => (
                  <tr key={lec._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}><span className="badge badge-blue">{lec.classification}</span></td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{lec.courseName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{lec.section ? lec.section : '없음'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{lec.credits}</td>
                    <td style={{ padding: '10px 12px' }}>{lec.professor}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {lec.schedules?.length ? lec.schedules.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ') : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button" className="btn btn-ghost btn-sm"
                        onClick={() => deleteLecture(lec._id, `${lec.courseName} ${lec.section ? lec.section + '분반' : '분반 없음'}`)}
                      >🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 무한스크롤 감지 지점 — 화면에 들어오면 다음 페이지를 불러온다 */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
            )}
            {!loadingMore && !hasMore && page > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text2)', fontSize: 13 }}>모든 강의를 확인했습니다.</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default LectureAdmin
