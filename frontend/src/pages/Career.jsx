import { useEffect, useMemo, useState } from 'react'
import CertDetailModal from '../components/Career/CertDetailModal'
import JobDetailModal from '../components/Career/JobDetailModal'
import SearchPagination from '../components/Career/SearchPagination'
import {
  useCascadingCategories,
  resolveCertFallbackByName,
  splitWaySteps,
  splitProspectParagraphs,
  groupPassRates,
  CAREER_PAGE_SIZE,
} from '../components/Career/careerUtils'

function Career() {
  const [activeTab, setActiveTab] = useState('cert')
  const [myCerts, setMyCerts] = useState(null)
  const [myCertsError, setMyCertsError] = useState(false)
  const [myJobs, setMyJobs] = useState(null)
  const [myJobsError, setMyJobsError] = useState(false)

  async function loadMyCerts() {
    setMyCerts(null)
    setMyCertsError(false)
    try {
      const res = await fetch('/career/my-certs')
      if (!res.ok) throw new Error('Failed to load my certifications')
      const certs = await res.json()
      setMyCerts(Array.isArray(certs) ? certs : [])
    } catch (err) {
      console.error('Error fetching my certifications:', err)
      setMyCertsError(true)
      setMyCerts([])
    }
  }

  async function loadMyJobs() {
    setMyJobs(null)
    setMyJobsError(false)
    try {
      const res = await fetch('/career/my-jobs')
      if (!res.ok) throw new Error('Failed to load my jobs')
      const jobs = await res.json()
      setMyJobs(Array.isArray(jobs) ? jobs : [])
    } catch (err) {
      console.error('Error fetching my jobs:', err)
      setMyJobsError(true)
      setMyJobs([])
    }
  }

  useEffect(() => {
    loadMyCerts()
    loadMyJobs()
  }, [])

  async function removeCertification(userCertId, e) {
    e?.stopPropagation()
    e?.preventDefault()
    if (!confirm('이 자격증을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/career/remove-cert/${userCertId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error('Failed to remove certification')
      await res.json()
      loadMyCerts()
    } catch (err) {
      console.error('Error removing certification:', err)
      alert('자격증 삭제에 실패했습니다.')
    }
  }

  async function removeJob(jobId, e) {
    e?.stopPropagation()
    e?.preventDefault()
    if (!confirm('이 직무를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/career/remove-job/${jobId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error('Failed to remove job')
      await res.json()
      loadMyJobs()
    } catch (err) {
      console.error('Error removing job:', err)
      alert('직무 삭제에 실패했습니다.')
    }
  }

  const [certModal, setCertModal] = useState(null)

  async function showCertDetail(name, fallback = {}) {
    const initialCategory = [fallback.field1, fallback.field2 || fallback.seriesName].filter(Boolean).join(' · ') || '국가기술자격'
    setCertModal({
      name,
      category: initialCategory,
      overview: fallback.description || '상세 설명이 준비 중입니다.',
      prospectSteps: splitProspectParagraphs(fallback.careerPath || '진로 및 전망 정보가 준비 중입니다.'),
      waySteps: splitWaySteps(fallback.way || ''),
      officialUrl: fallback.officialUrl || '',
      jmcd: '',
      passRateStatus: 'loading',
      passRateGroups: [],
    })

    const resolved = await resolveCertFallbackByName(name, fallback)
    const category = [resolved.field1, resolved.field2 || resolved.seriesName].filter(Boolean).join(' · ') || initialCategory
    setCertModal((prev) => (prev && prev.name === name ? {
      ...prev,
      category,
      overview: resolved.description || prev.overview,
      prospectSteps: splitProspectParagraphs(resolved.careerPath || '') || prev.prospectSteps,
      waySteps: splitWaySteps(resolved.way || '') || prev.waySteps,
      officialUrl: resolved.officialUrl || prev.officialUrl,
      jmcd: resolved.jmcd || '',
    } : prev))

    const jmcd = resolved.jmcd || ''
    if (!jmcd) {
      setCertModal((prev) => (prev && prev.name === name ? { ...prev, passRateStatus: 'notfound' } : prev))
      return
    }
    try {
      const res = await fetch(`/career/pass-rate/${encodeURIComponent(jmcd)}`)
      if (!res.ok) throw new Error('Not found')
      const list = await res.json()
      const items = Array.isArray(list) ? list : []
      if (!items.length) {
        setCertModal((prev) => (prev && prev.name === name ? { ...prev, passRateStatus: 'empty' } : prev))
        return
      }
      setCertModal((prev) => (prev && prev.name === name ? { ...prev, passRateStatus: 'ready', passRateGroups: groupPassRates(items) } : prev))
    } catch {
      setCertModal((prev) => (prev && prev.name === name ? { ...prev, passRateStatus: 'error' } : prev))
    }
  }

  async function handleCertSave(status) {
    if (!certModal) return
    const body = { jmcd: certModal.jmcd, name: certModal.name }
    if (status) body.status = status
    const successMsg = status === 'acquired' ? '자격증이 취득으로 설정되었습니다.' : status === 'target' ? '자격증이 목표로 설정되었습니다.' : '자격증이 저장되었습니다.'
    const failMsg = status === 'acquired' ? '취득 설정에 실패했습니다.' : status === 'target' ? '목표 설정에 실패했습니다.' : '저장에 실패했습니다.'
    const errMsg = status === 'acquired' ? '취득 설정 중 오류가 발생했습니다.' : status === 'target' ? '목표 설정 중 오류가 발생했습니다.' : '저장 중 오류가 발생했습니다.'
    try {
      const res = await fetch('/career/save-cert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json()
      if (res.ok && result.success) {
        alert(successMsg)
        loadMyCerts()
      } else {
        alert(result.error || failMsg)
      }
    } catch (err) {
      console.error(err)
      alert(errMsg)
    }
  }

  const [jobModal, setJobModal] = useState(null) // { jobCode, data }

  async function openJobDetail(jobCode, jobSeq) {
    try {
      const res = await fetch(`/career/detail/${jobCode}?seq=${jobSeq}`)
      const data = await res.json()
      setJobModal({ jobCode, data })
    } catch (err) {
      console.error('직무 상세 정보 로딩 실패:', err)
    }
  }

  async function handleJobSave(status) {
    if (!jobModal) return
    try {
      const res = await fetch(`/career/save/${jobModal.jobCode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const result = await res.json()
      if (result.success) alert(status === 'target' ? '목표 직무로 저장되었습니다!' : '직무가 저장되었습니다!')
      if (res.ok && result.success) loadMyJobs()
    } catch (err) {
      console.error(status === 'target' ? '직무 목표 저장 실패:' : '직무 저장 실패:', err)
    }
  }

  const jobCat = useCascadingCategories('/career/categories', ['depth1_name', 'depth2_name', 'depth3_name', 'depth4_name'])
  const [jobKeyword, setJobKeyword] = useState('')

  // /career/search-all — 카테고리를 고르지 않아도 페이지에 들어오자마자 전체 직무를
  // 한 번에 받아온다. (백엔드: controllers/careerController.js searchAllCareers —
  // 외부 Work24 API가 카테고리 단위로만 조회되는 구조라 서버가 모든 categoryId를
  // 순회해서 모아준 뒤 10분간 캐시해서 응답한다. 카테고리 수가 많으면 첫 로딩은
  // 다소 걸릴 수 있다.)
  const [jobAllItems, setJobAllItems] = useState(null) // 아직 못 받았으면 null
  const [jobAllLoading, setJobAllLoading] = useState(true)
  const [jobAllError, setJobAllError] = useState(false)
  const [jobPage, setJobPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    setJobAllLoading(true)
    setJobAllError(false)
    fetch('/career/search-all')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load all careers')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setJobAllItems(Array.isArray(data.items) ? data.items : [])
      })
      .catch((err) => {
        if (cancelled) return
        console.error('전체 직무 로딩 실패:', err)
        setJobAllError(true)
        setJobAllItems([])
      })
      .finally(() => { if (!cancelled) setJobAllLoading(false) })
    return () => { cancelled = true }
  }, [])

  const jobHasCategory = jobCat.values.some(Boolean)

  // 선택된 대/중/소/세분류 이름 → 그 카테고리들의 categoryId 집합(encodeURIComponent된
  // 형태, item.jobCategory와 동일한 포맷). 원본 컨트롤러(searchCareers)의
  // matchedCategories 필터링 로직과 동일하게, 선택된 depth만 비교한다. 선택된 게
  // 하나도 없으면 null을 반환해서 "전체(제한 없음)"를 의미한다.
  const jobMatchedCategoryCodes = useMemo(() => {
    if (!jobHasCategory) return null
    const [d1, d2, d3, d4] = jobCat.values
    const matched = jobCat.allRows.filter((cat) => (
      (!d1 || cat.depth1_name === d1)
      && (!d2 || cat.depth2_name === d2)
      && (!d3 || cat.depth3_name === d3)
      && (!d4 || cat.depth4_name === d4)
    ))
    return new Set(matched.map((cat) => encodeURIComponent(cat.categoryId)).filter(Boolean))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobHasCategory, jobCat.values.join('|'), jobCat.allRows])

  // 카테고리(고른 경우) + 키워드를 이미 다 받아온 jobAllItems 위에서 로컬로 즉시
  // 필터링한다 — 둘 다 네트워크 요청이 없으니 타이핑/선택마다 바로 반영되고
  // 디바운스도 필요 없다. 키워드 매칭 로직은 원본과 동일(jobName/jobDescription/
  // jobCode를 합친 문자열에 대한 단순 부분일치).
  const jobFilteredItems = useMemo(() => {
    if (!jobAllItems) return null
    let items = jobAllItems
    if (jobMatchedCategoryCodes) items = items.filter((item) => jobMatchedCategoryCodes.has(item.jobCategory))
    const keyword = jobKeyword.trim()
    if (keyword) items = items.filter((item) => `${item.jobName} ${item.jobDescription} ${item.jobCode}`.includes(keyword))
    return items
  }, [jobAllItems, jobMatchedCategoryCodes, jobKeyword])

  // 카테고리나 키워드가 바뀌어 필터링 결과가 달라지면 페이지를 다시 1페이지로.
  useEffect(() => {
    setJobPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCat.values.join('|'), jobKeyword])

  const jobMetaText = jobHasCategory ? jobCat.values.filter(Boolean).join(' > ') : '전체 결과'
  const jobSearch = jobFilteredItems ? { items: jobFilteredItems, page: jobPage, metaText: jobMetaText } : null

  const certCat = useCascadingCategories('/career/cert-categories', ['field1', 'field2', 'seriesName'])
  const [certKeyword, setCertKeyword] = useState('')
  const certDepth1IsNationalProfessional = certCat.values[0] === '국가전문자격'

  // /career/search-cert는 로컬 DB(Certification 컬렉션) 조회라(services/careerService.js
  // searchCertifications) 필터 없이 호출하면 그 자체로 전체 자격증을 돌려준다 — 직무
  // 검색과 달리 외부 API가 아니라서 새 백엔드 엔드포인트가 필요 없었다. 진입 시 한 번만
  // 전체를 받아오고, 이후 카테고리 선택·키워드 입력은 전부 이미 받아온 배열 위에서
  // 로컬로 즉시 필터링한다(네트워크 요청 없음 → 디바운스도 불필요).
  //
  // 원본 quirk 변경 알림: 원래 runCertSearch는 "카테고리/키워드가 전부 비어 있으면
  // 결과를 빈 배열로 채운다"는 규칙이 있었다(검색을 눌러야만 뭔가 보이는 방식). 이번
  // 요청("자격증도 처음부터 다 보여주고 실시간 필터")에 따라 이 규칙은 의도적으로
  // 없앴다 — 이제 아무것도 선택/입력하지 않으면 전체 자격증이 보인다.
  const [certAllItems, setCertAllItems] = useState(null)
  const [certAllLoading, setCertAllLoading] = useState(true)
  const [certAllError, setCertAllError] = useState(false)
  const [certPage, setCertPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    setCertAllLoading(true)
    setCertAllError(false)
    fetch('/career/search-cert')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load all certifications')
        return res.json()
      })
      .then((items) => { if (!cancelled) setCertAllItems(Array.isArray(items) ? items : []) })
      .catch((err) => {
        if (cancelled) return
        console.error('전체 자격증 로딩 실패:', err)
        setCertAllError(true)
        setCertAllItems([])
      })
      .finally(() => { if (!cancelled) setCertAllLoading(false) })
    return () => { cancelled = true }
  }, [])

  const certHasCategory = certCat.values.some(Boolean)

  // 카테고리(선택 시 exact match — 서버 쿼리와 동일한 매칭) + 키워드(원본과 동일하게
  // name 필드에 대해서만 대소문자 무시 부분일치 — 서버의 $regex(keyword, 'i') on name과
  // 동치)를 로컬에서 즉시 필터링.
  const certFilteredItems = useMemo(() => {
    if (!certAllItems) return null
    const [f1, f2, series] = certCat.values
    let items = certAllItems
    if (f1) items = items.filter((item) => item.field1 === f1)
    if (f2) items = items.filter((item) => item.field2 === f2)
    if (series) items = items.filter((item) => item.seriesName === series)
    const keyword = certKeyword.trim().toLowerCase()
    if (keyword) items = items.filter((item) => (item.name || '').toLowerCase().includes(keyword))
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certAllItems, certCat.values.join('|'), certKeyword])

  // 카테고리나 키워드가 바뀌면 1페이지로.
  useEffect(() => {
    setCertPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certCat.values.join('|'), certKeyword])

  const certMetaText = certHasCategory ? certCat.values.filter(Boolean).join(' > ') : '전체 결과'
  const certSearch = certFilteredItems ? { items: certFilteredItems, page: certPage, metaText: certMetaText } : null

  return (
    <>
      <div className="tabs">
        <button type="button" className={`tab-btn ${activeTab === 'cert' ? 'active' : ''}`} onClick={() => setActiveTab('cert')}>자격증 정보</button>
        <button type="button" className={`tab-btn ${activeTab === 'job' ? 'active' : ''}`} onClick={() => setActiveTab('job')}>직무 정보</button>
      </div>

      {activeTab === 'cert' && (
        <div>
          <MyCertList certs={myCerts} error={myCertsError} onOpen={showCertDetail} onRemove={removeCertification} />

          <div className="cert-search-box">
            <div className="cert-search-title">자격증 카테고리 검색</div>
            <div className="cert-search-dropdowns">
              <select className="select-field" value={certCat.values[0]} onChange={(e) => certCat.setLevel(0, e.target.value)}>
                <option value="">대분류 선택</option>
                {certCat.optionsPerLevel[0].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="select-field" value={certCat.values[1]} disabled={certDepth1IsNationalProfessional} onChange={(e) => certCat.setLevel(1, e.target.value)}>
                <option value="">중분류 선택</option>
                {certCat.optionsPerLevel[1].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="select-field" value={certCat.values[2]} disabled={certDepth1IsNationalProfessional} onChange={(e) => certCat.setLevel(2, e.target.value)}>
                <option value="">등급 선택</option>
                {certCat.optionsPerLevel[2].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="cert-search-bottom">
              <input className="input-field" style={{ flex: 1 }} placeholder="자격증명, 키워드를 입력하세요 (예: 정보처리, SQL)" value={certKeyword} onChange={(e) => setCertKeyword(e.target.value)} />
            </div>
          </div>

          {certAllLoading ? (
            <div className="career-empty-state">전체 자격증을 불러오는 중입니다...</div>
          ) : certAllError ? (
            <div className="career-empty-state">자격증 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          ) : certSearch && (
            <div className="career-search-results">
              <div className="career-search-head">
                <div className="career-search-title">{certSearch.metaText}</div>
                <div className="career-search-count">{certSearch.items.length}건 · {Math.min(Math.max(certSearch.page, 1), Math.max(1, Math.ceil(certSearch.items.length / CAREER_PAGE_SIZE)))}/{Math.max(1, Math.ceil(certSearch.items.length / CAREER_PAGE_SIZE))}페이지</div>
              </div>
              {!certSearch.items.length ? (
                <div className="career-empty-state">조건에 맞는 자격증이 없습니다.</div>
              ) : (
                <div className="career-search-list grid-3">
                  {certSearch.items.slice((certSearch.page - 1) * CAREER_PAGE_SIZE, certSearch.page * CAREER_PAGE_SIZE).map((item) => (
                    <div
                      key={item.jmcd + item.name}
                      className="career-result-card"
                      onClick={() => showCertDetail(item.name, {
                        jmcd: item.jmcd, officialUrl: item.officialUrl, way: item.way, description: item.description,
                        careerPath: item.careerPath, field1: item.field1, field2: item.field2, seriesName: item.seriesName,
                        relatedJobs: item.relatedJobs || [],
                      })}
                    >
                      <div className="career-result-top">
                        <div className="career-result-name">{item.name}</div>
                        <span className="badge badge-blue">{item.seriesName || ''}</span>
                      </div>
                      <div className="career-result-code">{item.field1} {item.field2 ? `> ${item.field2}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="career-search-footer">
                <div className="career-search-page-info">{certSearch.items.length ? `${Math.min(Math.max(certSearch.page, 1), Math.max(1, Math.ceil(certSearch.items.length / CAREER_PAGE_SIZE)))} / ${Math.max(1, Math.ceil(certSearch.items.length / CAREER_PAGE_SIZE))}` : ''}</div>
                <SearchPagination totalItems={certSearch.items.length} currentPage={certSearch.page} pageSize={CAREER_PAGE_SIZE} onPageChange={(page) => setCertPage(page)} />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'job' && (
        <div>
          <MyJobList jobs={myJobs} error={myJobsError} onOpen={openJobDetail} onRemove={removeJob} />

          <div className="job-search-box">
            <div className="job-search-title">직무 카테고리 검색 (한국직업사전분류 기준)</div>
            <div className="job-search-dropdowns">
              {['대분류 선택', '중분류 선택', '소분류 선택', '세분류 선택'].map((placeholder, level) => (
                <select key={level} className="select-field" style={{ width: '100%' }} value={jobCat.values[level]} onChange={(e) => jobCat.setLevel(level, e.target.value)}>
                  <option value="">{placeholder}</option>
                  {jobCat.optionsPerLevel[level].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ))}
            </div>
            <div className="career-search-meta">
              {jobHasCategory ? `선택 분류: ${jobCat.values.filter(Boolean).join(' > ')}` : '전체 직무를 보고 있습니다 — 분류를 고르면 그만큼 좁혀집니다.'}
            </div>
            <div className="job-search-bottom">
              <input className="input-field" style={{ flex: 1 }} placeholder="직무명, 키워드를 입력하세요 (예: 데이터, 웹)" value={jobKeyword} onChange={(e) => setJobKeyword(e.target.value)} />
            </div>
          </div>

          {jobAllLoading ? (
            <div className="career-empty-state">전체 직무를 불러오는 중입니다... (처음 한 번은 다소 걸릴 수 있어요)</div>
          ) : jobAllError ? (
            <div className="career-empty-state">직무 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          ) : jobSearch && (
            <div className="career-search-results">
              <div className="career-search-head">
                <div className="career-search-title">{jobSearch.metaText}</div>
                <div className="career-search-count">{jobSearch.items.length}건 · {Math.min(Math.max(jobSearch.page, 1), Math.max(1, Math.ceil(jobSearch.items.length / CAREER_PAGE_SIZE)))}/{Math.max(1, Math.ceil(jobSearch.items.length / CAREER_PAGE_SIZE))}페이지</div>
              </div>
              {!jobSearch.items.length ? (
                <div className="career-empty-state">선택한 분류에 해당하는 진로 정보가 없습니다.</div>
              ) : (
                <div className="career-search-list">
                  {jobSearch.items.slice((jobSearch.page - 1) * CAREER_PAGE_SIZE, jobSearch.page * CAREER_PAGE_SIZE).map((item) => (
                    <div key={item.jobCode + (item.jobSeq || '1')} className="career-result-card" onClick={() => openJobDetail(item.jobCode, item.jobSeq || '1')}>
                      <div className="career-result-top">
                        <div className="career-result-name">{item.jobName}</div>
                        <span className="badge badge-blue">{item.jobCategory || ''}</span>
                      </div>
                      <div className="career-result-code">직무코드: {item.jobCode}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="career-search-footer">
                <div className="career-search-page-info">{jobSearch.items.length ? `${Math.min(Math.max(jobSearch.page, 1), Math.max(1, Math.ceil(jobSearch.items.length / CAREER_PAGE_SIZE)))} / ${Math.max(1, Math.ceil(jobSearch.items.length / CAREER_PAGE_SIZE))}` : ''}</div>
                <SearchPagination totalItems={jobSearch.items.length} currentPage={jobSearch.page} pageSize={CAREER_PAGE_SIZE} onPageChange={(page) => setJobPage(page)} />
              </div>
            </div>
          )}
        </div>
      )}

      <CertDetailModal state={certModal} onClose={() => setCertModal(null)} onSave={handleCertSave} />
      <JobDetailModal data={jobModal?.data} onClose={() => setJobModal(null)} onSave={handleJobSave} />
    </>
  )
}

function MyCertList({ certs, error, onOpen, onRemove }) {
  if (certs === null) return <div className="my-cert-list"><div className="career-empty-state">{error ? '현재 선택한 자격증을 불러오지 못했습니다.' : '현재 선택한 자격증을 불러오는 중입니다.'}</div></div>
  if (!certs.length) return <div className="my-cert-list"><div className="career-empty-state">아직 선택한 자격증이 없습니다. 아래에서 자격증을 저장해 보세요.</div></div>
  return (
    <div className="my-cert-list">
      <div className="my-cert-head">
        <div className="my-cert-title">선택한 자격증</div>
        <div className="my-cert-count">{certs.length}개</div>
      </div>
      <div className="my-cert-grid">
        {certs.map((cert) => {
          const info = cert.certificationId || {}
          const name = info.name || '자격증'
          const fieldParts = [info.field1, info.field2, info.seriesName].filter(Boolean)
          const statusLabel = cert.status === 'target' ? '목표' : cert.status === 'wish' ? '관심' : '취득'
          return (
            <div className="my-cert-chip-wrapper" key={cert._id}>
              <button type="button" className="my-cert-chip" onClick={() => onOpen(name)}>
                <span className="my-cert-chip-name">{name}</span>
                <span className="my-cert-chip-meta">{fieldParts.join(' · ') || '분류 정보 없음'}</span>
                <span className="badge badge-green my-cert-chip-badge">{statusLabel}</span>
              </button>
              <button type="button" className="my-cert-delete-btn" title="삭제" onClick={(e) => onRemove(cert._id, e)}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MyJobList({ jobs, error, onOpen, onRemove }) {
  if (jobs === null) return <div className="my-job-info"><div className="career-empty-state">{error ? '현재 선택한 직무를 불러오지 못했습니다.' : '현재 선택한 직무를 불러오는 중입니다.'}</div></div>
  if (!jobs.length) return <div className="my-job-info"><div className="career-empty-state">아직 선택한 직무가 없습니다. 아래에서 직무를 저장해 보세요.</div></div>
  return (
    <div className="my-job-info">
      <div className="my-job-head">
        <div className="my-job-title">선택한 직무</div>
        <div className="my-job-count">{jobs.length}개</div>
      </div>
      <div className="my-job-grid">
        {jobs.map((job) => {
          const jobSeq = job.jobSeq || '1'
          const statusLabel = job.status === 'target' ? '목표' : '관심'
          return (
            <div className="my-job-chip-wrapper" key={job._id}>
              <button type="button" className="my-job-chip" onClick={() => onOpen(job.jobCode, jobSeq)}>
                <span className="my-job-chip-name">{job.title || '직무'}</span>
                <span className="my-job-chip-meta">직무코드: {job.jobCode}</span>
                <span className="badge badge-green my-cert-chip-badge">{statusLabel}</span>
              </button>
              <button type="button" className="my-job-delete-btn" title="삭제" onClick={(e) => onRemove(job._id, e)}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Career
