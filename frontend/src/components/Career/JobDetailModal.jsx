function formatSalary(n) {
  return n ? `${(n / 10000).toLocaleString()}만원` : '-'
}

function TagList({ items }) {
  if (!items || !items.length) return <span style={{ fontSize: 12, color: 'var(--text2)' }}>정보 없음</span>
  return items.map((name, i) => <span className="tag" key={i}>{name}</span>)
}

function RespList({ items }) {
  if (!items || !items.length) return <span style={{ fontSize: 12, color: 'var(--text2)' }}>정보 없음</span>
  return items.map((text, i) => (
    <div className="job-detail-resp-item" key={i}><span className="job-detail-resp-num">{i + 1}.</span><span>{text}</span></div>
  ))
}

function JobDetailModal({ data, onClose, onSave }) {
  if (!data) return null

  return (
    <div
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(17,20,45,.56)', zIndex: 1000, backdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="job-detail-modal-shell">
        <div className="job-detail-modal-accent" />

        <div className="job-detail-modal-header">
          <div>
            <div className="job-detail-modal-kicker">직무 상세 정보</div>
            <div className="job-detail-modal-title">{data.title}</div>
            <div className="job-detail-modal-category">{data.category || ''}</div>
          </div>
          <button type="button" onClick={onClose} className="job-detail-modal-close">✕</button>
        </div>

        <div className="job-detail-modal-body">
          <div className="job-detail-hero">
            <div className="job-detail-hero-left">
              <div className="job-detail-section-label"> 직무 개요</div>
              <div className="job-detail-copy">{data.description}</div>
            </div>
            <div className="job-detail-hero-right">
              <div className="job-detail-section-label"> 평균 연봉</div>
              <div className="job-detail-salary-grid">
                <div className="job-salary-card">
                  <div className="job-salary-value">{formatSalary(data.averageSalary?.lower25)}</div>
                  <div className="job-salary-label">하위 25%</div>
                </div>
                <div className="job-salary-card job-salary-card--featured">
                  <div className="job-salary-value job-salary-value--featured">{formatSalary(data.averageSalary?.median50)}</div>
                  <div className="job-salary-label">평균</div>
                </div>
                <div className="job-salary-card">
                  <div className="job-salary-value">{formatSalary(data.averageSalary?.upper25)}</div>
                  <div className="job-salary-label">상위 25%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 주요 업무</div>
            <div className="job-detail-resp-list"><RespList items={data.responsibilities} /></div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 되는 법</div>
            <div className="job-detail-copy job-detail-copy--preline">{(data.waysToAcquire || []).join('\n')}</div>
          </div>

          <div className="job-detail-grid-2">
            <div className="job-detail-panel">
              <div className="job-detail-section-label"> 업무 수행 능력</div>
              <div className="job-detail-tags"><TagList items={data.abilities} /></div>
            </div>
            <div className="job-detail-panel">
              <div className="job-detail-section-label"> 관련 지식</div>
              <div className="job-detail-tags"><TagList items={data.knowledge} /></div>
            </div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 업무 관련 성격</div>
            <div className="job-detail-tags"><TagList items={data.characteristics} /></div>
          </div>

          <div className="job-detail-grid-2">
            <div className="job-detail-panel">
              <div className="job-detail-section-label"> 관련 학과</div>
              <div className="job-detail-tags"><TagList items={data.relatedDepartments} /></div>
            </div>
            <div className="job-detail-panel">
              <div className="job-detail-section-label"> 관련 자격증</div>
              <div className="job-detail-tags"><TagList items={data.relatedCertifications} /></div>
            </div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 관련 직업</div>
            <div className="job-detail-tags"><TagList items={data.relatedOccupations} /></div>
          </div>
        </div>

        <div className="job-detail-action-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={() => onSave('wish')}>관심 설정</button>
          <button type="button" className="btn btn-accent" onClick={() => onSave('target')}>목표 설정</button>
        </div>
      </div>
    </div>
  )
}

export default JobDetailModal
