/* ================================================
   AcadMe — career.js
   진로정보 페이지 전용:
   자격증/직무 탭, 직무별 자격증 추천, 세부 모달
   ================================================ */

// ============ 1. 상수 / 상태 ============
const CAREER_PAGE_SIZE = 10;

const fillMap  = { blue:'fill-blue', green:'fill-green', amber:'fill-amber', red:'fill-red', purple:'fill-purple' };
const badgeMap = { blue:'badge-blue', green:'badge-green', amber:'badge-amber', red:'badge-red', purple:'badge-purple' };

let careerSearchState = {
  items: [],
  page: 1,
  metaText: '검색 결과',
  keyword: '',
};

let certSearchState = {
  items: [],
  page: 1,
  metaText: '검색 결과',
  keyword: '',
};


// ============ 2. 유틸 ============
// XSS 방지용. API에서 받은 데이터는 신뢰할 수 없으므로 반드시 거치게 함.
function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clearSelect(select, placeholder) {
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = placeholder;
  select.appendChild(option);
}

function appendOptions(select, nameSet) {
  nameSet.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}

function updateCareerSearchAvailability() {
  const searchBtn = document.getElementById('career-search-btn');
  if (!searchBtn) return;

  const depth1 = document.getElementById('depth1')?.value || '';
  const depth2 = document.getElementById('depth2')?.value || '';
  const depth3 = document.getElementById('depth3')?.value || '';
  const depth4 = document.getElementById('depth4')?.value || '';
  const hasCategory = Boolean(depth1 || depth2 || depth3 || depth4);

  searchBtn.disabled = !hasCategory;
  searchBtn.title = hasCategory
    ? '카테고리 선택 후 키워드 검색이 가능합니다.'
    : '카테고리를 먼저 선택해야 검색할 수 있습니다.';
}


// ============ 3. 샘플 데이터 (자격증 추천 / 자격증 모달) ============
// TODO: 추후 DB 또는 API로 이전
const jobCertData = {
  
};

const certDetailData = {
  
};


// ============ 4. 탭 전환 모듈 ============
const tabsModule = {
  switch(tab, btn) {
    ['cert', 'job'].forEach(t => {
      document.getElementById('ca-' + t).style.display = 'none';
    });
    document.getElementById('ca-' + tab).style.display = 'block';
    btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },
};
// EJS의 onclick="switchCareerTab(...)"에서 호출되므로 글로벌 별칭 유지
function switchCareerTab(tab, btn) { tabsModule.switch(tab, btn); }


