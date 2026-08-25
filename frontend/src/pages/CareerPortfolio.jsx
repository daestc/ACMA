import { useEffect, useState } from 'react'
import { callApi, pollUntilDone, ScoreBreakdown, MissingList, AllBlockedBanner } from '../components/CareerAi/careerAiUtils'

function CareerPortfolio() {
  const [readiness, setReadiness] = useState(null) // {total, breakdown, blockers, missing, ready, currentJob}
  const [currentTargetJob, setCurrentTargetJob] = useState(null)
  const [section, setSection] = useState('empty') // 'empty' | 'pending' | 'failed' | 'result'
  const [doc, setDoc] = useState(null)
  const [failedMsg, setFailedMsg] = useState('생성에 실패했습니다.')
  const [portfolioId, setPortfolioId] = useState(null)

  async function loadReadiness() {
    const data = await callApi('/ai/portfolio/readiness')
    if (data.httpStatus === 200) {
      setCurrentTargetJob(data.currentJob || null)
      setReadiness(data)
    }
  }

  async function loadLatestPortfolio() {
    const data = await callApi('/ai/portfolio/latest')
    if (data.httpStatus === 404) {
      setSection('empty')
      return
    }
    if (data.status === 'done' && data.data) {
      setPortfolioId(data.data._id)
      setDoc(data.data)
      setSection('result')
      return
    }
    setSection('empty')
  }

  function startPolling(id) {
    setSection('pending')
    pollUntilDone(`/ai/portfolio/${id}`, null, (data) => {
      if (data.status === 'done' && data.data) {
        setPortfolioId(data.data._id)
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
      loadLatestPortfolio()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generatePortfolio() {
    const data = await callApi('/ai/portfolio', { method: 'POST' })
    if (data.httpStatus === 202 && data.id) {
      setPortfolioId(data.id)
      startPolling(data.id)
    } else if (data.httpStatus === 400) {
      alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`)
    } else if (data.httpStatus === 409) {
      alert('이미 생성 중인 포트폴리오가 있습니다.')
    } else {
      alert(data.message || '요청 처리에 실패했습니다.')
    }
  }

  const isStale = doc && doc.jobCode && currentTargetJob?.jobCode && doc.jobCode !== currentTargetJob.jobCode

  return (
    <>
      <AllBlockedBanner />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">준비도</span>
          <span className="badge badge-blue">총점 {readiness?.total ?? 0}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ScoreBreakdown breakdown={readiness?.breakdown} />
        </div>
        {readiness?.blockers?.length > 0 && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
            {readiness.blockers.map((b, i) => <div key={i}>⚠️ {b}</div>)}
          </div>
        )}
        <MissingList missing={readiness?.missing} />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" className="btn btn-accent" disabled={!readiness?.ready} title={readiness?.ready ? '' : '준비도 요건을 먼저 채워주세요.'} onClick={generatePortfolio}>포트폴리오 생성하기</button>
        </div>
      </div>

      {section === 'pending' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--accent)' }}>포트폴리오를 생성하는 중입니다... (최대 1분 소요)</div>
        </div>
      )}

      {section === 'failed' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--red)' }}>{failedMsg}</div>
        </div>
      )}

      {section === 'empty' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💼</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>아직 생성된 포트폴리오가 없습니다</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>위에서 준비도를 채운 뒤 생성해 보세요.</p>
        </div>
      )}

      {section === 'result' && doc && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">{doc.jobTitle ? `목표 직무: ${doc.jobTitle}` : '진로 포트폴리오'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isStale && <a href={`/ai/portfolio/${portfolioId}/print`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">🖨 인쇄용으로 보기</a>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={generatePortfolio}>다시 생성</button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>{doc.summary || ''}</p>
            {isStale && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
                ⚠️ 이 포트폴리오는 '{doc.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '{currentTargetJob.title}'입니다. 다시 생성해 주세요.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(doc.sections || []).length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text2)', fontSize: 13 }}>생성된 섹션이 없습니다.</div>
            ) : doc.sections.map((s, i) => (
              <div className="card" key={i}>
                <div className="card-title" style={{ marginBottom: 8 }}>{s.heading}</div>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{s.body}</p>
                {(s.evidence || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {s.evidence.map((e, j) => <span className="evidence-chip" style={{ marginRight: 4, marginTop: 4 }} key={j}>{e}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default CareerPortfolio
