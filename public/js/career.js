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