// ============ 5. 자격증 추천 모듈 ============
const certRecommendModule = {
  update() {
    const sel  = document.getElementById('job-select-cert')?.value;
    const data = jobCertData[sel];
    if (!data) return;

    document.querySelector('#job-cert-rec > div:first-child').textContent = `📌 ${data.name} 추천 자격증`;
    document.getElementById('job-cert-cards').innerHTML = data.certs.map(c => `
      <div class="card" style="cursor:pointer;position:relative;">
        ${c.owned ? `<div style="position:absolute;top:12px;right:12px;"><span class="badge badge-green" style="font-size:10px;">✓ 취득</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-right:${c.owned ? '52px' : '0'};">
          <div style="font-size:15px;font-weight:800;font-family:'DM Sans';">${c.name}</div>
          <span class="badge ${badgeMap[c.color] || 'badge-blue'}">${c.field}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px;">${c.org}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;color:var(--text2);">난이도</span>
          <span style="color:var(--amber);">${c.diff}</span>
        </div>
        <div class="progress-wrap" style="margin-bottom:8px;">
          <div class="progress-header">
            <span class="progress-label" style="font-size:11px;">합격률</span>
            <span class="progress-value">${c.pass}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${fillMap[c.color] || 'fill-blue'}" style="width:${c.pass}%"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:10px;">
          <span>다음 시험: ${c.next}</span>
          ${c.dday ? `<span class="badge badge-red">${c.dday}</span>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <a href="https://www.q-net.or.kr" target="_blank" class="qnet-link" onclick="event.stopPropagation()">🔗 Q-net</a>
          <span style="font-size:11px;color:var(--accent);font-weight:600;" onclick="showCertDetail('${c.name}')">세부정보 →</span>
        </div>
      </div>`).join('');
  },
};
function updateJobCertRec() { certRecommendModule.update(); }


// ============ 6. 자격증 모달 모듈 ============
const certModalModule = {
  async resolveFallbackByName(name, fallback = {}) {
    if (fallback.jmcd) return fallback;

    try {
      const params = new URLSearchParams();
      if (name) params.set('keyword', name);
      const res = await fetch(`/career/search-cert?${params.toString()}`);
      if (!res.ok) return fallback;

      const items = await res.json();
      if (!Array.isArray(items) || !items.length) return fallback;

      const exact = items.find(item => item.name === name) || items[0];
      return {
        ...fallback,
        jmcd: exact?.jmcd || fallback.jmcd || '',
        officialUrl: fallback.officialUrl || exact?.officialUrl || '',
        way: fallback.way || exact?.way || '',
        careerPath: fallback.careerPath || exact?.careerPath || '',
        field1: fallback.field1 || exact?.field1 || '',
        field2: fallback.field2 || exact?.field2 || '',
        seriesName: fallback.seriesName || exact?.seriesName || '',
        description: fallback.description || exact?.description || '',
        relatedJobs: fallback.relatedJobs || exact?.relatedJobs || [],
      };
    } catch (error) {
      console.error('Failed to resolve certification fallback:', error);
      return fallback;
    }
  },

  renderPassRateSkeleton() {
    return `
      <div class="passrate-skeleton-card">
        <div class="passrate-skeleton-line passrate-skeleton-line--title"></div>
        <div class="passrate-skeleton-line"></div>
        <div class="passrate-skeleton-line passrate-skeleton-line--short"></div>
      </div>
      <div class="passrate-skeleton-card">
        <div class="passrate-skeleton-line passrate-skeleton-line--title"></div>
        <div class="passrate-skeleton-line"></div>
        <div class="passrate-skeleton-line passrate-skeleton-line--short"></div>
      </div>
    `;
  },

  renderPassRateSection(title, records) {
    if (!records.length) {
      return `
        <div class="passrate-group">
          <div class="passrate-group-title">${title}</div>
          <div class="passrate-empty">등록된 ${title} 합격률이 없습니다.</div>
        </div>
      `;
    }

    const yearMap = new Map();
    records.forEach(record => {
      const yearKey = String(record.year || '미상');
      if (!yearMap.has(yearKey)) yearMap.set(yearKey, []);
      yearMap.get(yearKey).push(record);
    });

    const yearGroups = Array.from(yearMap.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, yearRecords]) => {
        const written = yearRecords.filter(r => r.examType === 'written');
        const practical = yearRecords.filter(r => r.examType === 'practical');

        const renderExamTypeSection = (examType, records, typeLabel) => {
          if (!records.length) return '';
          
          const sorted = records.slice().sort((a, b) => {
            const aSession = parseInt(a.session || '0') || 0;
            const bSession = parseInt(b.session || '0') || 0;
            return bSession - aSession;
          });

          return `
            <div class="passrate-examtype-section">
              <div class="passrate-examtype-label">${typeLabel}</div>
              ${sorted.map(record => {
                const pass = Number(record.passRate ?? 0);
                const app = Number(record.applicantCount ?? 0);
                const passers = Number(record.passerCount ?? 0);
                return `
                  <div class="passrate-card">
                    <div class="passrate-card-head">
                      <div class="passrate-card-main">${record.session || '-'}</div>
                      <div class="passrate-card-badge">${Number.isFinite(pass) ? pass.toFixed(1) : '0.0'}%</div>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill fill-blue" style="width:${Math.max(0, Math.min(100, pass))}%"></div>
                    </div>
                    <div class="passrate-meta">응시 ${app.toLocaleString()}명 · 합격 ${passers.toLocaleString()}명</div>
                    ${record.note ? `<div class="passrate-note">${escapeHtml(record.note)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `;
        };

        return `
          <div class="passrate-year-group">
            <div class="passrate-year-title">${year}년</div>
            ${renderExamTypeSection('written', written, '필기')}
            ${renderExamTypeSection('practical', practical, '실기')}
          </div>
        `;
      });

    return `
      <div class="passrate-group">
        ${yearGroups.join('')}
      </div>
    `;
  },

  async show(name, fallback = {}) {
    const d = certDetailData[name] || {
      overview: fallback.description || '상세 설명이 준비 중입니다.',
      prospect: fallback.careerPath || '진로 및 전망 정보가 준비 중입니다.',
      way: fallback.way || '',
      duties: fallback.duties || [],
    };

    const titleEl = document.getElementById('cd-title');
    const categoryEl = document.getElementById('cd-category');
    const overviewEl = document.getElementById('cd-overview');
    const prospectEl = document.getElementById('cd-prospect');
    const dutiesEl = document.getElementById('cd-duties');
    const wayEl = document.getElementById('cd-way');
    const modalEl = document.getElementById('cert-detail-modal');

    if (!titleEl || !overviewEl || !modalEl) return;

    titleEl.textContent = name;
    if (categoryEl) {
      const category = [fallback.field1, fallback.field2 || fallback.seriesName].filter(Boolean).join(' · ');
      categoryEl.textContent = category || '국가기술자격';
    }
    overviewEl.textContent = fallback.description || d.overview || '정보 없음';
    this.fillProspect(prospectEl, fallback.careerPath || d.prospect || '');
    this.fillDuties(dutiesEl, d.duties);
    this.fillWay(wayEl, fallback.way || d.way || '');
    this.fillRelatedJobs(document.getElementById('cd-related-jobs'), d.relatedJobs || fallback.relatedJobs || []);

    // store identifiers on modal for save action
    const resolvedFallback = await this.resolveFallbackByName(name, fallback);
    modalEl.dataset.jmcd = resolvedFallback.jmcd || '';

    if (categoryEl) {
      const category = [resolvedFallback.field1, resolvedFallback.field2 || resolvedFallback.seriesName].filter(Boolean).join(' · ');
      categoryEl.textContent = category || categoryEl.textContent || '국가기술자격';
    }
    overviewEl.textContent = resolvedFallback.description || d.overview || '정보 없음';
    this.fillProspect(prospectEl, resolvedFallback.careerPath || d.prospect || '');
    this.fillWay(wayEl, resolvedFallback.way || d.way || '');
    this.fillRelatedJobs(document.getElementById('cd-related-jobs'), d.relatedJobs || resolvedFallback.relatedJobs || []);

    // 합격률 정보 로딩
    const passEl = document.getElementById('cd-passrate');
    if (passEl) {
      passEl.innerHTML = this.renderPassRateSkeleton();
      const jmcd = modalEl.dataset.jmcd;
      if (!jmcd) {
        passEl.innerHTML = '<div class="passrate-empty">합격률 정보를 찾을 수 없습니다.</div>';
      } else {
        fetch(`/career/pass-rate/${encodeURIComponent(jmcd)}`)
          .then(res => {
            if (!res.ok) throw new Error('Not found');
            return res.json();
          })
          .then(passRates => {
            const list = Array.isArray(passRates) ? passRates : [];
            if (!list.length) {
              passEl.innerHTML = '<div class="passrate-empty">합격률 정보가 없습니다.</div>';
              return;
            }

            passEl.innerHTML = `
              ${this.renderPassRateSection('합격률', list)}
            `;
          })
          .catch(() => {
            passEl.innerHTML = '<div class="passrate-empty">합격률 정보를 불러오지 못했습니다.</div>';
          });
      }
    }

    // Q-net link
    const qnetLink = document.getElementById('cd-qnet-link');
    if (qnetLink) {
      const url = resolvedFallback.officialUrl || fallback.officialUrl || d.officialUrl || '';
      if (url) {
        qnetLink.href = url;
        qnetLink.style.display = 'inline-flex';
      } else {
        qnetLink.style.display = 'none';
      }
    }

    modalEl.style.display = 'flex';
  },

  init() {
    const saveBtn = document.getElementById('cd-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const modal = document.getElementById('cert-detail-modal');
        if (!modal) return;
        const jmcd = modal.dataset.jmcd;
        const name = document.getElementById('cd-title')?.textContent || '';
        try {
          const res = await fetch('/career/save-cert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jmcd, name })
          });
          const result = await res.json();
          if (res.ok && result.success) {
            alert('자격증이 저장되었습니다.');
          } else {
            alert(result.error || '저장에 실패했습니다.');
          }
        } catch (err) {
          console.error('자격증 저장 실패:', err);
          alert('저장 중 오류가 발생했습니다.');
        }
      });
    }
  },

  fillDuties(target, duties) {
    if (!target) return;
    if (!duties || duties.length === 0) {
      target.innerHTML = `<span style="font-size:12px;color:var(--text2);">정보 없음</span>`;
      return;
    }

    target.innerHTML = duties.map((duty, idx) => `
      <div class="job-detail-resp-item">
        <span class="job-detail-resp-num">${idx + 1}.</span>
        <span>${escapeHtml(duty)}</span>
      </div>
    `).join('');
  },

  fillWay(target, wayText) {
    if (!target) return;
    const text = String(wayText || '').trim();
    if (!text) {
      target.innerHTML = `<span style="font-size:12px;color:var(--text2);">취득 방법 정보가 없습니다.</span>`;
      return;
    }

    const steps = text
      .replace(/\r\n/g, '\n')
      .split(/(?=①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|\n)/)
      .map(step => step.trim())
      .map(step => step.replace(/^\n+|\n+$/g, ''))
      .filter(Boolean);

    if (steps.length > 1) {
      target.innerHTML = steps.map((step, idx) => `
        <div class="job-detail-resp-item">
          <span class="job-detail-resp-num">${idx + 1}.</span>
          <span>${escapeHtml(step)}</span>
        </div>
      `).join('');
      return;
    }

    target.innerHTML = `
      <div class="job-detail-resp-item">
        <span class="job-detail-resp-num">1.</span>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  },

  fillProspect(target, prospectText) {
    if (!target) return;
    const text = String(prospectText || '').trim();
    if (!text) {
      target.innerHTML = `<span style="font-size:12px;color:var(--text2);">진로 및 전망 정보가 없습니다.</span>`;
      return;
    }

    // '-'로 구분된 단락 처리
    const items = text
      .split('-')
      .map(item => item.trim())
      .filter(Boolean);

    if (items.length > 1) {
      target.innerHTML = items.map((item, idx) => `
        <div class="job-detail-resp-item">
          <span class="job-detail-resp-num">${idx + 1}.</span>
          <span>${escapeHtml(item)}</span>
        </div>
      `).join('');
      return;
    }

    target.innerHTML = `
      <div class="job-detail-resp-item">
        <span class="job-detail-resp-num">1.</span>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  },

  fillRelatedJobs(target, arr) {
    if (!target) return;
    if (!arr || arr.length === 0) {
      target.innerHTML = `<span style="font-size:12px;color:var(--text2);">관련 직무 정보가 없습니다.</span>`;
      return;
    }
    target.innerHTML = '';
    arr.forEach(name => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = name;
      span.style.cursor = 'pointer';
      span.addEventListener('click', () => {
        // 클릭하면 직무 검색 탭으로 이동 후 키워드로 검색
        switchCareerTab('job', document.querySelector('.tabs .tab-btn[onclick*="job"]') || document.querySelector('.tabs .tab-btn'));
        const input = document.getElementById('career-search-keyword');
        if (input) {
          input.value = name;
          searchModule.run().catch(err => console.error('Error searching careers from related job tag:', err));
        }
      });
      target.appendChild(span);
    });
  },
};
function showCertDetail(name) { certModalModule.show(name); }


