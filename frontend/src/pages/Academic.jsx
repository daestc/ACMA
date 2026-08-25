import { useEffect, useMemo, useState } from 'react'
import AcademicTrendChart from '../components/Academic/AcademicTrendChart'
import {
  SEMESTER_OPTIONS,
  GRADE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  SEMESTER_STATUS_LABEL,
  parseSemesterOrder,
  formatSemesterLabel,
  calcGpaFromRows,
} from '../components/Academic/academicUtils'

const CREDIT_OPTIONS = ['3', '2', '1']

function blankRows() {
  return [0, 1, 2].map(() => ({ subjectName: '', subjectType: 'free', credits: '3', grade: 'A' }))
}

const PROGRESS_CATEGORIES = [
  { key: 'major_required', reqKey: 'requiredMajorCredits', label: '전공필수', fillClass: 'fill-blue' },
  { key: 'major_elective', reqKey: 'requiredMajorElective', label: '전공선택', fillClass: 'fill-purple' },
  { key: 'general_required', reqKey: 'requiredGeneralCredits', label: '교양필수', fillClass: 'fill-green' },
  { key: 'general_elective', reqKey: 'requiredGeneralElective', label: '교양선택', fillClass: 'fill-amber' },
]

const LANGUAGE_TYPES = ['TOEIC', 'TOEFL', 'IELTS', 'JLPT']

