/* ================================================
   AcadMe — career.js
   진로정보 페이지 전용:
   자격증/직무 탭, 직무별 자격증 추천, 세부 모달
   ================================================ */

// ── 탭 전환 ──────────────────────────────────────
function switchCareerTab(tab, btn) {
  ['cert', 'job'].forEach(t => {
    document.getElementById('ca-' + t).style.display = 'none';
  });
  document.getElementById('ca-' + tab).style.display = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 직무별 추천 자격증 데이터 ─────────────────────
const jobCertData = {
  backend: {
    name: '백엔드 개발자',
    certs: [
      { name:'정보처리기사', field:'IT',    org:'한국산업인력공단',   diff:'★★★★☆', pass:34, next:'2026.05.18', dday:'D-28', color:'blue',   owned:true  },
      { name:'SQLD',         field:'IT',    org:'한국데이터산업진흥원', diff:'★★★☆☆', pass:52, next:'2026.06.14', dday:'D-57', color:'blue',   owned:true  },
      { name:'AWS SAA',      field:'클라우드', org:'Amazon',          diff:'★★★★☆', pass:61, next:'상시 시험',  dday:null,   color:'amber',  owned:false },
    ]
  },
  data: {
    name: '데이터 엔지니어',
    certs: [
      { name:'SQLD',          field:'IT', org:'한국데이터산업진흥원', diff:'★★★☆☆', pass:52, next:'2026.06.14', dday:'D-57',  color:'blue',  owned:true  },
      { name:'ADsP',          field:'IT', org:'한국데이터산업진흥원', diff:'★★★☆☆', pass:58, next:'2026.07.20', dday:'D-83',  color:'blue',  owned:false },
      { name:'빅데이터분석기사', field:'IT', org:'한국데이터산업진흥원', diff:'★★★★☆', pass:41, next:'2026.06.01', dday:'D-44',  color:'amber', owned:false },
    ]
  },
  devops: {
    name: 'DevOps 엔지니어',
    certs: [
      { name:'AWS SAA',      field:'클라우드', org:'Amazon',              diff:'★★★★☆', pass:61, next:'상시 시험',  dday:null,    color:'amber',  owned:false },
      { name:'리눅스마스터 1급', field:'IT',    org:'한국정보통신진흥협회', diff:'★★★★★', pass:22, next:'2026.08.08', dday:'D-100', color:'purple', owned:false },
      { name:'정보처리기사',   field:'IT',    org:'한국산업인력공단',      diff:'★★★★☆', pass:34, next:'2026.05.18', dday:'D-28',  color:'blue',   owned:true  },
    ]
  },
  frontend: {
    name: '프론트엔드 개발자',
    certs: [
      { name:'정보처리기사', field:'IT',    org:'한국산업인력공단', diff:'★★★★☆', pass:34, next:'2026.05.18', dday:'D-28', color:'blue',  owned:true  },
      { name:'웹디자인기능사', field:'디자인', org:'한국산업인력공단', diff:'★★☆☆☆', pass:71, next:'2026.06.22', dday:'D-65', color:'green', owned:false },
      { name:'GTQ(포토샵)',  field:'디자인', org:'한국생산성본부',   diff:'★★☆☆☆', pass:68, next:'상시 시험',  dday:null,   color:'green', owned:false },
    ]
  },
  security: {
    name: '정보보안 전문가',
    certs: [
      { name:'정보보안기사',   field:'IT', org:'한국인터넷진흥원',    diff:'★★★★★', pass:18, next:'2026.05.09', dday:'D-19', color:'red',   owned:false },
      { name:'정보처리기사',   field:'IT', org:'한국산업인력공단',    diff:'★★★★☆', pass:34, next:'2026.05.18', dday:'D-28', color:'blue',  owned:true  },
      { name:'네트워크관리사', field:'IT', org:'한국정보통신자격협회', diff:'★★★☆☆', pass:47, next:'상시 시험',  dday:null,   color:'amber', owned:false },
    ]
  }
};

const fillMap  = { blue:'fill-blue', green:'fill-green', amber:'fill-amber', red:'fill-red', purple:'fill-purple' };
const badgeMap = { blue:'badge-blue', green:'badge-green', amber:'badge-amber', red:'badge-red', purple:'badge-purple' };
const CAREER_PAGE_SIZE = 10;

let careerSearchState = {
  items: [],
  page: 1,
  metaText: '검색 결과',
  keyword: '',
};

function updateJobCertRec() {
  const sel  = document.getElementById('job-select-cert').value;
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
}

// ── 자격증 세부 모달 ──────────────────────────────
const certDetailData = {
  '정보처리기사': {
    overview: '컴퓨터 하드웨어 및 소프트웨어, 데이터통신, 데이터베이스, 시스템 분석·설계 등 정보기술 전반에 걸친 전문 지식과 실무 능력을 평가하는 국가기술자격입니다. 한국산업인력공단 주관으로 연 2회 시행됩니다.',
    prospect: '소프트웨어 개발, IT 기획·관리, 정보보안, 데이터 분석 등 IT 전반 분야에서 취업 시 우대 사항으로 활용됩니다.',
    duties:   ['응용SW 설계 및 구현', '소프트웨어 품질 검증 및 테스팅', '데이터베이스 설계 및 운영', '네트워크 및 보안 시스템 관리', 'IT 프로젝트 기획 및 관리']
  },
  'SQLD': {
    overview: 'SQL 개발자(SQLD) 자격은 데이터베이스와 데이터 모델링에 대한 이해를 바탕으로 SQL 작성 능력을 평가합니다. 한국데이터산업진흥원에서 연 2회 시행합니다.',
    prospect: '데이터베이스 관련 업무를 담당하는 개발자, DBA, 데이터 분석가 등을 목표로 하는 취업 준비생에게 기본 필수 자격증입니다.',
    duties:   ['SQL 쿼리 작성 및 최적화', '데이터 모델링 및 설계', '데이터베이스 성능 분석', 'ETL 업무 지원', '데이터 품질 관리']
  },
  'AWS SAA': {
    overview: 'AWS Certified Solutions Architect – Associate는 AWS 클라우드 기반의 확장 가능하고 가용성 높은 시스템 설계 능력을 인증하는 공식 자격증입니다.',
    prospect: '클라우드 아키텍트, DevOps 엔지니어, 솔루션 컨설턴트 등으로 진출할 수 있으며 연봉 프리미엄이 높은 자격증입니다.',
    duties:   ['AWS 인프라 아키텍처 설계', 'EC2·S3·RDS 등 핵심 서비스 운영', '비용 최적화 및 보안 설계', '고가용성 시스템 구축', '마이그레이션 계획 수립']
  }
};

function showCertDetail(name) {
  const d = certDetailData[name];
  if (!d) return;
  document.getElementById('cd-title').textContent    = name;
  document.getElementById('cd-overview').textContent = d.overview;
  document.getElementById('cd-prospect').textContent = d.prospect;
  document.getElementById('cd-duties').innerHTML = d.duties.map(duty => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius-sm);">
      <span style="color:var(--accent);font-weight:800;flex-shrink:0;">✓</span>
      <span style="font-size:13px;color:var(--text);">${duty}</span>
    </div>`).join('');
  document.getElementById('cert-detail-modal').style.display = 'flex';
}

// ── 직무 세부 모달 ────────────────────────────────
const jobDetailData = {
  '웹 개발자': {
    departments: ['컴퓨터공학과', '소프트웨어공학과', '정보통신공학과', '전자공학과'],
    desc:   '인터넷 브라우저를 통해 실행되는 웹 사이트나 웹 애플리케이션을 기획, 설계 및 구축합니다.',
    skills: ['JavaScript', 'React / Vue', 'Node.js', 'Spring Boot', 'REST API', 'SQL', 'Git', 'Docker'],
    certs:  ['정보처리기사', 'SQLD', 'OCP', 'AWS SAA']
  },
  '데이터 분석가': {
    departments: ['통계학과', '데이터사이언스학과', '수학과', '컴퓨터공학과'],
    desc:   '대규모 데이터를 수집, 정제, 분석하여 비즈니스 의사결정에 필요한 인사이트를 도출합니다.',
    skills: ['Python', 'R', 'SQL', 'Tableau', 'Power BI', 'pandas', 'scikit-learn'],
    certs:  ['SQLD', 'ADsP', '빅데이터분석기사']
  },
  'DevOps 엔지니어': {
    departments: ['컴퓨터공학과', '정보보안학과', '전기전자공학과'],
    desc:   '개발과 운영을 통합하여 소프트웨어 배포 파이프라인을 자동화합니다.',
    skills: ['Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'Terraform', 'AWS', 'Linux'],
    certs:  ['AWS SAA', '리눅스마스터 1급', '정보처리기사']
  }
};
// 직무 세부 정보 모달에 데이터 채워서 보여주기
function showJobDetail(name) {
  const d = jobDetailData[name];
  if (!d) return;
  document.getElementById('jd-title').textContent = name;
  document.getElementById('jd-desc').textContent  = d.desc;
  document.getElementById('jd-departments').innerHTML = d.departments.map(dep =>
    `<span style="background:var(--accent-bg);border:1px solid var(--accent);color:var(--accent);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;">${dep}</span>`).join('');
  document.getElementById('jd-skills').innerHTML = d.skills.map(sk =>
    `<span style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;">${sk}</span>`).join('');
  document.getElementById('jd-certs').innerHTML = d.certs.map(c =>
    `<span style="background:var(--amber-bg);border:1px solid var(--amber);color:var(--amber);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;">🏆 ${c}</span>`).join('');
  document.getElementById('job-detail-modal').style.display = 'flex';
}

// ── 모달 외부 클릭 닫기 ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['cert-detail-modal', 'job-detail-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
  });
  updateJobCertRec();
});