// ============ 7. 직무 모달 모듈 ============
const jobModalModule = {
  // 모달에 직무 정보 채우고 표시
  open(data, jobCode) {
    
    document.getElementById('jd-save-btn').dataset.jobcode = jobCode;
    document.getElementById('jd-title').textContent = data.title;
    document.getElementById('jd-category').textContent = data.category || '';
    document.getElementById('jd-desc').textContent = data.description;
    document.getElementById('jd-way').textContent = data.waysToAcquire?.join('\n') || '';

    // 연봉
    const fmt = n => n ? `${(n / 10000).toLocaleString()}만원` : '-';
    document.getElementById('jd-sal-lower').textContent  = fmt(data.averageSalary?.lower25);
    document.getElementById('jd-sal-median').textContent = fmt(data.averageSalary?.median50);
    document.getElementById('jd-sal-upper').textContent  = fmt(data.averageSalary?.upper25);

    // 태그 필드
    this.fillTags('jd-abilities',       data.abilities);
    this.fillTags('jd-knowledge',       data.knowledge);
    this.fillTags('jd-characteristics', data.characteristics);
    this.fillTags('jd-departments',     data.relatedDepartments);
    this.fillTags('jd-certs',           data.relatedCertifications);
    this.fillTags('jd-occupations',     data.relatedOccupations);

    this.fillResponsibilities(data.responsibilities);

    document.getElementById('job-detail-modal').style.display = 'flex';
  },
  // 메서드 추가
  fillResponsibilities(arr) {
    const el = document.getElementById('jd-responsibilities');
    if (!el) return;
    if (!arr || arr.length === 0) {
      el.innerHTML = `<span style="font-size:12px;color:var(--text2);">정보 없음</span>`;
      return;
    }
    el.innerHTML = arr.map((task, i) => `
      <div class="job-detail-resp-item">
        <span class="job-detail-resp-num">${i + 1}.</span>
        <span>${escapeHtml(task)}</span>
      </div>
    `).join('');
  },

  fillTags(id, arr) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!arr || arr.length === 0) {
      el.innerHTML = `<span style="font-size:12px;color:var(--text2);">정보 없음</span>`;
      return;
    }
    el.innerHTML = '';
    arr.forEach(name => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = name;
      el.appendChild(span);
    });
  },

  // 직무 상세 정보 가져와서 모달 열기
  async openByCode(jobCode, jobSeq) {
    try {
      const data = await fetch(`/career/detail/${jobCode}?seq=${jobSeq}`).then(res => res.json());
      this.open(data, jobCode);
    } catch (err) {
      console.error('직무 상세 정보 로딩 실패:', err);
    }
  },

  // 저장 버튼: DB에 저장
  async save(jobCode) {
    try {
      const res = await fetch(`/career/save/${jobCode}`, { method: 'POST' });
      const result = await res.json();
      if (result.success) alert('직무가 저장되었습니다!');
    } catch (err) {
      console.error('직무 저장 실패:', err);
    }
  },

  init() {
    // 저장 버튼
    const saveBtn = document.getElementById('jd-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const jobCode = saveBtn.dataset.jobcode;
        if (jobCode) this.save(jobCode);
      });
    }

    // 카드 클릭 → 모달 열기 (이벤트 위임)
    const list = document.getElementById('career-search-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const card = e.target.closest('.career-result-card');
        if (!card) return;
        const jobCode = card.dataset.jobcode;
        const jobSeq  = card.dataset.jobseq;
        this.openByCode(jobCode, jobSeq);
      });
    }
  },
};
function openJobDetailModal(data, jobCode) { jobModalModule.open(data, jobCode); }


