import { useEffect, useState } from 'react'

export const POLL_INTERVAL_MS = 2000
export const POLL_TIMEOUT_MS = 60000

export async function callApi(url, options = {}) {
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    let body
    try {
      body = await res.json()
    } catch {
      body = { parseError: true, statusText: res.statusText }
    }
    return { httpStatus: res.status, ...body }
  } catch (err) {
    return { httpStatus: 0, parseError: true, message: err.message }
  }
}

export function pollUntilDone(url, onUpdate, onDone) {
  const startedAt = Date.now()
  const timer = setInterval(async () => {
    const data = await callApi(url)
    if (onUpdate) onUpdate(data)
    const finished = data.status === 'done' || data.status === 'failed'
    const timedOut = Date.now() - startedAt > POLL_TIMEOUT_MS
    if (finished || timedOut) {
      clearInterval(timer)
      if (onDone) onDone(data, timedOut && !finished)
    }
  }, POLL_INTERVAL_MS)
  return timer
}

export function todayKstDateString() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function formatKstDate(isoString) {
  if (!isoString) return '-'
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`
}

export function fillClassForScore(score) {
  if (score >= 70) return 'fill-green'
  if (score >= 40) return 'fill-blue'
  if (score > 0) return 'fill-amber'
  return 'fill-red'
}

export function ScoreBreakdown({ breakdown }) {
  return (
    <div className="grid-2" style={{ gap: '0 24px' }}>
      {(breakdown || []).map((row) => (
        <div className="progress-wrap" key={row.key}>
          <div className="progress-header">
            <span className="progress-label">{row.label}</span>
            <span className="progress-value">{row.detail || '-'}</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${fillClassForScore(row.score)}`} style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const IMPACT_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' }

export function MissingList({ missing }) {
  if (!missing || !missing.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {missing.map((item) => (
        <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${IMPACT_BADGE[item.impact] || 'badge-blue'}`}>{item.label}</span>
            {item.reason && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{item.reason}</span>}
          </div>
          {item.link && <a className="btn btn-ghost btn-sm" href={item.link}>채우러 가기</a>}
        </div>
      ))}
    </div>
  )
}

export function AllBlockedBanner() {
  const [state, setState] = useState(null) 

  useEffect(() => {
    let cancelled = false
    callApi('/ai/readiness-summary').then((data) => {
      if (cancelled) return
      if (data.httpStatus !== 200 || !data.allBlocked) {
        setState(null)
        return
      }
      setState({ reason: (data.commonBlockers || [])[0] || '목표 직무를 설정해 주세요' })
    })
    return () => { cancelled = true }
  }, [])

  if (!state) return null
  return (
    <div className="card" style={{ background: 'var(--amber-bg)', borderColor: 'var(--amber)', marginBottom: 16 }}>
      <span style={{ color: 'var(--amber)' }}>⚠️ 주간계획·포트폴리오·진단 3개 AI 기능이 모두 같은 이유로 막혀 있습니다 — {state.reason}</span>
      {' '}
      <a href="/career" className="btn btn-accent btn-sm">직무 설정하러 가기</a>
    </div>
  )
}
