import { useEffect, useRef, useState } from 'react'
import { callApi, pollUntilDone, formatKstDate, todayKstDateString, fillClassForScore, AllBlockedBanner } from '../components/CareerAi/careerAiUtils'

const CATEGORY_LABEL = { cert: '자격증', course: '과목', skill: '스킬', project: '프로젝트', language: '어학', graduation: '졸업요건', other: '기타' }
const CATEGORY_BADGE = { cert: 'badge-purple', course: 'badge-blue', skill: 'badge-green', project: 'badge-amber', language: 'badge-blue', graduation: 'badge-red', other: 'badge-blue' }
const ACADEMIC_PHASE_LABEL = { normal: '평소', midterm: '중간고사 기간', final: '기말고사 기간', vacation: '방학', registration: '수강신청 기간' }
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
// 지난주 돌아보기: 완료한 항목은 체감 난도, 미완료 항목은 이유를 고른다(모두 선택 사항)
const DIFFICULTY_OPTIONS = [['easy', '쉬움'], ['normal', '적당'], ['hard', '어려움']]
const MISS_OPTIONS = [['time', '시간 부족'], ['hard', '난도 높음'], ['other', '다른 일정']]
const REVIEW_STATE_LABEL = { done: '완료', partial: '일부만 완료', missed: '못 함' }

function reviewSummaryText(review) {
  const s = review.summary
  if (!s) return '지난 계획을 돌아봅니다.'
  const basis = s.basis === 'hours' ? ` (시간 기준: 완료 ${s.completedHours}h / 계획 ${s.plannedHours}h)` : ' (항목 개수 기준)'
  return `지난 계획(${formatKstDate(review.weekStart)} ~ ${formatKstDate(review.weekEnd)})의 달성률은 ${Math.round(s.timeRate * 100)}%입니다${basis}. 항목별로 한 번씩 골라 주세요.`
}

function pctBadgeClass(pct) {
  if (pct >= 70) return 'badge-green'
  if (pct >= 40) return 'badge-blue'
  if (pct > 0) return 'badge-amber'
  return 'badge-red'
}