// ============ 8. 검색 / 페이지네이션 모듈 ============
const searchModule = {
  // 검색 실행
  async run() {
    const depth1 = document.getElementById('depth1')?.value || '';
    const depth2 = document.getElementById('depth2')?.value || '';
    const depth3 = document.getElementById('depth3')?.value || '';
    const depth4 = document.getElementById('depth4')?.value || '';
    const keyword = document.getElementById('career-search-keyword')?.value?.trim() || '';

    const metaEl = document.getElementById('career-search-meta');
    if (metaEl) {
      const selected = [depth1, depth2, depth3, depth4].filter(Boolean);
      metaEl.textContent = selected.length
        ? `선택 분류: ${selected.join(' > ')}`
        : '분류를 선택해 주세요.';
    }

    if (!depth1 && !depth2 && !depth3 && !depth4) {
      alert('카테고리를 먼저 선택해야 검색할 수 있습니다.');
      return;
    }

    if (!depth1 && !depth2 && !depth3 && !depth4 && !keyword) {
      this.render([], '검색 결과');
      return;
    }

    const params = new URLSearchParams();
    if (depth1) params.set('depth1_name', depth1);
    if (depth2) params.set('depth2_name', depth2);
    if (depth3) params.set('depth3_name', depth3);
    if (depth4) params.set('depth4_name', depth4);

    const res = await fetch(`/career/search?${params.toString()}`);
    const items = await res.json();

    const filteredItems = keyword
      ? items.filter(item => `${item.jobName} ${item.jobDescription} ${item.jobCode}`.includes(keyword))
      : items;

    const metaText = [depth1, depth2, depth3, depth4].filter(Boolean).join(' > ') || '전체 결과';
    careerSearchState = {
      items: filteredItems,
      page: 1,
      metaText,
      keyword,
    };
    this.render(careerSearchState.items, careerSearchState.metaText, careerSearchState.page);
  },

  // 결과 렌더링
  render(items, metaText, page = 1) {
    const wrap = document.getElementById('career-search-results');
    const title = document.getElementById('career-search-title');
    const count = document.getElementById('career-search-count');
    const list = document.getElementById('career-search-list');
    if (!wrap || !title || !count || !list) return;

    wrap.style.display = 'block';
    title.textContent = metaText || '검색 결과';
    const totalPages = Math.max(1, Math.ceil(items.length / CAREER_PAGE_SIZE));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (currentPage - 1) * CAREER_PAGE_SIZE;
    const pageItems = items.slice(startIndex, startIndex + CAREER_PAGE_SIZE);

    count.textContent = `${items.length}건 · ${currentPage}/${totalPages}페이지`;

    if (!items.length) {
      list.innerHTML = `<div class="career-empty-state">선택한 분류에 해당하는 진로 정보가 없습니다.</div>`;
      const controls = document.getElementById('career-search-pagination');
      const pageInfo = document.getElementById('career-search-page-info');
      if (controls) controls.innerHTML = '';
      if (pageInfo) pageInfo.textContent = '';
      return;
    }

    list.innerHTML = pageItems.map(item => `
      <div class="career-result-card" data-jobcode="${escapeHtml(item.jobCode)}" data-jobseq="${escapeHtml(item.jobSeq || '1')}">
        <div class="career-result-top">
          <div class="career-result-name">${escapeHtml(item.jobName)}</div>
          <span class="badge badge-blue">${escapeHtml(item.jobCategory || '')}</span>
        </div>
        <div class="career-result-code">직무코드: ${escapeHtml(item.jobCode)}</div>
      </div>
    `).join('');

    this.renderPagination(items.length, currentPage, CAREER_PAGE_SIZE);
  },

  // 페이지네이션 컨트롤 렌더링
  renderPagination(totalItems, currentPage, pageSize) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const controls = document.getElementById('career-search-pagination');
    const pageInfo = document.getElementById('career-search-page-info');
    if (!controls || !pageInfo) return;

    pageInfo.textContent = `${currentPage} / ${totalPages}`;
    if (totalItems <= pageSize) {
      controls.innerHTML = '';
      return;
    }

    const pageButtons = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    for (let page = startPage; page <= endPage; page += 1) {
      pageButtons.push(`<button class="career-page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`);
    }
    controls.innerHTML = `
      <button class="career-page-btn" data-nav="prev" ${currentPage === 1 ? 'disabled' : ''}>이전</button>
      ${pageButtons.join('')}
      <button class="career-page-btn" data-nav="next" ${currentPage === totalPages ? 'disabled' : ''}>다음</button>
    `;
    controls.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        const page = Number(btn.dataset.page);
        if (nav === 'prev' && careerSearchState.page > 1) {
          careerSearchState.page -= 1;
        } else if (nav === 'next' && careerSearchState.page < totalPages) {
          careerSearchState.page += 1;
        } else if (page) {
          careerSearchState.page = page;
        }
        this.render(careerSearchState.items, careerSearchState.metaText, careerSearchState.page);
      });
    });
  },

  init() {
    const searchBtn = document.getElementById('career-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.run().catch(err => console.error('Error searching careers:', err));
      });
    }

    updateCareerSearchAvailability();
  },
};
// 외부 참조용 별칭 (다른 곳에서 호출하지 않으면 제거 가능)
async function searchCareerJobs() { return searchModule.run(); }


