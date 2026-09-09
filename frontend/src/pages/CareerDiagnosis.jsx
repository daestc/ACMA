import { useEffect, useState } from 'react'
import { callApi, pollUntilDone, ScoreBreakdown, MissingList, AllBlockedBanner } from '../components/CareerAi/careerAiUtils'
import { useNavigate } from 'react-router-dom'

const SEVERITY_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' }
const ACTION_TYPE_LABEL = { cert: '자격증', project: '프로젝트', course: '과목', language: '어학', experience: '경험', none: '기타' }

function gapScheduleBadge(gap) {
  if (gap.actionType === 'cert' && gap.dDay != null) {
    return <span className="badge badge-red" style={{ marginLeft: 6 }}>{gap.examType || '시험'} D-{gap.dDay}</span>
  }
  if (gap.relatedCertName) {
    return <span className="badge badge-amber" style={{ marginLeft: 6 }}>관련 자격증: {gap.relatedCertName}(일정 확인 필요)</span>
  }
  return null
}

function GraduationCard({ graduation }) {
  if (!graduation?.hasData) return null
  const r = graduation.remaining || {}
  const isTotal = graduation.horizon === 'total'

  const suggested = graduation.suggestedFields?.length > 0 && (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>이런 분야를 채우면 좋습니다</div>
      {graduation.suggestedFields.map((f, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <span className="badge badge-purple" style={{ marginRight: 6 }}>{f.field}</span>
          {f.reason && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{f.reason}</span>}
        </div>
      ))}
    </div>
  )

  const pendingLabel = isTotal ? '남은 졸업 요건' : (graduation.horizon === 'semester' ? '졸업 전까지 준비할 것' : '남은 졸업 요건')
  const pending = graduation.pendingRequirements?.length > 0 && (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{pendingLabel}</div>
      {graduation.pendingRequirements.map((req, i) => <span className="badge badge-amber" style={{ marginRight: 6, marginBottom: 4, display: 'inline-block' }} key={i}>{req}</span>)}
    </div>
  )

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title">{isTotal ? '🎓 졸업까지 남은 학점' : '🎓 다음 학기 이수 계획'}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, marginTop: 8 }}>
        {isTotal ? (
          <>
            <strong>총 {r.total ?? 0}학점</strong>{graduation.estimatedSemesters != null && ` · 약 ${graduation.estimatedSemesters}학기`}
            <div>전공필수 {r.majorRequired ?? 0} · 전공선택 {r.majorElective ?? 0} · 교양필수 {r.generalRequired ?? 0} · 교양선택 {r.generalElective ?? 0}</div>
          </>
        ) : (
          <>
            <strong>채울 수 있는 학점 [전공선택 {r.majorElective ?? 0}학점 · 교양선택 {r.generalElective ?? 0}학점]</strong>
            <div>남은 요건(선택 여지 없음): 전공필수 {r.majorRequired ?? 0}학점 · 교양필수 {r.generalRequired ?? 0}학점</div>
          </>
        )}
        {suggested}
        {pending}
      </div>
    </div>
  )
}

