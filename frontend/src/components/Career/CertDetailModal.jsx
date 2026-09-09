function CertDetailModal({ state, onClose, onSave }) {
  if (!state) return null
  const { name, category, overview, prospectSteps, waySteps, officialUrl, passRateStatus, passRateGroups } = state

  return (
    <div
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(17,20,45,.56)', zIndex: 1000, backdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="job-detail-modal-shell" style={{ width: 'min(720px,96vw)' }}>
        <div className="job-detail-modal-accent" />

        <div className="job-detail-modal-header">
          <div>
            <div className="job-detail-modal-kicker"> 자격증 상세 정보</div>
            <div className="job-detail-modal-title">{name}</div>
            <div className="job-detail-modal-category">{category}</div>
            <button type="button" className="btn btn-accent" style={{ marginLeft: 10, backgroundColor: '#28a745' }} onClick={() => onSave('acquired')}>취득</button>
            <button type="button" className="btn btn-accent" style={{ marginLeft: 10 }} onClick={() => onSave('target')}>목표 설정</button>
            <button type="button" className="btn btn-accent" style={{ marginLeft: 5 }} onClick={() => onSave(undefined)}>관심 설정</button>
          </div>
          <button type="button" onClick={onClose} className="job-detail-modal-close">✕</button>
        </div>

        <div className="job-detail-modal-body">
          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 자격증 개요</div>
            <div className="job-detail-copy">{overview}</div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 진로 및 전망</div>
            <div className="job-detail-resp-list">
              {prospectSteps ? prospectSteps.map((step, i) => (
                <div className="job-detail-resp-item" key={i}><span className="job-detail-resp-num">{i + 1}.</span><span>{step}</span></div>
              )) : <span style={{ fontSize: 12, color: 'var(--text2)' }}>진로 및 전망 정보가 없습니다.</span>}
            </div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 취득방법</div>
            <div className="job-detail-resp-list">
              {waySteps ? waySteps.map((step, i) => (
                <div className="job-detail-resp-item" key={i}><span className="job-detail-resp-num">{i + 1}.</span><span>{step}</span></div>
              )) : <span style={{ fontSize: 12, color: 'var(--text2)' }}>취득 방법 정보가 없습니다.</span>}
            </div>
          </div>

          <div className="job-detail-panel">
            <div className="job-detail-section-label"> 합격률</div>
            <div className="job-detail-copy" style={{ minHeight: 56, fontSize: 13, color: 'var(--text2)' }}>
              {passRateStatus === 'loading' && (
                <>
                  <div className="passrate-skeleton-card"><div className="passrate-skeleton-line passrate-skeleton-line--title" /><div className="passrate-skeleton-line" /><div className="passrate-skeleton-line passrate-skeleton-line--short" /></div>
                  <div className="passrate-skeleton-card"><div className="passrate-skeleton-line passrate-skeleton-line--title" /><div className="passrate-skeleton-line" /><div className="passrate-skeleton-line passrate-skeleton-line--short" /></div>
                </>
              )}
              {passRateStatus === 'notfound' && <div className="passrate-empty">합격률 정보를 찾을 수 없습니다.</div>}
              {passRateStatus === 'empty' && <div className="passrate-empty">합격률 정보가 없습니다.</div>}
              {passRateStatus === 'error' && <div className="passrate-empty">합격률 정보를 불러오지 못했습니다.</div>}
              {passRateStatus === 'ready' && (
                <div className="passrate-group">
                  {passRateGroups.map((group) => (
                    <div className="passrate-year-group" key={group.year}>
                      <div className="passrate-year-title">{group.year}년</div>
                      <PassRateExamType label="필기" records={group.written} />
                      <PassRateExamType label="실기" records={group.practical} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 6 }}>
            {officialUrl && <a className="qnet-link" href={officialUrl} target="_blank" rel="noreferrer">🔗 Q-net</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PassRateExamType({ label, records }) {
  if (!records.length) return null
  return (
    <div className="passrate-examtype-section">
      <div className="passrate-examtype-label">{label}</div>
      {records.map((record, i) => {
        const pass = Number(record.passRate ?? 0)
        const app = Number(record.applicantCount ?? 0)
        const passers = Number(record.passerCount ?? 0)
        return (
          <div className="passrate-card" key={i}>
            <div className="passrate-card-head">
              <div className="passrate-card-main">{record.session || '-'}</div>
              <div className="passrate-card-badge">{Number.isFinite(pass) ? pass.toFixed(1) : '0.0'}%</div>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-blue" style={{ width: `${Math.max(0, Math.min(100, pass))}%` }} />
            </div>
            <div className="passrate-meta">응시 {app.toLocaleString()}명 · 합격 {passers.toLocaleString()}명</div>
            {record.note && <div className="passrate-note">{record.note}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default CertDetailModal