// ============ 9. 카테고리 드롭다운 모듈 ============
const dropdownModule = {
  async init() {
    try {
      const res = await fetch('../career/categories');
      const categories = (await res.json()) || [];
      this.setup(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  },

  setup(categoriesData) {
    const depth1Select = document.getElementById('depth1');
    const depth2Select = document.getElementById('depth2');
    const depth3Select = document.getElementById('depth3');
    const depth4Select = document.getElementById('depth4');

    const reset = (select, placeholder) => clearSelect(select, placeholder || '선택');

    // 대분류 채우기
    const depth1Set = new Set();
    categoriesData.forEach(cat => { if (cat.depth1_name) depth1Set.add(cat.depth1_name); });
    reset(depth1Select, '대분류 선택');
    reset(depth2Select, '중분류 선택');
    reset(depth3Select, '소분류 선택');
    reset(depth4Select, '세분류 선택');
    appendOptions(depth1Select, depth1Set);

    // 대분류 → 중분류
    depth1Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      reset(depth2Select, '중분류 선택');
      reset(depth3Select, '소분류 선택');
      reset(depth4Select, '세분류 선택');
      updateCareerSearchAvailability();
      if (!sel1) return;
      const set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name) set.add(cat.depth2_name);
      });
      appendOptions(depth2Select, set);
    });

    // 중분류 → 소분류
    depth2Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      const sel2 = depth2Select.value;
      reset(depth3Select, '소분류 선택');
      reset(depth4Select, '세분류 선택');
      updateCareerSearchAvailability();
      if (!sel2) return;
      const set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name === sel2 && cat.depth3_name) set.add(cat.depth3_name);
      });
      appendOptions(depth3Select, set);
    });

    // 소분류 → 세분류
    depth3Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      const sel2 = depth2Select.value;
      const sel3 = depth3Select.value;
      reset(depth4Select, '세분류 선택');
      updateCareerSearchAvailability();
      if (!sel3) return;
      const set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name === sel2 && cat.depth3_name === sel3 && cat.depth4_name) {
          set.add(cat.depth4_name);
        }
      });
      appendOptions(depth4Select, set);
    });

    // 페이지 로드 시 기본값이 있으면 트리거
    if (depth1Select.value) {
      depth1Select.dispatchEvent(new Event('change'));
      if (depth2Select.value) {
        depth2Select.dispatchEvent(new Event('change'));
        if (depth3Select.value) {
          depth3Select.dispatchEvent(new Event('change'));
          if (depth4Select.value) {
            depth4Select.dispatchEvent(new Event('change'));
          }
        }
      }
    }

    updateCareerSearchAvailability();
  },
};