function CareerDiagnosis() {
  const navigate = useNavigate()
  const [scores, setScores] = useState(null) // {total, breakdown, blockers, missing, ready, currentJob}
  const [currentTargetJob, setCurrentTargetJob] = useState(null)
  const [section, setSection] = useState('empty') // 'empty' | 'pending' | 'failed' | 'result'
  const [doc, setDoc] = useState(null)
  const [failedMsg, setFailedMsg] = useState('생성에 실패했습니다.')
  const [diagnosisId, setDiagnosisId] = useState(null)
  const [gapButtonState, setGapButtonState] = useState({}) // { [gapId]: 'idle'|'added'|'duplicate'|'pending' }

  async function loadReadiness() {
    const data = await callApi('/ai/diagnosis/scores')
    if (data.httpStatus === 200) {
      setCurrentTargetJob(data.currentJob || null)
      setScores(data)
    }
  }

  async function loadLatestDiagnosis() {
    const data = await callApi('/ai/diagnosis/latest')
    if (data.httpStatus === 404) {
      setSection('empty')
      return
    }
    if (data.status === 'done' && data.data) {
      setDiagnosisId(data.data._id)
      setDoc(data.data)
      setSection('result')
      return
    }
    setSection('empty')
  }

  function startPolling(id) {
    setSection('pending')
    pollUntilDone(`/ai/diagnosis/${id}`, null, (data) => {
      if (data.status === 'done' && data.data) {
        setDiagnosisId(data.data._id)
        setDoc(data.data)
        setSection('result')
      } else {
        setFailedMsg(data.errorMessage || '생성에 실패했습니다.')
        setSection('failed')
      }
      loadReadiness()
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadReadiness()
      if (cancelled) return
      loadLatestDiagnosis()
    })()
    return () => { cancelled = true }
  }, [])

  async function generateDiagnosis() {
    const data = await callApi('/ai/diagnosis', { method: 'POST' })
    if (data.httpStatus === 202 && data.id) {
      setDiagnosisId(data.id)
      startPolling(data.id)
    } else if (data.httpStatus === 400) {
      alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`)
    } else if (data.httpStatus === 409) {
      alert('이미 생성 중인 진단이 있습니다.')
    } else {
      alert(data.message || '요청 처리에 실패했습니다.')
    }
  }

  async function addGapToPlan(gapId) {
    if (!diagnosisId) return
    setGapButtonState((prev) => ({ ...prev, [gapId]: 'pending' }))
    const data = await callApi(`/ai/diagnosis/${diagnosisId}/gaps/${gapId}/to-plan`, { method: 'POST' })

    if (data.httpStatus === 200) {
      setGapButtonState((prev) => ({ ...prev, [gapId]: 'added' }))
    } else if (data.httpStatus === 404) {
      alert('먼저 이번 주 계획을 생성해 주세요.')
      setGapButtonState((prev) => ({ ...prev, [gapId]: 'idle' }))
      if (confirm('주간 계획 페이지로 이동할까요?')) navigate('/career/plan')
    } else if (data.httpStatus === 409 && data.reason === 'job_mismatch') {
      alert(data.message || '목표 직무가 변경되어 추가할 수 없습니다.')
      setGapButtonState((prev) => ({ ...prev, [gapId]: 'idle' }))
    } else if (data.httpStatus === 409) {
      setGapButtonState((prev) => ({ ...prev, [gapId]: 'duplicate' }))
    } else {
      alert(data.message || '추가에 실패했습니다.')
      setGapButtonState((prev) => ({ ...prev, [gapId]: 'idle' }))
    }
  }

  const isStale = doc && doc.jobCode && currentTargetJob?.jobCode && doc.jobCode !== currentTargetJob.jobCode

  return (
    <>
      <AllBlockedBanner />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">준비도</span>
          <span className="badge badge-blue">총점 {scores?.total ?? 0}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ScoreBreakdown breakdown={scores?.breakdown} />
        </div>
        {scores?.blockers?.length > 0 && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
            {scores.blockers.map((b, i) => <div key={i}>⚠️ {b}</div>)}
          </div>
        )}
        <MissingList missing={(scores?.missing || []).filter((m) => m.key !== 'graduation')} />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" className="btn btn-accent" disabled={!scores?.ready} title={scores?.ready ? '' : '목표 직무를 먼저 설정해주세요.'} onClick={generateDiagnosis}>진단 생성하기</button>
        </div>
      </div>

      {section === 'pending' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--accent)' }}>진단을 생성하는 중입니다... (최대 1분 소요)</div>
        </div>
      )}

      {section === 'failed' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--red)' }}>{failedMsg}</div>
        </div>
      )}

      {section === 'empty' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🩺</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>아직 생성된 진단이 없습니다</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>위에서 목표 직무를 설정한 뒤 생성해 보세요.</p>
        </div>
      )}

      {section === 'result' && doc && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">{doc.jobTitle ? `목표 직무: ${doc.jobTitle}` : '진로 진단'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={generateDiagnosis}>다시 생성</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>{doc.overview || ''}</p>
            {isStale && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
                ⚠️ 이 진단은 '{doc.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '{currentTargetJob.title}'입니다. 다시 생성해 주세요.
              </div>
            )}
          </div>

          <GraduationCard graduation={doc.graduation} />

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">강점</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {(doc.strengths || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>아직 뚜렷한 강점 항목이 없습니다.</div>
              ) : doc.strengths.map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <strong style={{ fontSize: 13 }}>{s.title}</strong>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>{s.body}</p>
                  {(s.evidence || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {s.evidence.map((e, j) => <span className="evidence-chip" style={{ marginRight: 4, marginTop: 4 }} key={j}>{e}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">부족한 점</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {(doc.gaps || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>부족한 점이 확인되지 않았습니다.</div>
              ) : doc.gaps.map((gap) => {
                const btnState = gapButtonState[gap._id] || 'idle'
                const btnText = btnState === 'added' ? '추가됨' : btnState === 'duplicate' ? '이미 추가됨' : '이번 주 계획에 추가'
                const btnDisabled = btnState === 'added' || btnState === 'duplicate' || btnState === 'pending'
                return (
                  <div className="card" style={{ padding: '14px 16px' }} key={gap._id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${SEVERITY_BADGE[gap.severity] || 'badge-blue'}`}>{gap.severity}</span>
                        <span className="badge badge-purple">{ACTION_TYPE_LABEL[gap.actionType] || gap.actionType}</span>
                        <strong style={{ fontSize: 13 }}>{gap.item}</strong>
                        {gapScheduleBadge(gap)}
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={btnDisabled} onClick={() => addGapToPlan(gap._id)}>{btnText}</button>
                    </div>
                    {gap.reason && <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.6 }}>{gap.reason}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CareerDiagnosis
