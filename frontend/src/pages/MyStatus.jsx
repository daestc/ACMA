import { useCallback, useEffect, useMemo, useState } from 'react'
import SpecModal from '../components/MyStatus/SpecModal'
import { SPEC_CONFIGS } from '../components/MyStatus/specConfigs'

const LANG_LABEL = {
  english: { name: '영어', flag: '🇺🇸', bg: 'var(--sky-bg)' },
  japanese: { name: '일본어', flag: '🇯🇵', bg: 'var(--green-bg)' },
  chinese: { name: '중국어', flag: '🇨🇳', bg: 'var(--red-bg)' },
  other: { name: '기타', flag: '🌐', bg: 'var(--bg3)' },
}
const SKILL_LEVEL_BADGE = { 하급: 'badge-blue', 중급: 'badge-amber', 고급: 'badge-green' }

function fmtYM(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })
}

function parseSemesterOrder(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-(\d)$/)
  if (!match) return { year: 0, semesterNumber: 0 }
  return { year: Number(match[1]), semesterNumber: Number(match[2]) }
}

function formatSemesterLabel(semester) {
  return String(semester || '').replace(/^(\d{4})-(\d)$/, '$1-$2학기')
}

const PROGRESS_ROWS = [
  { key: 'major_required', reqKey: 'requiredMajorCredits', label: '전공필수', fillClass: 'fill-blue' },
  { key: 'major_elective', reqKey: 'requiredMajorElective', label: '전공선택', fillClass: 'fill-purple' },
  { key: 'general_required', reqKey: 'requiredGeneralCredits', label: '교양필수', fillClass: 'fill-green' },
  { key: 'general_elective', reqKey: 'requiredGeneralElective', label: '교양선택', fillClass: 'fill-amber' },
]

const TABS = [
  { key: 'cert', label: '자격증' },
  { key: 'activity', label: '대외활동' },
  { key: 'lang', label: '어학성적' },
  { key: 'skill', label: '스킬' },
]