// 드롭다운 모듈2(자격증 카테고리 옵션 채우기)
const dropdownModule2 = {
  async init() {
    try {
      const res = await fetch('../career/cert-categories');
      const categories = (await res.json()) || [];
      this.setup(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  },

  setup(categoriesData) {
    const depth1Select = document.getElementById('cert_depth1');
    const depth2Select = document.getElementById('cert_depth2');
    const depth3Select = document.getElementById('cert_depth3');

    const reset = (select, placeholder) => clearSelect(select, placeholder || '선택');

    // 대분류 채우기
    const depth1Set = new Set();
    categoriesData.forEach(cat => { if (cat.field1) depth1Set.add(cat.field1); });
    reset(depth1Select, '대분류 선택');
    reset(depth2Select, '중분류 선택');
    reset(depth3Select, '등급 선택');
    appendOptions(depth1Select, depth1Set);

    // 대분류 → 중분류
    depth1Select.addEventListener('change', () => {
  const sel1 = depth1Select.value;
  reset(depth2Select, '중분류 선택');
  reset(depth3Select, '등급 선택');
  
  if (!sel1) return;
  
  // ✅ 국가전문자격이면 중분류/등급 비활성화
  if (sel1 === '국가전문자격') {
    depth2Select.disabled = true;
    depth3Select.disabled = true;
    return;
  }
  
  depth2Select.disabled = false;
  depth3Select.disabled = false;
  
  const set = new Set();
  categoriesData.forEach(cat => {
    if (cat.field1 === sel1 && cat.field2) set.add(cat.field2);
  });
  appendOptions(depth2Select, set);
});

    // 중분류 → 등급
    depth2Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      const sel2 = depth2Select.value;
      reset(depth3Select, '등급 선택');
      if (!sel2) return;
      const set = new Set();
      categoriesData.forEach(cat => {
        if (cat.field1 === sel1 && cat.field2 === sel2 && cat.seriesName) set.add(cat.seriesName);
      });
      appendOptions(depth3Select, set);
    });

    // 페이지 로드 시 기본값이 있으면 트리거
    if (depth1Select.value) {
      depth1Select.dispatchEvent(new Event('change'));
      if (depth2Select.value) {
        depth2Select.dispatchEvent(new Event('change'));
        if (depth3Select.value) {
          depth3Select.dispatchEvent(new Event('change'));
        }
      }
    }
  },
};


