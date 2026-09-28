import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, pollUntilDone, fillClassForScore } from '../components/CareerAi/careerAiUtils'

// 서버 recommendScorer.WEIGHTS와 같은 만점 — 막대 길이 계산용
const SCORE_ITEMS = [
  { key: 'major', label: '전공', max: 15 },
  { key: 'cert', label: '자격증', max: 20 },
  { key: 'knowledge', label: '지식', max: 25 },
  { key: 'skill', label: '기술', max: 20 },
  { key: 'pref', label: '선호', max: 20 },
]
const ANGLE_BADGE = { 안정: 'badge-green', 확장: 'badge-blue', 도전: 'badge-purple' }
const EMPTY_PREFS = { work: [], style: null, value: null }

function ScoreBars({ breakdown }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      {SCORE_ITEMS.map(({ key, label, max }) => {
        const value = breakdown?.[key] ?? 0
        const pct = Math.round((value / max) * 100)
        return (
          <div className="progress-wrap" key={key} style={{ margin: 0 }}>
            <div className="progress-header">
              <span className="progress-label">{label}</span>
              <span className="progress-value">{value}/{max}</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${fillClassForScore(pct)}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function matchedChips(matched) {
  if (!matched) return []
  return [
    matched.major && `전공: ${matched.major}`,
    ...(matched.certs || []).map((c) => `자격증: ${c}`),
    ...(matched.subjects || []).map((s) => `과목: ${s}`),
    ...(matched.skills || []).map((s) => `기술: ${s}`),
    ...(matched.prefs || []),
  ].filter(Boolean)
}

// jmcd가 없으면 자격증 DB에 없는 종목(외국·민간 등)이라 일정을 알 방법이 없다.
function certGapLabel(gap) {
  if (!gap.jmcd) return '일정 정보 없음'
  if (gap.dDay == null) return '다음 시험 일정 미공개'
  return `${gap.isApplication ? '원서접수 마감' : '시험'} D-${gap.dDay}`
}

function ChoiceButton({ active, onClick, children }) {
  return (
    <button type="button" className={`btn btn-sm ${active ? 'btn-accent' : 'btn-ghost'}`} style={{ marginRight: 6, marginBottom: 6 }} onClick={onClick}>
      {children}
    </button>
  )
}

function Checklist({ questions, prefs, setPrefs, busy, onSubmit, onSkip }) {
  const { work, style, value } = questions
  const toggleWork = (key) => setPrefs((prev) => {
    if (prev.work.includes(key)) return { ...prev, work: prev.work.filter((k) => k !== key) }
    if (prev.work.length >= work.max) return prev
    return { ...prev, work: [...prev.work, key] }
  })
  const pickOne = (field, key) => setPrefs((prev) => ({ ...prev, [field]: prev[field] === key ? null : key }))

  return (
    <div className="card">
      <div className="card-title">어떤 일이 끌리나요?</div>
      <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 14px' }}>
        모두 선택 사항입니다. 등록된 전공·과목·자격증·스킬과 함께 후보 직무의 점수를 매기는 데 쓰입니다.
      </p>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{work.label} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>(최대 {work.max}개)</span></div>
      <div>{work.options.map((o) => <ChoiceButton key={o.key} active={prefs.work.includes(o.key)} onClick={() => toggleWork(o.key)}>{o.label}</ChoiceButton>)}</div>

      <div style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>{style.label}</div>
      <div>{style.options.map((o) => <ChoiceButton key={o.key} active={prefs.style === o.key} onClick={() => pickOne('style', o.key)}>{o.label}</ChoiceButton>)}</div>

      <div style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>{value.label}</div>
      <div>{value.options.map((o) => <ChoiceButton key={o.key} active={prefs.value === o.key} onClick={() => pickOne('value', o.key)}>{o.label}</ChoiceButton>)}</div>

      <div style={{ marginTop: 16, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onSkip}>건너뛰기</button>
        <button type="button" className="btn btn-accent" disabled={busy} onClick={onSubmit}>{busy ? '추천 중...' : '추천 받기'}</button>
      </div>
    </div>
  )
}

function InterestPicker({ categories, selected, setSelected, busy, onSubmit }) {
  const toggle = (name) => setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  return (
    <div className="card">
      <div className="card-title">관심 있는 분야를 골라 주세요</div>
      <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 14px' }}>
        입력된 정보만으로는 후보를 가려내기 어렵습니다. 고른 분야 안에서만 추천합니다(여러 개 선택 가능).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {categories.map((c) => {
          const active = selected.includes(c.name)
          return (
            <button
              type="button"
              key={c.name}
              onClick={() => toggle(c.name)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-bg, var(--bg3))' : 'var(--bg2, transparent)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text)' }}>{c.name} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>{c.jobCount}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{c.examples.join(', ')}</div>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button type="button" className="btn btn-accent" disabled={busy || selected.length === 0} onClick={onSubmit}>{busy ? '추천 중...' : '이 분야로 추천 받기'}</button>
      </div>
    </div>
  )
}

function PickCard({ pick, candidate, selected, selecting, onSelect }) {
  const chips = matchedChips(candidate?.matched)
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>{pick.title}</strong>
        {pick.angle && <span className={`badge ${ANGLE_BADGE[pick.angle] || 'badge-blue'}`}>{pick.angle}</span>}
        {selected && <span className="badge badge-green">목표로 설정됨</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{pick.jobMdclNm || candidate?.jobMdclNm}</div>

      <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginTop: 10 }}>
        {pick.reason || '점수 기준 추천'}
      </p>

      {chips.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {chips.map((c, i) => <span className="evidence-chip" style={{ marginRight: 4, marginTop: 4, display: 'inline-block' }} key={i}>{c}</span>)}
        </div>
      )}

      <ScoreBars breakdown={candidate?.breakdown} />

      {(pick.certGaps || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>보완하면 좋은 자격증</div>
          {pick.certGaps.map((g) => (
            <div key={g.name} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
              <span>{g.name}</span>
              <span className={`badge ${g.dDay == null ? 'badge-blue' : 'badge-red'}`}>{certGapLabel(g)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 14, textAlign: 'right' }}>
        <button type="button" className="btn btn-accent btn-sm" disabled={selecting} onClick={() => onSelect(pick)}>
          {selecting ? '설정 중...' : '목표 직무로 설정'}
        </button>
      </div>
    </div>
  )
}

function CareerRecommend() {
  const navigate = useNavigate()
  const [step, setStep] = useState('loading') // 'loading' | 'checklist' | 'interests' | 'pending' | 'result'
  const [questions, setQuestions] = useState(null)
  const [prefs, setPrefs] = useState(EMPTY_PREFS)
  const [sentPrefs, setSentPrefs] = useState(null) // 관심분야를 고른 뒤 같은 prefs로 다시 보낸다
  const [categories, setCategories] = useState([])
  const [interests, setInterests] = useState([])
  const [doc, setDoc] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selectingCode, setSelectingCode] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [form, latest] = await Promise.all([callApi('/ai/recommendation/form'), callApi('/ai/recommendation/latest')])
      if (cancelled) return
      if (form.httpStatus !== 200) {
        setError('추천 화면을 불러오지 못했습니다.')
        return
      }
      setQuestions(form.questions)
      setCategories(form.categories || [])
      if (form.last) {
        setPrefs({ ...EMPTY_PREFS, ...form.last.prefs })
        setInterests(form.last.interests || [])
      }
      if (latest.httpStatus === 200 && latest.data) {
        setDoc(latest.data)
        setStep('result')
      } else {
        setStep('checklist')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function request(prefsToSend, interestsToSend) {
    setBusy(true)
    setError(null)
    setSentPrefs(prefsToSend)
    const data = await callApi('/ai/recommendation', {
      method: 'POST',
      body: JSON.stringify({ prefs: prefsToSend, interests: interestsToSend }),
    })
    setBusy(false)

    if (data.httpStatus === 200 && data.status === 'needs_interests') {
      setCategories(data.categories || [])
      setStep('interests')
    } else if (data.httpStatus === 200 && data.data) {
      setDoc(data.data)
      setStep('result')
    } else if (data.httpStatus === 202 && data.id) {
      setStep('pending')
      pollUntilDone(`/ai/recommendation/${data.id}`, null, (res, timedOut) => {
        if (res.data) {
          setDoc(res.data)
          setStep('result')
        } else {
          setError(timedOut ? '추천 생성이 늦어지고 있습니다. 잠시 후 다시 열어 주세요.' : (res.errorMessage || '추천 생성에 실패했습니다.'))
          setStep('checklist')
        }
      })
    } else if (data.httpStatus === 409) {
      setError('이미 생성 중인 추천이 있습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setError(data.message || '추천 요청에 실패했습니다.')
    }
  }

  async function selectJob(pick) {
    if (!doc) return
    if (!confirm(`'${pick.title}'을(를) 목표 직무로 설정할까요?\n기존 목표 직무는 관심 직무로 바뀝니다.`)) return
    setSelectingCode(pick.jobCode)
    const data = await callApi(`/ai/recommendation/${doc._id}/select`, {
      method: 'POST',
      body: JSON.stringify({ jobCode: pick.jobCode }),
    })
    setSelectingCode(null)
    if (data.httpStatus === 200) {
      navigate(data.redirect || '/career/diagnosis')
    } else {
      alert(data.message || '목표 직무를 설정하지 못했습니다.')
    }
  }

  if (step === 'loading') {
    return <div className="card" style={{ textAlign: 'center', padding: '48px 20px', fontSize: 13, color: 'var(--text2)' }}>{error || '불러오는 중...'}</div>
  }

  const candidatesByCode = new Map((doc?.candidates || []).map((c) => [c.jobCode, c]))

  return (
    <>
      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>⚠️ {error}</div>
      )}

      {step === 'checklist' && questions && (
        <Checklist
          questions={questions}
          prefs={prefs}
          setPrefs={setPrefs}
          busy={busy}
          onSubmit={() => request(prefs, [])}
          onSkip={() => request(null, [])}
        />
      )}

      {step === 'interests' && (
        <InterestPicker
          categories={categories}
          selected={interests}
          setSelected={setInterests}
          busy={busy}
          onSubmit={() => request(sentPrefs, interests)}
        />
      )}

      {step === 'pending' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, color: 'var(--accent)' }}>추천을 생성하는 중입니다...</div>
      )}

      {step === 'result' && doc && (
        <div>
          {doc.confidence === 'low' && (
            <div style={{ background: 'var(--amber-bg, var(--bg3))', color: 'var(--amber, var(--text))', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              ℹ️ 입력한 정보가 적어 참고용 추천입니다. 과목·자격증·스킬을 등록하면 더 정확해집니다.
            </div>
          )}
          {(doc.picks || []).length < 3 && (
            <div style={{ background: 'var(--bg3)', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              조건에 맞는 직무가 적어 {(doc.picks || []).length}개만 추천되었습니다. 관심분야를 넓혀 다시 시도해 보세요.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {(doc.picks || []).map((pick) => (
              <PickCard
                key={pick.jobCode}
                pick={pick}
                candidate={candidatesByCode.get(pick.jobCode)}
                selected={doc.selectedJobCode === pick.jobCode}
                selecting={selectingCode === pick.jobCode}
                onSelect={selectJob}
              />
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">후보 직무 {(doc.candidates || []).length}개</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(null); setStep('checklist') }}>체크리스트 다시 하기</button>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>직무</th>
                    <th style={{ padding: '6px 8px' }}>중분류</th>
                    <th style={{ padding: '6px 8px', minWidth: 140 }}>총점</th>
                    {SCORE_ITEMS.map((s) => <th key={s.key} style={{ padding: '6px 8px', textAlign: 'right' }}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(doc.candidates || []).map((c, i) => (
                    <tr key={c.jobCode} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.title}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text2)' }}>{c.jobMdclNm}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-track" style={{ flex: 1 }}>
                            <div className={`progress-fill ${fillClassForScore(c.total)}`} style={{ width: `${Math.min(100, c.total)}%` }} />
                          </div>
                          <span>{c.total}</span>
                        </div>
                      </td>
                      {SCORE_ITEMS.map((s) => <td key={s.key} style={{ padding: '6px 8px', textAlign: 'right' }}>{c.breakdown?.[s.key] ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CareerRecommend