function MyStatus() {
  const [profile, setProfile] = useState(null)
  const [careerLoaded, setCareerLoaded] = useState(false)
  const [career, setCareer] = useState(null)
  const [certs, setCerts] = useState([])
  const [progress, setProgress] = useState(null)
  const [gpaLoaded, setGpaLoaded] = useState(false)
  const [gpaRecords, setGpaRecords] = useState([])
  const [specsLoaded, setSpecsLoaded] = useState(false)
  const [specs, setSpecs] = useState({ awards: [], languages: [], experiences: [], skills: [] })
  const [diagnosis, setDiagnosis] = useState({ status: 'loading' })
  const [activeTab, setActiveTab] = useState('cert')
  const [specModal, setSpecModal] = useState({ open: false, type: null, item: null })

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/user/profile')
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!data.user) throw new Error()
      setProfile(data.user)
    } catch {
      alert('프로필 정보를 가져오는데 실패했습니다. 다시 시도해주세요.')
    }
  }, [])

  const loadCareerAndCerts = useCallback(async () => {
    try {
      const res = await fetch('/career/my-career-and-certs', { credentials: 'same-origin' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!data.success) throw new Error()
      setCareer(data.career || null)
      setCerts(data.certifications || [])
      setCareerLoaded(true)
    } catch {
    }
  }, [])

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch('/academic/progress', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      if (!data.success) return
      setProgress({ totals: data.totals || {}, requirements: data.profile?.GraduationRequirements || {} })
    } catch {
    }
  }, [])

  const loadGpaRecords = useCallback(async () => {
    try {
      const res = await fetch('/academic/all-gpa', { credentials: 'same-origin' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGpaRecords(data.success ? (data.records || []) : [])
    } catch {
      setGpaRecords([])
    } finally {
      setGpaLoaded(true)
    }
  }, [])

  const loadSpecs = useCallback(async () => {
    try {
      const res = await fetch('/spec/mine', { credentials: 'same-origin' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!data.success) throw new Error()
      setSpecs({
        awards: data.awards || [],
        languages: data.languages || [],
        experiences: data.experiences || [],
        skills: data.skills || [],
      })
      setSpecsLoaded(true)
    } catch {
    }
  }, [])

  const loadDiagnosis = useCallback(async () => {
    try {
      const res = await fetch('/ai/diagnosis/latest', { credentials: 'same-origin' })
      if (res.status === 404) {
        setDiagnosis({ status: 'none' })
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.status !== 'done' || !data.data) {
        setDiagnosis({ status: 'pending' })
        return
      }
      setDiagnosis({ status: 'done', data: data.data })
    } catch {
      setDiagnosis({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    loadProfile()
    loadCareerAndCerts()
    loadProgress()
    loadGpaRecords()
    loadSpecs()
    loadDiagnosis()
  }, [loadProfile, loadCareerAndCerts, loadProgress, loadGpaRecords, loadSpecs, loadDiagnosis])

  const gpaSummary = useMemo(() => {
    const normalized = (gpaRecords || [])
      .filter((r) => r && r.semester)
      .map((r) => ({ ...r, semesterGPA: Number(r.semesterGPA) }))
      .sort((a, b) => {
        const l = parseSemesterOrder(a.semester)
        const r = parseSemesterOrder(b.semester)
        return l.year - r.year || l.semesterNumber - r.semesterNumber
      })
    const valid = normalized.filter((r) => Number.isFinite(r.semesterGPA))
    if (!valid.length) return { records: [], average: null, best: null, totalCredits: 0 }

    const average = valid.reduce((sum, r) => sum + r.semesterGPA, 0) / valid.length
    const best = valid.reduce((b, r) => (r.semesterGPA > b.semesterGPA ? r : b), valid[0])
    const totalCredits = valid.reduce((sum, r) => sum + (Number(r.earnedCredits) || 0), 0)
    return { records: valid, average, best, totalCredits }
  }, [gpaRecords])

  const acquiredCerts = certs.filter((c) => c.status === 'acquired')

  const totalEarned = Number(progress?.totals?.totalEarned || 0)
  const totalNeeded = Number(progress?.requirements?.requiredTotalCredits || 0) || 0
  const totalPct = totalNeeded ? Math.min(100, Math.round((totalEarned / totalNeeded) * 100)) : 0

  function openSpecModal(type, item) {
    setSpecModal({ open: true, type, item: item || null })
  }
  function closeSpecModal() {
    setSpecModal({ open: false, type: null, item: null })
  }

  return (
    <>
      {/* 사람인 포트폴리오 배너 */}
      <div className="portfolio-banner">
        <div className="portfolio-name">{profile ? profile.name : '...'}</div>
        <div className="portfolio-meta">
          {profile ? `${profile.university || ''} · ${profile.major || ''} · ${profile.studentId || ''} · ${profile.enrollmentStatus || ''}` : '...'}
        </div>
        <div className="portfolio-tags">
          <span className="portfolio-tag">{careerLoaded ? (career?.title || '목표 직무 없음') : '...'}</span>
          <span className="portfolio-tag">
            {careerLoaded
              ? (acquiredCerts.length > 0 ? acquiredCerts.map((c) => c.certificationId?.name).join(', ') : '취득 자격증 없음')
              : '...'}
          </span>
        </div>
      </div>

      {/* 학업 현황 요약 통계 카드 */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-card blue"><div className="stat-icon">📊</div><div className="stat-label">현재 평점</div><div className="stat-value">{gpaSummary.average != null ? gpaSummary.average.toFixed(2) : (gpaLoaded ? '-' : '...')}</div></div>
        <div className="stat-card green"><div className="stat-icon">📚</div><div className="stat-label">이수 학점</div><div className="stat-value">{gpaSummary.average != null ? gpaSummary.totalCredits : (gpaLoaded ? '-' : '...')}</div></div>
        <div className="stat-card amber"><div className="stat-icon">📝</div><div className="stat-label">이번 주 목표달성</div><div className="stat-value">...</div></div>
        <div className="stat-card purple"><div className="stat-icon">🏅</div><div className="stat-label">취득 자격증</div><div className="stat-value">{careerLoaded ? `${acquiredCerts.length} 개` : '...'}</div></div>
      </div>

      {/* 이수 현황: 영역별 이수 현황 + 학기별 성적 이력 */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>영역별 이수 현황</div>
          {PROGRESS_ROWS.map((row) => {
            const earned = Number(progress?.totals?.[row.key] || 0)
            const needed = Number(progress?.requirements?.[row.reqKey] || 0) || 0
            const pct = needed ? Math.min(100, Math.round((earned / needed) * 100)) : 0
            return (
              <div className="progress-wrap" key={row.key}>
                <div className="progress-header"><span className="progress-label">{row.label}</span><span className="progress-value">{progress ? (needed ? `${earned}/${needed}` : `${earned}`) : '-'}</span></div>
                <div className="progress-track"><div className={`progress-fill ${row.fillClass}`} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
          <div className="progress-wrap" style={{ marginBottom: 0 }}>
            <div className="progress-header"><span className="progress-label">총 이수 학점</span><span className="progress-value">{progress ? (totalNeeded ? `${totalEarned}/${totalNeeded}` : `${totalEarned}`) : '-'}</span></div>
            <div className="progress-track" style={{ height: 10 }}><div className="progress-fill fill-blue" style={{ width: `${totalPct}%` }} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>학기별 성적 이력</div>
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
                {!gpaLoaded ? (
                  <tr><td colSpan={4} style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>학기별 데이터를 불러오는 중...</td></tr>
                ) : gpaSummary.records.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>학기별 성적 데이터가 없습니다.</td></tr>
                ) : (
                  gpaSummary.records.map((record, index) => {
                    const isBest = record.semester === gpaSummary.best.semester
                    return (
                      <tr key={record.semester} style={{ borderBottom: '1px solid var(--border)', background: index % 2 === 1 ? 'var(--bg3)' : undefined }}>
                        <td style={{ padding: 10, fontSize: 13 }}>{formatSemesterLabel(record.semester)}</td>
                        <td style={{ padding: 10, fontSize: 13, color: 'var(--text2)' }}>{Number(record.attemptedCredits || 0)}</td>
                        <td style={{ padding: 10, fontSize: 13, color: 'var(--text2)' }}>{Number(record.earnedCredits || 0)}</td>
                        <td style={{ padding: 10 }}>
                          <strong style={{ color: isBest ? 'var(--green)' : 'var(--accent)', fontFamily: 'DM Sans' }}>{record.semesterGPA.toFixed(2)}</strong>
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
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'DM Sans', color: 'var(--accent)' }}>{gpaSummary.average != null ? gpaSummary.average.toFixed(2) : (gpaLoaded ? '-' : '...')}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>누적 평점</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'DM Sans', color: 'var(--green)' }}>{gpaSummary.best ? gpaSummary.best.semesterGPA.toFixed(2) : (gpaLoaded ? '-' : '...')}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>최고 학기</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'DM Sans', color: 'var(--purple)' }}>{gpaSummary.average != null ? gpaSummary.totalCredits : (gpaLoaded ? '-' : '...')}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>총 취득 학점</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* 자격증 / 대외활동 / 어학성적 / 스킬 탭 */}
        <div className="card">
          <div className="tabs" style={{ marginBottom: 14 }}>
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {activeTab === 'cert' && (
            <div>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">🏅 자격증</span>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => { window.location.href = '/career' }}>+ 추가</button>
              </div>
              {!careerLoaded ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>불러오는 중...</div>
              ) : certs.length === 0 ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>등록된 자격증이 없습니다.</div>
              ) : (
                certs.map((c) => (
                  <div className="cert-item" key={c._id || c.certificationId?._id}>
                    <div className="cert-icon">📋</div>
                    <div className="cert-name">{c.certificationId?.name}</div>
                    <span className="badge badge-green">{c.status === 'acquired' ? '취득' : c.status === 'wish' ? '관심' : '목표'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>
                      {c.status === 'acquired' && c.earnedDate
                        ? fmtYM(c.earnedDate)
                        : c.targetDate ? `목표 ${fmtYM(c.targetDate)}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">🏆 수상 및 대외활동</span>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => openSpecModal('award', null)}>+ 수상경력 추가</button>
              </div>
              {!specsLoaded ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>불러오는 중...</div>
              ) : specs.awards.length === 0 ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>등록된 수상경력이 없습니다.</div>
              ) : (
                specs.awards.map((a) => {
                  const meta = [a.organizer, a.rank, fmtYM(a.acquiredDate)].filter(Boolean).join(' · ')
                  return (
                    <div className="activity-item" style={{ cursor: 'pointer' }} key={a._id} onClick={() => openSpecModal('award', a)}>
                      <div className="activity-dot" style={{ background: 'var(--accent)' }} />
                      <div className="activity-body"><div className="activity-title">{a.name}</div><div className="activity-meta">{meta}</div></div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'lang' && (
            <div>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">🌍 어학 성적</span>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => openSpecModal('language', null)}>+ 추가</button>
              </div>
              {!specsLoaded ? (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border2)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>+ 성적 추가하기 (IELTS, TOEFL, HSK 등)</div>
                </div>
              ) : specs.languages.length === 0 ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>등록된 어학성적이 없습니다.</div>
              ) : (
                specs.languages.map((l) => {
                  const meta = LANG_LABEL[l.language] || LANG_LABEL.other
                  const title = l.testName || meta.name
                  const extra = [l.score, fmtYM(l.acquiredDate)].filter(Boolean).join(' · ')
                  return (
                    <div className="cert-item" style={{ cursor: 'pointer' }} key={l._id} onClick={() => openSpecModal('language', l)}>
                      <div className="cert-icon" style={{ background: meta.bg }}>{meta.flag}</div>
                      <div className="cert-name">{title}</div>
                      <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>{extra}</span>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'skill' && (
            <div>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">🛠 보유 스킬</span>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => openSpecModal('skill', null)}>+ 추가</button>
              </div>
              {!specsLoaded ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>불러오는 중...</div>
              ) : specs.skills.length === 0 ? (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>등록된 스킬이 없습니다.</div>
              ) : (
                specs.skills.map((s) => (
                  <div className="cert-item" style={{ cursor: 'pointer' }} key={s._id} onClick={() => openSpecModal('skill', s)}>
                    <div className="cert-icon">🛠</div>
                    <div className="cert-name">{s.name}</div>
                    <span className={`badge ${SKILL_LEVEL_BADGE[s.level] || 'badge-blue'}`} style={{ marginLeft: 'auto' }}>{s.level}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* AI 진단 요약 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🩺 AI 진로 진단 요약</span>
            {diagnosis.status === 'done' && diagnosis.data.jobTitle && (
              <span className="badge badge-blue">{diagnosis.data.jobTitle}</span>
            )}
          </div>
          {diagnosis.status === 'loading' && (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>진단 정보를 불러오는 중...</div>
          )}
          {diagnosis.status === 'none' && (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
              아직 생성된 진단이 없습니다.<br />
              <a href="/career/diagnosis" className="btn btn-accent btn-sm" style={{ marginTop: 10, display: 'inline-block' }}>진단 생성하러 가기</a>
            </div>
          )}
          {diagnosis.status === 'pending' && (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>진단을 준비하는 중입니다.</div>
          )}
          {diagnosis.status === 'error' && (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>진단 정보를 불러오지 못했습니다.</div>
          )}
          {diagnosis.status === 'done' && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{diagnosis.data.overview || ''}</p>
              <a href="/career/diagnosis" className="card-action" style={{ display: 'inline-block', marginTop: 8 }}>진단 전체 보기 →</a>
            </>
          )}
        </div>
      </div>

      {/* 경험 / 활동 / 교육 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🗂 경험 / 활동 / 교육</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSpecModal('experience', null)}>+ 추가</button>
          </div>
        </div>

        {!specsLoaded ? (
          <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>불러오는 중...</div>
        ) : specs.experiences.length === 0 ? (
          <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>등록된 경험/활동이 없습니다.</div>
        ) : (
          specs.experiences.map((e, i) => {
            const last = i === specs.experiences.length - 1
            const period = [fmtYM(e.startDate), fmtYM(e.endDate)].filter(Boolean).join(' ~ ')
            const sub = [e.host, e.location].filter(Boolean).join(' · ')
            const dot = i % 2 === 0 ? 'var(--accent)' : 'var(--purple)'
            return (
              <div className="exp-item" style={{ cursor: 'pointer', borderBottom: last ? 'none' : undefined }} key={e._id} onClick={() => openSpecModal('experience', e)}>
                <div className="exp-dot" style={{ background: dot }} />
                <div className="exp-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div className="exp-title">{e.title}</div>
                  </div>
                  {sub && <div className="exp-meta">{sub}</div>}
                  {period && <div className="exp-period">{period}</div>}
                  {e.note && <div className="exp-ach" style={{ marginTop: 8 }}>{e.note}</div>}
                </div>
              </div>
            )
          })
        )}
      </div>

      <SpecModal
        open={specModal.open}
        config={specModal.type ? SPEC_CONFIGS[specModal.type] : null}
        editingItem={specModal.item}
        onClose={closeSpecModal}
        onSaved={loadSpecs}
      />
    </>
  )
}

export default MyStatus