function CareerPlan() {
  const [section, setSection] = useState('empty')
  const [plan, setPlan] = useState(null)
  const [failedMsg, setFailedMsg] = useState('생성에 실패했습니다.')
  const [weekStartInput, setWeekStartInput] = useState(todayKstDateString())
  const [currentTargetJob, setCurrentTargetJob] = useState(null) // {jobCode, title} | null
  const [days, setDays] = useState(null)

  // 하루 학습 가능 시간(사용자 설정)과 지난주 돌아보기
  const [dailyHours, setDailyHours] = useState('')
  const [dailyHoursDefault, setDailyHoursDefault] = useState(6)
  const [settingsMsg, setSettingsMsg] = useState(null) // { ok, text }
  const [review, setReview] = useState(null) // { weekStart, data, answers: { [planItemIndex]: value } }

  const [statsBody, setStatsBody] = useState(null)
  const [history, setHistory] = useState(null)

  const currentPlanIdRef = useRef(null)
  const pollTimerRef = useRef(null)

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  async function loadDailyChecklist(planId) {
    const data = await callApi(`/ai/weekly-plan/${planId}/checklist`)
    if (data.httpStatus !== 200 || !data.success) {
      setDays(null)
      return
    }
    setDays(data.days || [])
  }

  function renderPlanDoc(doc) {
    currentPlanIdRef.current = doc._id
    setPlan(doc)
    setSection('plan')
    loadDailyChecklist(doc._id)
  }

  function startPolling() {
    if (!currentPlanIdRef.current) return
    setSection('pending')
    stopPolling()
    pollTimerRef.current = pollUntilDone(`/ai/weekly-plan/${currentPlanIdRef.current}`, null, (data) => {
      if (data.status === 'done' && data.data) {
        renderPlanDoc(data.data)
      } else {
        setFailedMsg(data.errorMessage || '생성에 실패했습니다.')
        setSection('failed')
      }
    })
  }

  async function loadCurrentPlan() {
    const data = await callApi('/ai/weekly-plan/current')
    if (data.httpStatus === 404) {
      setSection('empty')
      return
    }
    if (data.status === 'pending') {
      currentPlanIdRef.current = data.id || currentPlanIdRef.current
      startPolling()
      return
    }
    if (data.status === 'failed') {
      setFailedMsg(data.errorMessage || '생성에 실패했습니다.')
      setSection('failed')
      return
    }
    if (data.status === 'done' && data.data) {
      renderPlanDoc(data.data)
      return
    }
    setSection('empty')
  }

  async function loadCurrentTargetJob() {
    const data = await callApi('/ai/portfolio/readiness')
    setCurrentTargetJob(data.currentJob || null)
  }

  async function loadStatsAndHistory() {
    const [statsData, historyData] = await Promise.all([
      callApi('/ai/weekly-plan/stats'),
      callApi('/ai/weekly-plan/history?limit=12'),
    ])
    if (statsData.httpStatus !== 200 || !statsData.totalWeeks) {
      setStatsBody(null)
      return
    }
    setStatsBody(statsData)
    setHistory(historyData.httpStatus === 200 ? historyData.history || [] : null)
  }

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        await loadCurrentTargetJob()
        if (cancelled) return
        loadDailyHoursSetting()
        loadCurrentPlan()
        loadStatsAndHistory()
      })()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [])

  async function loadDailyHoursSetting() {
    const data = await callApi('/ai/weekly-plan/settings')
    if (data.httpStatus !== 200) return
    setDailyHours(data.dailyStudyHours == null ? '' : String(data.dailyStudyHours))
    setDailyHoursDefault(data.defaultHours ?? 6)
  }

  async function saveDailyHours() {
    const data = await callApi('/ai/weekly-plan/settings', { method: 'POST', body: JSON.stringify({ dailyStudyHours: dailyHours }) })
    if (data.httpStatus === 200) {
      setSettingsMsg({
        ok: true,
        text: data.dailyStudyHours
          ? `하루 최대 ${data.dailyStudyHours}시간으로 저장했습니다. 다음에 만드는 계획부터 적용됩니다.`
          : `기본값(${data.defaultHours}시간)으로 되돌렸습니다.`,
      })
    } else {
      setSettingsMsg({ ok: false, text: data.message || '저장하지 못했습니다.' })
    }
  }

  // 돌아볼 지난 계획이 있고 아직 답하지 않았으면 먼저 물어본다(건너뛰기 가능).
  async function generatePlan() {
    const weekStart = weekStartInput || todayKstDateString()
    const data = await callApi(`/ai/weekly-plan/review?weekStart=${encodeURIComponent(weekStart)}`)
    if (data.httpStatus === 200 && data.available && !data.reviewedAt) {
      const answers = {}
      data.items.forEach((item) => {
        const prior = item.state === 'done' ? item.difficulty : item.missReason
        if (prior) answers[item.planItemIndex] = prior
      })
      setReview({ weekStart, data, answers })
      setSection('review')
      return
    }
    await requestGeneration(weekStart)
  }

  function pickReview(planItemIndex, value) {
    setReview((prev) => {
      const answers = { ...prev.answers }
      if (answers[planItemIndex] === value) delete answers[planItemIndex]
      else answers[planItemIndex] = value
      return { ...prev, answers }
    })
  }

  function cancelReview() {
    setReview(null)
    loadCurrentPlan()
  }

  async function skipReviewAndGenerate() {
    const weekStart = review?.weekStart || todayKstDateString()
    setReview(null)
    await requestGeneration(weekStart)
  }

  async function saveReviewAndGenerate() {
    if (!review) return
    const items = review.data.items
      .filter((item) => review.answers[item.planItemIndex])
      .map((item) => (item.state === 'done'
        ? { planItemIndex: item.planItemIndex, difficulty: review.answers[item.planItemIndex] }
        : { planItemIndex: item.planItemIndex, missReason: review.answers[item.planItemIndex] }))
    if (items.length > 0) {
      const saved = await callApi(`/ai/weekly-plan/${review.data.planId}/review`, { method: 'POST', body: JSON.stringify({ items }) })
      if (saved.httpStatus !== 200) {
        alert('답변을 저장하지 못했습니다. 건너뛰고 생성하거나 잠시 후 다시 시도해주세요.')
        return
      }
    }
    const weekStart = review.weekStart
    setReview(null)
    await requestGeneration(weekStart)
  }

  async function requestGeneration(weekStart) {
    const data = await callApi('/ai/weekly-plan', { method: 'POST', body: JSON.stringify({ weekStart }) })
    if (data.httpStatus === 202 && data.id) {
      currentPlanIdRef.current = data.id
      startPolling()
    } else if (data.httpStatus === 400) {
      alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`)
    } else if (data.httpStatus === 409) {
      alert('이미 생성 중인 계획이 있습니다.')
    } else {
      alert(data.message || '요청 처리에 실패했습니다.')
    }
  }

  async function redistribute() {
    if (!currentPlanIdRef.current) return
    const data = await callApi(`/ai/weekly-plan/${currentPlanIdRef.current}/distribute`, { method: 'POST' })
    if (data.httpStatus === 200) {
      loadCurrentPlan()
    } else {
      alert(data.message || '재분배에 실패했습니다.')
    }
  }

  async function toggleChecklistItem(itemId) {
    const data = await callApi(`/ai/weekly-plan/checklist/${itemId}/toggle`, { method: 'POST' })
    if (data.httpStatus === 200 && currentPlanIdRef.current) {
      loadDailyChecklist(currentPlanIdRef.current)
    }
  }

  const generateDisabled = !currentTargetJob
  const generateTitle = generateDisabled ? '목표 직무를 먼저 설정해주세요.' : ''
  const today = todayKstDateString()

  return (
    <>
      <AllBlockedBanner />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>하루 학습 가능 시간</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>시간표의 빈 시간 중 하루에 최대 이만큼만 계획에 씁니다. 비우면 기본 {dailyHoursDefault}시간입니다.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" className="input-field" min="1" max="12" step="0.5" placeholder={String(dailyHoursDefault)} style={{ width: 90 }} value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>시간</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveDailyHours}>저장</button>
          </div>
        </div>
        {settingsMsg && <div style={{ fontSize: 12, marginTop: 8, color: settingsMsg.ok ? 'var(--green)' : 'var(--red)' }}>{settingsMsg.text}</div>}
      </div>

      {section === 'review' && review && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">지난주 돌아보기 <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text2)' }}>(선택)</span></div>
          <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: '6px 0 12px' }}>{reviewSummaryText(review.data)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {review.data.items.map((item) => {
              const isDone = item.state === 'done'
              const options = isDone ? DIFFICULTY_OPTIONS : MISS_OPTIONS
              return (
                <div key={item.planItemIndex} style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>{item.title}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{REVIEW_STATE_LABEL[item.state]} · {item.completedHours}h / {item.plannedHours}h</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', margin: '8px 0 6px' }}>{isDone ? '체감 난도는 어땠나요?' : '왜 다 못 했나요?'}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {options.map(([value, label]) => (
                      <button key={value} type="button" className={`btn btn-sm ${review.answers[item.planItemIndex] === value ? 'btn-accent' : 'btn-ghost'}`} onClick={() => pickReview(item.planItemIndex, value)}>{label}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 12, lineHeight: 1.5 }}>답변은 이번 주 계획의 시간을 조정하는 데 쓰입니다. 건너뛰어도 계획은 만들어집니다.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelReview}>취소</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={skipReviewAndGenerate}>건너뛰고 생성</button>
            <button type="button" className="btn btn-accent btn-sm" onClick={saveReviewAndGenerate}>저장하고 생성</button>
          </div>
        </div>
      )}

      {section === 'empty' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>이번 주 계획이 아직 없습니다</div>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>현재 학업·스펙 데이터를 바탕으로 이번 주 학습 계획을 자동으로 만들어드립니다.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <input type="date" className="input-field" value={weekStartInput} onChange={(e) => setWeekStartInput(e.target.value)} title="계획을 만들 주에 속하는 아무 날짜나 선택 (기본값: 오늘 = 이번 주)" />
            <button type="button" className="btn btn-accent" disabled={generateDisabled} title={generateTitle} onClick={generatePlan}>계획 생성하기</button>
          </div>
        </div>
      )}

      {section === 'pending' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--accent)' }}>계획을 생성하는 중입니다... (최대 1분 소요)</div>
        </div>
      )}

      {section === 'failed' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ color: 'var(--red)' }}>{failedMsg}</div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={generatePlan}>다시 시도</button>
        </div>
      )}

      {section === 'plan' && plan && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div>
                <span className="card-title">{formatKstDate(plan.weekStart)} ~ {formatKstDate(plan.weekEnd)}</span>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>학사 상태: {ACADEMIC_PHASE_LABEL[plan.computed?.academicPhase] || plan.computed?.academicPhase || '-'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={redistribute}>재분배</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={generateDisabled} title={generateTitle} onClick={generatePlan}>다시 생성</button>
              </div>
            </div>

            {plan.distribution?.notices?.length > 0 && (
              <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                {plan.distribution.notices.map((n, i) => <div key={i}>ℹ️ {n}</div>)}
              </div>
            )}
            {plan.distribution?.errors?.length > 0 && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                {plan.distribution.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
              </div>
            )}

            {(() => {
              const total = plan.computed?.availableHoursTotal || 0
              const allocated = plan.computed?.allocatedHours || 0
              const pct = total ? Math.min(100, Math.round((allocated / total) * 100)) : 0
              return (
                <div className="progress-wrap" style={{ marginTop: 14 }}>
                  <div className="progress-header">
                    <span className="progress-label">배정 시간</span>
                    <span className="progress-value">{allocated}h / {total}h</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill fill-blue" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })()}

            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 14 }}>{plan.goal || ''}</p>

            {plan.adjustment && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>이번 주 계획 조정</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>하루 최대 {plan.computed?.dailyHoursCap || 6}시간 · 총 시간 한도 {plan.adjustment.hoursLimit}h</div>
                {plan.adjustment.applied
                  ? plan.adjustment.reasons.map((r, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>• {r}</div>)
                  : <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>조정 없음 — 지난 기록과 돌아보기 답변에서 조정할 내용이 없었습니다.</div>}
              </div>
            )}

            {plan.jobCode && currentTargetJob?.jobCode && plan.jobCode !== currentTargetJob.jobCode && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
                ⚠️ 이 계획은 '{plan.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '{currentTargetJob.title}'입니다. 다시 생성하면 반영됩니다.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(plan.items || []).length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text2)', fontSize: 13 }}>배치된 항목이 없습니다.</div>
            ) : plan.items.map((item) => (
              <div className="card" key={item._id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${CATEGORY_BADGE[item.category] || 'badge-blue'}`}>{CATEGORY_LABEL[item.category] || item.category}</span>
                    {item.isDeadline && <span className="badge badge-red">마감 {formatKstDate(item.dueDate)}</span>}
                    <strong>{item.title}</strong>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{item.estimatedHours}h · 우선순위 {item.priority}</span>
                </div>
                {item.reason && <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.6 }}>{item.reason}</p>}
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">일별 보기</div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 10, minWidth: 820 }}>
                {days === null ? (
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>일별 계획을 불러오지 못했습니다.</div>
                ) : days.map((day, index) => {
                  const [, month, dayOfMonth] = day.date.split('-')
                  const hasItems = (day.items || []).length > 0
                  const isEmptyPast = !hasItems && day.date < today
                  const sortedItems = [...(day.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  return (
                    <div key={day.date} style={{ flex: '0 0 110px', opacity: isEmptyPast ? 0.45 : 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{month}/{dayOfMonth} ({DAY_LABELS[index]})</div>
                      {!hasItems ? (
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>-</div>
                      ) : sortedItems.map((item) => (
                        <div key={item._id} style={{ fontSize: 12, marginBottom: 4, color: item.isCompleted ? 'var(--text2)' : undefined, textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                          <span style={{ cursor: 'pointer' }} onClick={() => toggleChecklistItem(item._id)}>{item.isCompleted ? '✅' : '⬜'}</span> {item.content}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">계획 기록 &amp; 통계</div>
        {!statsBody ? (
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>아직 완료된 주간 계획이 없습니다.</div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120, padding: 14, background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{statsBody.totalWeeks}주</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>완료된 계획 주 수</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, padding: 14, background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{statsBody.avgCompletionRate == null ? '-' : `${Math.round(statsBody.avgCompletionRate * 100)}%`}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>평균 달성률</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, padding: 14, background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{statsBody.currentStreak}주</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>연속 실행 주</div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 16 }}>카테고리별 실행률</div>
            <div style={{ marginTop: 8 }}>
              {!statsBody.byCategory?.length ? (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>기록이 없습니다.</div>
              ) : statsBody.byCategory.map((c) => {
                const pct = Math.round(c.rate * 100)
                return (
                  <div className="progress-wrap" key={c.category} style={{ marginBottom: 8 }}>
                    <div className="progress-header">
                      <span className="progress-label">{CATEGORY_LABEL[c.category] || c.category}</span>
                      <span className="progress-value">{c.completed}/{c.planned} ({pct}%)</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${fillClassForScore(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 16 }}>최근 계획</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {!history?.length ? (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>기록이 없습니다.</div>
              ) : history.map((h) => {
                const pct = h.completionRate == null ? null : Math.round(h.completionRate * 100)
                return (
                  <div className="card" key={h.weeklyPlanId} style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>{formatKstDate(h.weekStart)} ~ {formatKstDate(h.weekEnd)}</span>
                      <span className={`badge ${pct == null ? 'badge-blue' : pctBadgeClass(pct)}`}>{pct == null ? '집계 불가' : `${pct}%`}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{h.goal || '-'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default CareerPlan