function clearSelect(select, placeholder) {
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = placeholder;
  select.appendChild(option);
}
// ── 진로 검색 ─────────────────────────────────────
// escapHtml은 XSS 방지용으로, API에서 받은 데이터는 신뢰할 수 없으므로 반드시 escapeHtml 함수를 거쳐야 합니다.
//xss란 공격자가 악의적인 스크립트를 웹사이트에 삽입하여 다른 사용자의 브라우저에서 실행되도록 하는 보안 취약점입니다. 이를 방지하기 위해 escapeHtml 함수는 특수 문자를 HTML 엔티티로 변환하여 스크립트가 실행되지 않도록 합니다.
function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
 // 진로 검색 결과 렌더링 및 페이지네이션
function renderCareerPagination(totalItems, currentPage, pageSize) {
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
    pageButtons.push(`
      <button class="career-page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>
    `);
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
      renderCareerSearchResults(careerSearchState.items, careerSearchState.metaText, careerSearchState.page);
    });
  });
}
// 진로 검색 결과 렌더링
function renderCareerSearchResults(items, metaText, page = 1) {
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
    list.innerHTML = `
      <div class="career-empty-state">
        선택한 분류에 해당하는 진로 정보가 없습니다.
      </div>`;
    const controls = document.getElementById('career-search-pagination');
    const pageInfo = document.getElementById('career-search-page-info');
    if (controls) controls.innerHTML = '';
    if (pageInfo) pageInfo.textContent = '';
    return;
  }

  list.innerHTML = pageItems.map(item => `
    <div class="career-result-card">
      <div class="career-result-top">
        <div class="career-result-name">${escapeHtml(item.jobName)}</div>
        <span class="badge badge-blue">${escapeHtml(item.jobCategory || '')}</span>
      </div>
      <div class="career-result-code">직무코드: ${escapeHtml(item.jobCode)}</div>
      <div class="career-result-desc">${escapeHtml(item.jobDescription || '상세 설명이 없습니다.')}</div>
    </div>
  `).join('');

  renderCareerPagination(items.length, currentPage, CAREER_PAGE_SIZE);
}
// 진로 검색 실행
async function searchCareerJobs() {
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

  if (!depth1 && !depth2 && !depth3 && !depth4 && !keyword) {
    renderCareerSearchResults([], '검색 결과');
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
  renderCareerSearchResults(careerSearchState.items, careerSearchState.metaText, careerSearchState.page);
}
// Set 객체를 순회하며 option 요소를 생성하여 select 요소에 추가하는 함수
function appendOptions(select, nameSet) {
  nameSet.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}
//db에서 드롭다운 메뉴에 들어갈 대분류, 중분류, 소분류, 세분류 정보 가져오기
fetch('../career/categories')
  .then(res => res.json())
  .then(categories => {
    const categoriesData = categories || [];
    const depth1Select = document.getElementById('depth1');
    const depth2Select = document.getElementById('depth2');
    const depth3Select = document.getElementById('depth3');
    const depth4Select = document.getElementById('depth4');

    function resetSelect(select, placeholder) {
      clearSelect(select, placeholder || '선택');
    }

    // 대분류 목록 채우기
    const depth1Set = new Set();
    categoriesData.forEach(cat => { if (cat.depth1_name) depth1Set.add(cat.depth1_name); });
    resetSelect(depth1Select, '대분류 선택');
    resetSelect(depth2Select, '중분류 선택');
    resetSelect(depth3Select, '소분류 선택');
    resetSelect(depth4Select, '세분류 선택');

    appendOptions(depth1Select, depth1Set);

    // 대분류 선택 시 중분류 채우기
    depth1Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      resetSelect(depth2Select, '중분류 선택');
      resetSelect(depth3Select, '소분류 선택');
      resetSelect(depth4Select, '세분류 선택');
      if (!sel1) return;
      const depth2Set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name) depth2Set.add(cat.depth2_name);
      });
      appendOptions(depth2Select, depth2Set);
    });

    // 중분류 선택 시 소분류 채우기
    depth2Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      const sel2 = depth2Select.value;
      resetSelect(depth3Select, '소분류 선택');
      resetSelect(depth4Select, '세분류 선택');
      if (!sel2) return;
      const depth3Set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name === sel2 && cat.depth3_name) depth3Set.add(cat.depth3_name);
      });
      appendOptions(depth3Select, depth3Set);
    });

    depth3Select.addEventListener('change', () => {
      const sel1 = depth1Select.value;
      const sel2 = depth2Select.value;
      const sel3 = depth3Select.value;
      resetSelect(depth4Select, '세분류 선택');
      if (!sel3) return;
      const depth4Set = new Set();
      categoriesData.forEach(cat => {
        if (cat.depth1_name === sel1 && cat.depth2_name === sel2 && cat.depth3_name === sel3 && cat.depth4_name) {
          depth4Set.add(cat.depth4_name);
        }
      });
      appendOptions(depth4Select, depth4Set);
    });

    // (선택사항) 페이지 로드 시 기본값이 있으면 트리거
    if (depth1Select.value) {
      depth1Select.dispatchEvent(new Event('change'));
      // depth2가 채워진 이후에 실행되어야 함
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
    const searchBtn = document.getElementById('career-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        searchCareerJobs().catch(err => console.error('Error searching careers:', err));
      });
    }
  })
  .catch(err => console.error('Error fetching categories:', err));
