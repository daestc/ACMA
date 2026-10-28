import { useEffect, useState } from 'react'

const KNOWN_LANG_TYPES = ['TOEIC', 'TOEFL', 'IELTS', 'JLPT']

function parseLanguageValue(value) {
  const v = String(value || '').trim()
  if (!v) return { type: '', score: '' }
  const known = KNOWN_LANG_TYPES.find((t) => v.startsWith(t))
  if (!known) return { type: '', score: v }
  return { type: known, score: v.replace(known, '').trim() }
}
function buildLanguageValue(type, score) {
  if (!type || type === '없음') return null
  return `${type}${score ? ` ${score}` : ''}`.trim()
}

function msgBoxStyle(isError) {
  return {
    display: 'block', fontSize: 12, borderRadius: 'var(--radius-sm)', padding: '9px 12px',
    background: isError ? 'var(--bg3)' : 'var(--green-bg)',
    border: `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`,
    color: isError ? 'var(--text)' : 'var(--green)',
  }
}

function CertPicker({ certs, setCerts, msgSetter }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState(null) // null = 숨김, [] = 결과없음

  const search = async () => {
    if (!keyword.trim()) {
      msgSetter({ text: '검색할 자격증명을 입력해주세요.', isError: true })
      return
    }
    try {
      const res = await fetch(`/career/search-cert?keyword=${encodeURIComponent(keyword.trim())}`)
      if (!res.ok) throw new Error('bad status')
      const items = await res.json()
      setResults((Array.isArray(items) ? items : items.items || []).slice(0, 20))
    } catch {
      msgSetter({ text: '자격증 검색에 실패했습니다.', isError: true })
    }
  }

  const addCert = (name) => {
    const trimmed = name.trim()
    if (!trimmed || certs.includes(trimmed)) return
    setCerts([...certs, trimmed])
    setResults(null)
    setKeyword('')
  }
  const removeCert = (name) => setCerts(certs.filter((c) => c !== name))

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {certs.map((c) => (
          <span key={c} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {c}
            <span style={{ cursor: 'pointer' }} onClick={() => removeCert(c)}>✕</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input-field staff-label" placeholder="자격증명 검색 (예: 정보처리기사)" value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={search}>검색</button>
      </div>
      {results !== null && (
        <div className="staff-cert-results" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text2)' }}>검색 결과가 없습니다.</div>
          ) : (
            results.map((item, i) => (
              <button
                type="button" key={i} className="staff-cert-result-item"
                onClick={() => addCert(item.name)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                <div className="staff-cert-result-meta" style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {[item.field1, item.field2, item.seriesName].filter(Boolean).join(' · ') || '자격증 DB'}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const YEAR_BASE = '' // 적용 학번 선택값: '' = 기본(연도 미지정)
const YEAR_ADD = 'add'

function StaffGraduation() {
  const [loading, setLoading] = useState(true)
  const [majors, setMajors] = useState([])

  // 적용 학번(입학연도)별 요건
  const [years, setYears] = useState([])
  const [fromYear, setFromYear] = useState(YEAR_BASE)
  const [isNewYear, setIsNewYear] = useState(false)

  // 학교 기본값
  const [total, setTotal] = useState(130)
  const [majorReq, setMajorReq] = useState(42)
  const [majorEl, setMajorEl] = useState(40)
  const [genReq, setGenReq] = useState(20)
  const [genEl, setGenEl] = useState(28)
  const [volunteer, setVolunteer] = useState('')
  const [gradWork, setGradWork] = useState(true)
  const [lang, setLang] = useState('')
  const [certs, setCerts] = useState([])
  const [internship, setInternship] = useState('')
  const [capstone, setCapstone] = useState('')
  const [nc, setNc] = useState('')
  const [schoolMsg, setSchoolMsg] = useState(null)
  const [schoolSaving, setSchoolSaving] = useState(false)

  // 학과별 추가요건
  const [selectedMajor, setSelectedMajor] = useState('')
  const [customMajorInput, setCustomMajorInput] = useState('')
  const [mgrGradWork, setMgrGradWork] = useState('')
  const [mgrCapstone, setMgrCapstone] = useState('')
  const [mgrLangType, setMgrLangType] = useState('')
  const [mgrLangScore, setMgrLangScore] = useState('')
  const [mgrCerts, setMgrCerts] = useState([])
  const [mgrInternship, setMgrInternship] = useState('')
  const [mgrNc, setMgrNc] = useState('')
  const [mgrVolunteer, setMgrVolunteer] = useState('')
  const [mgrMsg, setMgrMsg] = useState(null)
  const [mgrSaving, setMgrSaving] = useState(false)

  const applySchoolRequirements = (r) => {
    setTotal(r?.requiredTotalCredits ?? 130)
    setMajorReq(r?.requiredMajorCredits ?? 42)
    setMajorEl(r?.requiredMajorElective ?? 40)
    setGenReq(r?.requiredGeneralCredits ?? 20)
    setGenEl(r?.requiredGeneralElective ?? 28)
    setVolunteer(r?.requiredVolunteer ?? '')
    setGradWork(r?.requiresGraduationWork !== false)
    setLang(r?.requiredLanguageScore || '')
    setCerts(r?.requiredCertifications || [])
    setInternship(r?.requiredInternship == null ? '' : String(r.requiredInternship))
    setCapstone(r?.requiredCapstonDesign == null ? '' : String(r.requiredCapstonDesign))
    setNc(r?.requiredNCProgram == null ? '' : String(r.requiredNCProgram))
  }

  // year: '' = 기본 요건, 숫자 = 그 학번부터 적용되는 요건(없으면 서버가 기본 요건 복사본을 준다)
  const loadSchoolRequirements = async (year) => {
    const query = year === YEAR_BASE ? '' : `?fromYear=${encodeURIComponent(year)}`
    const res = await fetch(`/staff/graduation/data${query}`)
    const data = await res.json()
    if (!data.ok) {
      setSchoolMsg({ text: data.message || '졸업요건을 불러오지 못했습니다.', isError: true })
      return false
    }
    setMajors(data.majors || [])
    setYears(data.years || [])
    setFromYear(data.fromYear == null ? YEAR_BASE : String(data.fromYear))
    setIsNewYear(Boolean(data.isNew))
    applySchoolRequirements(data.requirements)
    return true
  }

  useEffect(() => {
    loadSchoolRequirements(YEAR_BASE).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeYear = async (value) => {
    setSchoolMsg(null)
    if (value !== YEAR_ADD) {
      loadSchoolRequirements(value)
      return
    }
    const input = window.prompt('몇 학번부터 적용할 요건인가요? (예: 2023)')
    if (input == null) return
    const year = Number(String(input).trim())
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      setSchoolMsg({ text: '1990~2100 사이 연도를 입력해주세요.', isError: true })
      return
    }
    loadSchoolRequirements(String(year))
  }

  const deleteYear = async () => {
    if (fromYear === YEAR_BASE || isNewYear) return
    if (!window.confirm(`${fromYear}학번부터 적용되는 요건을 삭제할까요? 해당 학번 학생에게는 바로 앞 연도 요건이나 기본 요건이 적용됩니다.`)) return
    try {
      const res = await fetch('/staff/graduation/years/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromYear: Number(fromYear) }),
      })
      const data = await res.json()
      if (!data.ok) {
        setSchoolMsg({ text: data.message || '삭제에 실패했습니다.', isError: true })
        return
      }
      await loadSchoolRequirements(YEAR_BASE)
      setSchoolMsg({ text: `${data.fromYear}학번 요건을 삭제했습니다.`, isError: false })
    } catch {
      setSchoolMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    }
  }

  const saveSchool = async () => {
    setSchoolSaving(true)
    const body = {
      fromYear: fromYear === YEAR_BASE ? null : Number(fromYear),
      requiredTotalCredits: total,
      requiredMajorCredits: majorReq,
      requiredMajorElective: majorEl,
      requiredGeneralCredits: genReq,
      requiredGeneralElective: genEl,
      requiresGraduationWork: gradWork,
      requiredCertifications: certs,
      requiredLanguageScore: lang,
      requiredInternship: internship,
      requiredCapstonDesign: capstone,
      requiredNCProgram: nc,
      requiredVolunteer: volunteer,
    }
    try {
      const res = await fetch('/staff/graduation/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.fromYear == null) {
          setSchoolMsg({ text: '학교 기본 졸업요건이 저장되었습니다.', isError: false })
        } else {
          setYears((prev) => (prev.includes(data.fromYear) ? prev : [...prev, data.fromYear].sort((a, b) => a - b)))
          setIsNewYear(false)
          setSchoolMsg({ text: `${data.fromYear}학번부터 적용되는 졸업요건이 저장되었습니다.`, isError: false })
        }
      } else {
        setSchoolMsg({ text: data.message || '저장에 실패했습니다.', isError: true })
      }
    } catch {
      setSchoolMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setSchoolSaving(false)
    }
  }

  const resetMajorForm = () => {
    setMgrGradWork(''); setMgrCapstone(''); setMgrLangType(''); setMgrLangScore('')
    setMgrInternship(''); setMgrNc(''); setMgrVolunteer(''); setMgrCerts([])
  }

  const applyMajorRequirements = (req) => {
    if (!req) { resetMajorForm(); return }
    setMgrGradWork(req.requiresGraduationWork == null ? '' : String(req.requiresGraduationWork))
    setMgrCapstone(req.requiredCapstonDesign == null ? '' : String(req.requiredCapstonDesign))
    const language = parseLanguageValue(req.requiredLanguageScore)
    setMgrLangType(language.type)
    setMgrLangScore(language.score)
    setMgrInternship(req.requiredInternship == null ? '' : String(req.requiredInternship))
    setMgrNc(req.requiredNCProgram == null ? '' : String(req.requiredNCProgram))
    setMgrVolunteer(req.requiredVolunteer ?? '')
    setMgrCerts(Array.isArray(req.requiredCertifications) ? req.requiredCertifications : [])
  }

  const loadMajorRequirements = async (major) => {
    setSelectedMajor(major)
    setMgrMsg(null)
    if (!major) { resetMajorForm(); return }
    try {
      const res = await fetch(`/staff/graduation/majors/${encodeURIComponent(major)}`)
      const data = await res.json()
      if (!data.ok) {
        setMgrMsg({ text: data.message || '학과별 요건을 불러오지 못했습니다.', isError: true })
        return
      }
      applyMajorRequirements(data.additionalRequirements)
    } catch {
      setMgrMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    }
  }

  const applyCustomMajor = () => {
    const m = customMajorInput.trim()
    if (!m) return
    if (!majors.includes(m)) setMajors((prev) => [...prev, m])
    setCustomMajorInput('')
    loadMajorRequirements(m)
  }

  const saveMajor = async () => {
    if (!selectedMajor) {
      setMgrMsg({ text: '학과를 선택해주세요.', isError: true })
      return
    }
    setMgrSaving(true)
    const body = {
      major: selectedMajor,
      requiresGraduationWork: mgrGradWork === '' ? null : mgrGradWork === 'true',
      requiredCapstonDesign: mgrCapstone === '' ? null : mgrCapstone === 'true',
      requiredLanguageScore: buildLanguageValue(mgrLangType, mgrLangScore),
      requiredCertifications: mgrCerts,
      requiredInternship: mgrInternship === '' ? null : mgrInternship === 'true',
      requiredNCProgram: mgrNc === '' ? null : mgrNc === 'true',
      requiredVolunteer: mgrVolunteer,
    }
    try {
      const res = await fetch('/staff/graduation/majors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setMgrMsg({ text: `${selectedMajor} 학과별 추가 이수 요건이 저장되었습니다.`, isError: false })
      } else {
        setMgrMsg({ text: data.message || '저장에 실패했습니다.', isError: true })
      }
    } catch {
      setMgrMsg({ text: '서버와 통신할 수 없습니다.', isError: true })
    } finally {
      setMgrSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)', fontSize: 14 }}>불러오는 중...</div>
  }

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">🎓 졸업요건</span>
          <span className="badge badge-blue">{fromYear === YEAR_BASE ? '학교 기본값' : `${fromYear}학번부터`}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>이 설정은 해당 대학 학생의 졸업요건 기본값으로 사용됩니다.</p>

        <div style={{ marginBottom: 12 }}>
          <label>적용 학번</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input-field" value={fromYear} onChange={(e) => changeYear(e.target.value)} style={{ flex: 1 }}>
              <option value={YEAR_BASE}>기본(연도 미지정)</option>
              {[...new Set([...years, ...(fromYear !== YEAR_BASE ? [Number(fromYear)] : [])])].sort((a, b) => a - b).map((y) => (
                <option key={y} value={String(y)}>{y}학번부터{!years.includes(y) ? ' (새 연도, 저장 전)' : ''}</option>
              ))}
              <option value={YEAR_ADD}>+ 연도 추가</option>
            </select>
            {fromYear !== YEAR_BASE && !isNewYear && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={deleteYear}>이 연도 요건 삭제</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
            학생 학번 앞자리로 입학연도를 판단합니다. 해당 연도 이전 학번에는 바로 앞 연도 요건이, 아무 연도에도 해당하지 않으면 기본 요건이 적용됩니다.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label>총 이수학점</label><input className="input-field" type="number" value={total} onChange={(e) => setTotal(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label>전공필수</label><input className="input-field" type="number" value={majorReq} onChange={(e) => setMajorReq(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label>전공선택</label><input className="input-field" type="number" value={majorEl} onChange={(e) => setMajorEl(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label>교양필수</label><input className="input-field" type="number" value={genReq} onChange={(e) => setGenReq(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label>교양선택</label><input className="input-field" type="number" value={genEl} onChange={(e) => setGenEl(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label>사회봉사 시간</label><input className="input-field" type="number" placeholder="예: 30" value={volunteer} onChange={(e) => setVolunteer(e.target.value)} style={{ width: '100%' }} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>졸업작품 이수</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>캡스톤디자인 또는 졸업논문</div>
            </div>
            <div className={`toggle ${gradWork ? 'on' : ''}`} onClick={() => setGradWork((v) => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div>
            <label>외국어 성적 요건</label>
            <input className="input-field" placeholder="예: TOEIC 700" value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: '100%' }} />
          </div>

          <CertPicker certs={certs} setCerts={setCerts} msgSetter={setSchoolMsg} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label>인턴십</label>
              <select className="input-field" value={internship} onChange={(e) => setInternship(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
              </select>
            </div>
            <div>
              <label>캡스톤</label>
              <select className="input-field" value={capstone} onChange={(e) => setCapstone(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
              </select>
            </div>
            <div>
              <label>비교과</label>
              <select className="input-field" value={nc} onChange={(e) => setNc(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
              </select>
            </div>
          </div>

          <button type="button" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} disabled={schoolSaving} onClick={saveSchool}>
            {schoolSaving ? '저장 중...' : fromYear === YEAR_BASE ? '💾 학교 기본값 저장' : `💾 ${fromYear}학번 요건 저장`}
          </button>
          {schoolMsg && <div style={msgBoxStyle(schoolMsg.isError)}>{schoolMsg.text}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">🏫 학과별 추가 이수 요건</span>
          <span className="badge badge-purple">{selectedMajor || '학과 선택'}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          학과를 선택하고 추가 이수 요건을 입력하세요. 학과별 설정은 학교 기본값을 덮어씁니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input-field" value={selectedMajor} onChange={(e) => loadMajorRequirements(e.target.value)} style={{ flex: 1 }}>
              <option value="">학과를 선택하세요</option>
              {majors.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" placeholder="새 학과명" value={customMajorInput} onChange={(e) => setCustomMajorInput(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={applyCustomMajor}>적용</button>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginTop: 4 }}>추가 이수 요건</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label>졸업작품 이수</label>
              <select className="input-field" value={mgrGradWork} onChange={(e) => setMgrGradWork(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정 (학교 기본값)</option><option value="true">필수</option><option value="false">불필요</option>
              </select>
            </div>
            <div>
              <label>캡스톤 디자인</label>
              <select className="input-field" value={mgrCapstone} onChange={(e) => setMgrCapstone(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정 (학교 기본값)</option><option value="true">필수</option><option value="false">불필요</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input-field" value={mgrLangType} onChange={(e) => setMgrLangType(e.target.value)} style={{ flex: 1 }}>
              <option value="">미지정</option>
              {KNOWN_LANG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="없음">없음</option>
            </select>
            <input className="input-field" placeholder="최소 점수 (예: 700)" value={mgrLangScore} onChange={(e) => setMgrLangScore(e.target.value)} style={{ flex: 1 }} />
          </div>

          <CertPicker certs={mgrCerts} setCerts={setMgrCerts} msgSetter={setMgrMsg} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label>인턴십 의무 이수</label>
              <select className="input-field" value={mgrInternship} onChange={(e) => setMgrInternship(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
              </select>
            </div>
            <div>
              <label>비교과 프로그램</label>
              <select className="input-field" value={mgrNc} onChange={(e) => setMgrNc(e.target.value)} style={{ width: '100%' }}>
                <option value="">미지정</option><option value="true">필수</option><option value="false">선택</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>사회봉사 시간</label>
              <input className="input-field" type="number" placeholder="예: 30" value={mgrVolunteer} onChange={(e) => setMgrVolunteer(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <button type="button" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} disabled={mgrSaving} onClick={saveMajor}>
            {mgrSaving ? '저장 중...' : '💾 학과별 요건 저장'}
          </button>
          {mgrMsg && <div style={msgBoxStyle(mgrMsg.isError)}>{mgrMsg.text}</div>}
        </div>
      </div>
    </div>
  )
}

export default StaffGraduation