// ============ 10. 모달 외부 클릭 닫기 ============
const modalCloseModule = {
  init() {
    ['cert-detail-modal', 'job-detail-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => {
        if (e.target === el) el.style.display = 'none';
      });
    });
  },
};
// 자격증 목록 검색 모듈 (드롭다운과 검색 결과 렌더링 담당)
const certSearchModule = {
  async run() {
    const field1     = document.getElementById('cert_depth1')?.value || '';
    const field2     = document.getElementById('cert_depth2')?.value || '';
    const seriesName = document.getElementById('cert_depth3')?.value || '';
    const keyword    = document.getElementById('cert-search-keyword')?.value?.trim() || '';

    if (!field1 && !field2 && !seriesName && !keyword) {
      certSearchState = {
        items: [],
        page: 1,
        metaText: '검색 결과',
        keyword: '',
      };
      this.render(certSearchState.items, certSearchState.metaText, certSearchState.page);
      return;
    }

    const params = new URLSearchParams();
    if (field1)     params.set('field1', field1);
    if (field2)     params.set('field2', field2);
    if (seriesName) params.set('seriesName', seriesName);
    if (keyword)    params.set('keyword', keyword);

    const res = await fetch(`/career/search-cert?${params.toString()}`);
    const items = await res.json();

    const metaText = [field1, field2, seriesName].filter(Boolean).join(' > ') || '전체 결과';
    certSearchState = {
      items,
      page: 1,
      metaText,
      keyword,
    };
    this.render(certSearchState.items, certSearchState.metaText, certSearchState.page);
  },

  render(items, metaText, page = 1) {
    const wrap = document.getElementById('cert-search-results');
    const list = document.getElementById('cert-search-list') || wrap?.querySelector('.grid-3');
    const title = document.getElementById('cert-search-title');
    const count = document.getElementById('cert-search-count');
    if (!wrap || !list || !title || !count) return;

    wrap.style.display = 'block';
    title.textContent = metaText || '검색 결과';

    const totalPages = Math.max(1, Math.ceil(items.length / CAREER_PAGE_SIZE));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (currentPage - 1) * CAREER_PAGE_SIZE;
    const pageItems = items.slice(startIndex, startIndex + CAREER_PAGE_SIZE);

    count.textContent = `${items.length}건 · ${currentPage}/${totalPages}페이지`;

    if (!items.length) {
      list.innerHTML = `<div class="career-empty-state">조건에 맞는 자격증이 없습니다.</div>`;
      const controls = document.getElementById('cert-search-pagination');
      const pageInfo = document.getElementById('cert-search-page-info');
      if (controls) controls.innerHTML = '';
      if (pageInfo) pageInfo.textContent = '';
      return;
    }

    list.innerHTML = pageItems.map(item => `
      <div class="career-result-card" data-jmcd="${escapeHtml(item.jmcd)}" data-official-url="${escapeHtml(item.officialUrl || '')}" data-way="${escapeHtml(item.way || '')}" data-career-path="${escapeHtml(item.careerPath || '')}" data-cert-name="${escapeHtml(item.name)}" data-series-name="${escapeHtml(item.seriesName || '')}" data-field1="${escapeHtml(item.field1 || '')}" data-field2="${escapeHtml(item.field2 || '')}" data-description="${escapeHtml(item.description || '')}" data-related-jobs="${escapeHtml((item.relatedJobs || []).join('|'))}">  
        <div class="career-result-top">
          <div class="career-result-name">${escapeHtml(item.name)}</div>
          <span class="badge badge-blue">${escapeHtml(item.seriesName || '')}</span>
        </div>
        <div class="career-result-code">${escapeHtml(item.field1)} ${item.field2 ? `> ${escapeHtml(item.field2)}` : ''}</div>
      </div>
    `).join('');

    this.renderPagination(items.length, currentPage, CAREER_PAGE_SIZE);
  },

  renderPagination(totalItems, currentPage, pageSize) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const controls = document.getElementById('cert-search-pagination');
    const pageInfo = document.getElementById('cert-search-page-info');
    if (!controls || !pageInfo) return;

    pageInfo.textContent = `${currentPage} / ${totalPages}`;
    if (totalItems <= pageSize) {
      controls.innerHTML = '';
      return;
    }

    const pageButtons = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    for (let page = startPage; page <= endPage; page += 1) {
      pageButtons.push(`<button class="career-page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`);
    }

    controls.innerHTML = `
      <button class="career-page-btn" data-nav="prev" ${currentPage === 1 ? 'disabled' : ''}>이전</button>
      ${pageButtons.join('')}
      <button class="career-page-btn" data-nav="next" ${currentPage === totalPages ? 'disabled' : ''}>다음</button>
    `;

    controls.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        const page = Number(btn.dataset.page);
        if (nav === 'prev' && certSearchState.page > 1) {
          certSearchState.page -= 1;
        } else if (nav === 'next' && certSearchState.page < totalPages) {
          certSearchState.page += 1;
        } else if (page) {
          certSearchState.page = page;
        }
        this.render(certSearchState.items, certSearchState.metaText, certSearchState.page);
      });
    });
  },

  init() {
    const searchBtn = document.getElementById('cert-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.run().catch(err => console.error('Error searching certs:', err));
      });
    }

    const list = document.getElementById('cert-search-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const card = e.target.closest('.career-result-card');
        if (!card) return;

        const name = card.dataset.certName;
        if (!name) return;

        const relatedJobs = card.dataset.relatedJobs ? card.dataset.relatedJobs.split('|').filter(Boolean) : [];
        certModalModule.show(name, {
          jmcd: card.dataset.jmcd,
          officialUrl: card.dataset.officialUrl,
          way: card.dataset.way,
          description: card.dataset.description,
          careerPath: card.dataset.careerPath,
          field1: card.dataset.field1,
          field2: card.dataset.field2,
          seriesName: card.dataset.seriesName,
          relatedJobs,
        });
      });
    }
  },
};

// ============ 11. 진입점 ============
document.addEventListener('DOMContentLoaded', () => {
  modalCloseModule.init();
  certRecommendModule.update();
  jobModalModule.init();
  certModalModule.init();
  searchModule.init();
  dropdownModule.init();
  dropdownModule2.init();
  certSearchModule.init();
});