function Academic() {
  const [activeTab, setActiveTab] = useState('gpa')

  const [semester, setSemester] = useState(SEMESTER_OPTIONS[0])
  const [rows, setRows] = useState(blankRows())
  const [semesterStatus, setSemesterStatus] = useState('in_progress')
  const [closeHint, setCloseHint] = useState(false)
  const [recordLoading, setRecordLoading] = useState(true)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved
  const [closing, setClosing] = useState(false)

  const [trendRecords, setTrendRecords] = useState([])
  const [trendLoading, setTrendLoading] = useState(true)
  const [progressTotals, setProgressTotals] = useState(null)
  const [progressReq, setProgressReq] = useState(null)


  const [gradAvailable, setGradAvailable] = useState(null) // null = 로딩중
  const [gradMessage, setGradMessage] = useState('')
  const [gradProfile, setGradProfile] = useState(null)

  const gpaResult = useMemo(() => calcGpaFromRows(rows), [rows])

  async function loadRecord(sem) {
    setRecordLoading(true)
    try {
      const res = await fetch(`/academic/record/${encodeURIComponent(sem)}`, { credentials: 'same-origin' })
      const json = await res.json()
      const record = json.success ? json.record : null

      setSemesterStatus(record?.status || 'in_progress')
      const allGraded = Boolean(record?.subjects?.length) && record.subjects.every((s) => s.grade)
      setCloseHint(Boolean(allGraded && record?.status !== 'completed'))

      if (!record || !record.subjects || !record.subjects.length) {
        setRows(blankRows())
      } else {
        setRows(record.subjects.map((s) => ({
          subjectName: s.subjectName || '',
          subjectType: s.subjectType || 'free',
          credits: String(s.credits ?? '3'),
          grade: s.grade || 'A',
        })))
      }
    } catch (err) {
      console.error(err)
      setRows(blankRows())
    } finally {
      setRecordLoading(false)
    }
  }

  async function loadTrend() {
    setTrendLoading(true)
    try {
      const res = await fetch('/academic/all-gpa', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('학기별 GPA를 불러오지 못했습니다.')
      const json = await res.json()
      const records = (json.success ? json.records : [])
        .filter((r) => r && r.semester)
        .map((r) => ({ ...r, semesterGPA: Number(r.semesterGPA) }))
        .sort((a, b) => {
          const ao = parseSemesterOrder(a.semester)
          const bo = parseSemesterOrder(b.semester)
          return ao.year - bo.year || ao.semesterNumber - bo.semesterNumber
        })
      setTrendRecords(records)
    } catch (err) {
      console.error(err)
      setTrendRecords([])
    } finally {
      setTrendLoading(false)
    }
  }

  async function loadProgress() {
    try {
      const res = await fetch('/academic/progress', { credentials: 'same-origin' })
      if (!res.ok) return
      const json = await res.json()
      if (!json.success) return
      setProgressTotals(json.totals || {})
      setProgressReq(json.graduationRequirements || null)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadGraduationRequirements() {
    try {
      const res = await fetch('/academic/graduation-requirements', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('졸업요건을 불러오지 못했습니다.')
      const json = await res.json()
      if (!json.success) return

      if (!json.available) {
        setGradAvailable(false)
        setGradMessage(json.message || '졸업요건 정보가 없습니다.')
        return
      }
      setGradAvailable(true)
      setGradProfile(json.profile)
    } catch (err) {
      console.error(err)
      setGradAvailable(false)
      setGradMessage('졸업요건을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    loadRecord(SEMESTER_OPTIONS[0])
    loadTrend()
    loadProgress()
    loadGraduationRequirements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSemesterChange(sem) {
    setSemester(sem)
    loadRecord(sem)
  }

  function handleGradeChange(index, grade) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, grade } : row)))
  }

  async function handleSave() {
    const subjects = rows
      .map((row) => ({ subjectName: row.subjectName.trim(), subjectType: row.subjectType, credits: row.credits, grade: row.grade }))
      .filter((s) => s.subjectName)

    if (!subjects.length) {
      alert('과목을 하나 이상 입력해 주세요.')
      return
    }

    setSaveState('saving')
    try {
      const res = await fetch('/academic/updateBulkGrades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ semester, subjects }),
        credentials: 'same-origin',
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message || '저장에 실패했습니다.')

      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch (err) {
      alert(err.message || '저장에 실패했습니다.')
      setSaveState('idle')
    }
  }

  async function handleToggleClose() {
    const closingNow = semesterStatus !== 'completed'
    const confirmMessage = closingNow
      ? `${formatSemesterLabel(semester)}를 마감하시겠습니까?`
      : `${formatSemesterLabel(semester)} 마감을 취소하시겠습니까?`
    if (!confirm(confirmMessage)) return

    setClosing(true)
    try {
      const res = await fetch(closingNow ? '/academic/closeSemester' : '/academic/reopenSemester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ semester }),
        credentials: 'same-origin',
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message || '처리에 실패했습니다.')

      setSemesterStatus(result.status)
      if (result.status === 'completed') setCloseHint(false)

      loadTrend()
      loadProgress()
    } catch (err) {
      alert(err.message || '처리에 실패했습니다.')
    } finally {
      setClosing(false)
    }
  }

  const statusInfo = SEMESTER_STATUS_LABEL[semesterStatus] || SEMESTER_STATUS_LABEL.in_progress

  return (
    <>
      <div className="tabs">
        <button type="button" className={`tab-btn ${activeTab === 'gpa' ? 'active' : ''}`} onClick={() => setActiveTab('gpa')}>학점 등록</button>
        <button type="button" className={`tab-btn ${activeTab === 'credit' ? 'active' : ''}`} onClick={() => setActiveTab('credit')}>이수 현황</button>
        <button type="button" className={`tab-btn ${activeTab === 'grad' ? 'active' : ''}`} onClick={() => setActiveTab('grad')}>졸업요건</button>
      </div>

      {activeTab === 'gpa' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">학기 과목 입력</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${statusInfo.badgeClass}`}>{statusInfo.text}</span>
                <button type="button" className="btn" style={{ fontSize: 12, padding: '5px 10px' }} disabled={closing} onClick={handleToggleClose}>
                  {semesterStatus === 'completed' ? '마감 취소' : '마감'}
                </button>
                <select
                  className="select-field"
                  style={{ fontSize: 12, padding: '5px 10px' }}
                  value={semester}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                >
                  {SEMESTER_OPTIONS.map((s) => (
                    <option key={s} value={s}>{formatSemesterLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div id="subject-list">
              {recordLoading ? (
                <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--text2)' }}>불러오는 중...</div>
              ) : (
                rows.map((row, i) => (
                  <div className="subject-row" key={i}>
                    <input className="input-field" name="subjectName" placeholder="과목명" style={{ flex: 2 }} readOnly value={row.subjectName} />
                    <select
                      className="select-field"
                      name="subjectType"
                      style={{ minWidth: 120, pointerEvents: 'none', backgroundColor: '#f3f4f6' }}
                      tabIndex={-1}
                      value={row.subjectType}
                      onChange={() => {}}
                    >
                      {SUBJECT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <select
                      className="select-field"
                      name="credits"
                      style={{ pointerEvents: 'none', backgroundColor: '#f3f4f6' }}
                      tabIndex={-1}
                      value={row.credits}
                      onChange={() => {}}
                    >
                      {CREDIT_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}학점</option>
                      ))}
                    </select>
                    <select className="select-field" name="grade" value={row.grade} onChange={(e) => handleGradeChange(i, e.target.value)}>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>

            {closeHint && (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>
                모든 과목 성적이 입력됐습니다 — 이 학기를 마감할까요?
              </div>
            )}

            <button type="button" className="btn btn-accent" style={{ marginTop: 8, width: '100%' }} disabled={saveState === 'saving'} onClick={handleSave}>
              {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '✓ 저장됨' : '저장'}
            </button>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="gpa-display">
              <div className="gpa-label">이번 학기 예상 평점</div>
              <div><span className="gpa-value">{gpaResult}</span><span className="gpa-max"> / 4.5</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'credit' && (
        <CreditTab
          trendLoading={trendLoading}
          trendRecords={trendRecords}
          progressTotals={progressTotals}
          progressReq={progressReq}
        />
      )}

      {activeTab === 'grad' && (
        <GradTab
          available={gradAvailable}
          message={gradMessage}
          profile={gradProfile}
          progressTotals={progressTotals}
        />
      )}
    </>
  )
}

function CreditTab({ trendLoading, trendRecords, progressTotals, progressReq }) {
  const validRecords = trendRecords.filter((r) => Number.isFinite(r.semesterGPA))
  const totals = progressTotals || {}
  const req = progressReq || {}

  const totalEarned = Number(totals.totalEarned || 0)
  const totalNeeded = Number(req.requiredTotalCredits || 0) || 0
  const totalPct = totalNeeded ? Math.min(100, Math.round((totalEarned / totalNeeded) * 100)) : 0

  const averageGpa = validRecords.length ? validRecords.reduce((sum, r) => sum + r.semesterGPA, 0) / validRecords.length : null
  const bestRecord = validRecords.length ? validRecords.reduce((best, cur) => (cur.semesterGPA > best.semesterGPA ? cur : best), validRecords[0]) : null
  const historyTotalCredits = validRecords.reduce((sum, r) => sum + (Number(r.earnedCredits) || 0), 0)

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"> 학기별 학점 추이</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} />실제 GPA
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />최고 학기
            </span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 520, minHeight: 260, display: !trendLoading && validRecords.length ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
            {trendLoading ? (
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>학기별 학점을 불러오는 중...</span>
            ) : (
              <AcademicTrendChart records={validRecords} />
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>📂 영역별 이수 현황</div>
          {PROGRESS_CATEGORIES.map((item) => {
            const earned = Number(totals[item.key] || 0)
            const needed = Number(req[item.reqKey] || 0) || 0
            const pct = needed ? Math.min(100, Math.round((earned / needed) * 100)) : 0
            return (
              <div className="progress-wrap" key={item.key}>
                <div className="progress-header">
                  <span className="progress-label">{item.label}</span>
                  <span className="progress-value">{needed ? `${earned}/${needed}` : `${earned}`}</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${item.fillClass}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          <div className="progress-wrap" style={{ marginBottom: 0 }}>
            <div className="progress-header">
              <span className="progress-label">총 이수 학점</span>
              <span className="progress-value">{totalNeeded ? `${totalEarned}/${totalNeeded}` : `${totalEarned}`}</span>
            </div>
            <div className="progress-track" style={{ height: 10 }}>
              <div className="progress-fill fill-blue" style={{ width: `${totalPct}%` }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}> 학기별 성적 이력</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: '8px 10px', textAlign: 'left' }}>학기</th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: '8px 10px', textAlign: 'left' }}>이수학점</th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: '8px 10px', textAlign: 'left' }}>취득학점</th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', padding: '8px 10px', textAlign: 'left' }}>GPA</th>
                </tr>
              </thead>
              <tbody>
                {trendLoading ? (
                  <tr><td colSpan={4} style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>학기별 데이터를 불러오는 중...</td></tr>
                ) : !validRecords.length ? (
                  <tr><td colSpan={4} style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>학기별 성적 데이터가 없습니다.</td></tr>
                ) : (
                  validRecords.map((record, index) => {
                    const isBest = bestRecord && record.semester === bestRecord.semester
                    return (
                      <tr key={record.semester} style={{ borderBottom: '1px solid var(--border)', background: index % 2 === 1 ? 'var(--bg3)' : undefined }}>
                        <td style={{ padding: 10, fontSize: 13 }}>{formatSemesterLabel(record.semester)}</td>
                        <td style={{ padding: 10, fontSize: 13, color: 'var(--text2)' }}>{Number(record.attemptedCredits || 0)}</td>
                        <td style={{ padding: 10, fontSize: 13, color: 'var(--text2)' }}>{Number(record.earnedCredits || 0)}</td>
                        <td style={{ padding: 10 }}>
                          <strong style={{ color: isBest ? 'var(--green)' : 'var(--accent)', fontFamily: "'DM Sans'" }}>{record.semesterGPA.toFixed(2)}</strong>
                          {isBest && <span className="badge badge-green" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>최고</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans'", color: 'var(--accent)' }}>{averageGpa != null ? averageGpa.toFixed(2) : '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>누적 평점</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans'", color: 'var(--green)' }}>{bestRecord ? bestRecord.semesterGPA.toFixed(2) : '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>최고 학기</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans'", color: 'var(--purple)' }}>{validRecords.length ? historyTotalCredits : '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>총 취득 학점</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function GradTab({ available, message, profile, progressTotals }) {
  if (available === null) {
    return <div className="card"><div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>불러오는 중...</div></div>
  }

  if (!available) {
    return (
      <div className="card">
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>정보 없음</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{message}</div>
        </div>
      </div>
    )
  }

  const req = profile?.GraduationRequirements || {}
  const total = req.requiredTotalCredits ?? 130
  const majorReq = req.requiredMajorCredits ?? 42
  const majorEl = req.requiredMajorElective ?? 40
  const genReq = req.requiredGeneralCredits ?? 20
  const genEl = req.requiredGeneralElective ?? 28
  const gradWorkOn = Boolean(req.requiresGraduationWork)
  const capstoneOn = Boolean(req.requiredCapstonDesign)
  const languageValue = String(req.requiredLanguageScore || '')
  const knownType = LANGUAGE_TYPES.find((t) => languageValue.startsWith(t))
  const langType = knownType || '없음'
  const langScore = knownType ? languageValue.replace(knownType, '').trim() : languageValue
  const certifications = Array.isArray(req.requiredCertifications) ? req.requiredCertifications.filter(Boolean) : []
  const internship = req.requiredInternship == null ? '' : String(req.requiredInternship)
  const ncProgram = req.requiredNCProgram == null ? '' : String(req.requiredNCProgram)
  const volunteer = req.requiredVolunteer ?? ''

  const totalEarned = Number(progressTotals?.totalEarned || 0)
  const achievedPct = total ? Math.min(100, Math.round((totalEarned / total) * 100)) : 0
  const remaining = Math.max(0, total - totalEarned)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">졸업요건</span>
        <span className="badge badge-blue">{profile?.major || profile?.university || '-'}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>
        대학관계자가 등록한 졸업요건입니다. 학생은 조회만 가능합니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.5px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>이수 학점 요건</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ReadonlyField label="총 졸업 필요 학점" value={total} />
          <ReadonlyField label="전공필수" value={majorReq} />
          <ReadonlyField label="전공선택" value={majorEl} />
          <ReadonlyField label="교양필수" value={genReq} />
          <ReadonlyField label="교양선택" value={genEl} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.5px', paddingBottom: 6, borderBottom: '1px solid var(--border)', marginTop: 4 }}>추가 이수 요건</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>졸업작품 이수 필요</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>캡스톤디자인 또는 졸업논문</div>
          </div>
          <div className={`toggle ${gradWorkOn ? 'on' : ''}`}><div className="toggle-knob" /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>캡스톤 디자인 이수 필요</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>졸업요건에 캡스톤이 포함되는지 여부</div>
          </div>
          <div className={`toggle ${capstoneOn ? 'on' : ''}`}><div className="toggle-knob" /></div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>외국어 성적 요건</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select-field" style={{ flex: 1, pointerEvents: 'none', backgroundColor: '#f3f4f6' }} tabIndex={-1} value={langType} onChange={() => {}}>
              <option>TOEIC</option><option>TOEFL</option><option>IELTS</option><option>JLPT</option><option>없음</option>
            </select>
            <input className="input-field" placeholder="최소 점수" style={{ flex: 1 }} readOnly value={langScore} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>필수 취득 자격증</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, minHeight: 28 }}>
            {certifications.map((cert) => (
              <div key={cert} className="gr-cert-chip" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                {cert}
              </div>
            ))}
          </div>
          {!certifications.length && <div style={{ fontSize: 12, color: 'var(--text2)' }}>없음</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>인턴십 의무 이수</label>
            <select className="select-field" style={{ width: '100%', pointerEvents: 'none', backgroundColor: '#f3f4f6' }} tabIndex={-1} value={internship} onChange={() => {}}>
              <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>비교과 프로그램</label>
            <select className="select-field" style={{ width: '100%', pointerEvents: 'none', backgroundColor: '#f3f4f6' }} tabIndex={-1} value={ncProgram} onChange={() => {}}>
              <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>사회봉사 시간</label>
            <input className="input-field" type="number" placeholder="-" style={{ width: '100%' }} readOnly value={volunteer} />
          </div>
        </div>

        <div style={{ marginTop: 4, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>달성률 {achievedPct}% · 졸업까지 {remaining}학점 남음</div>
          <div>총 필요학점: {total}학점</div>
          <div>전공필수 {majorReq}학점, 전공선택 {majorEl}학점</div>
          <div>교양필수 {genReq}학점, 교양선택 {genEl}학점</div>
          <div>졸업작품: {gradWorkOn ? '필요' : '불필요'} / 캡스톤 디자인: {capstoneOn ? '필요' : '선택'}</div>
          <div>외국어 성적: {langType === '없음' ? '없음' : `${langType}${langScore ? ` ${langScore}` : ''}`}</div>
          <div>자격증: {certifications.length ? certifications.join(', ') : '없음'}</div>
          <div>인턴십: {internship === '' ? '미지정' : internship === 'true' ? '필수' : '선택'} / 비교과: {ncProgram === '' ? '미지정' : ncProgram === 'true' ? '필수' : '선택'} / 봉사시간: {volunteer || '미지정'}</div>
        </div>
      </div>
    </div>
  )
}

function ReadonlyField({ label, value }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="input-field" type="number" style={{ width: '100%' }} readOnly value={value} />
    </div>
  )
}

export default Academic
