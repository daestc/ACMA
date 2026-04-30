/* ================================================
   AcadMe — academic.js
   학사관리 페이지 전용:
   GPA 계산기, 이수현황, 졸업요건 설정, 목표 시뮬레이터
   ================================================ */

// ── 탭 전환 ──────────────────────────────────────
function switchAcademicTab(tab, btn) {
  ['gpa', 'credit', 'grad', 'sim'].forEach(t => {
    document.getElementById('ac-' + t).style.display = 'none';
  });
  document.getElementById('ac-' + tab).style.display = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── GPA 계산기 ────────────────────────────────────
const gradeMap = {
  'A+': 4.5, 'A': 4.0,
  'B+': 3.5, 'B': 3.0,
  'C+': 2.5, 'C': 2.0,
  'D+': 1.5, 'D': 1.0,
  'F':  0
};

function calcGPA() {
  const rows = document.querySelectorAll('#subject-list .subject-row');
  let pts = 0, creds = 0;

  rows.forEach(r => {
    const selects = r.querySelectorAll('select');
    const c = parseInt(selects[0].value) || 3;
    const g = selects[1].value;
    pts   += (gradeMap[g] ?? 0) * c;
    creds += c;
  });

  document.getElementById('gpa-result').textContent = creds
    ? (pts / creds).toFixed(2)
    : '0.00';
}

function addSubjectRow() {
  const list = document.getElementById('subject-list');
  const row  = document.createElement('div');
  row.className = 'subject-row';
  row.innerHTML = `
    <input  class="input-field" placeholder="과목명" style="flex:2;">
    <select class="select-field">
      <option>3학점</option><option>2학점</option><option>1학점</option>
    </select>
    <select class="select-field" onchange="calcGPA()">
      <option>B+</option><option>A+</option><option>A</option><option>B</option>
      <option>C+</option><option>C</option><option>D+</option><option>D</option><option>F</option>
    </select>
    <button class="btn btn-ghost btn-sm"
      onclick="this.closest('.subject-row').remove(); calcGPA()">✕</button>`;
  list.appendChild(row);
}

// ── 목표 GPA 시뮬레이터 ───────────────────────────
function calcSim() {
  const target     = parseFloat(document.getElementById('target-gpa').value)  || 3.9;
  const next       = parseInt(document.getElementById('next-credits').value)   || 18;
  const curGPA     = 3.80;   // TODO: 실제 데이터로 교체
  const curCredits = 96;     // TODO: 실제 데이터로 교체

  const needed = ((target * (curCredits + next)) - (curGPA * curCredits)) / next;
  const grade  = needed >= 4.25 ? 'A+' : needed >= 4.0 ? 'A' : needed >= 3.5 ? 'B+' : needed >= 3.0 ? 'B' : 'C 이상';

  document.getElementById('sim-result').textContent = needed.toFixed(2);
  document.getElementById('sim-desc').innerHTML =
    `최소 <strong style="color:var(--amber);">${grade}</strong> 이상 받아야 합니다.`;

  if (needed > 4.5) {
    document.getElementById('sim-desc').innerHTML =
      `<span style="color:var(--red);">현재 목표 달성이 수학적으로 불가능합니다.</span>`;
  }
}

// ── 졸업요건 설정 ─────────────────────────────────
function addGradCert() {
  const inp = document.getElementById('gr-cert-input');
  const val = inp.value.trim();
  if (!val) return;

  const list = document.getElementById('gr-cert-list');
  const tag  = document.createElement('div');
  tag.style.cssText = 'display:flex;align-items:center;gap:4px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--accent);font-weight:600;';
  tag.innerHTML = `${val} <span onclick="this.parentElement.remove()" style="cursor:pointer;margin-left:2px;opacity:.7;">✕</span>`;
  list.appendChild(tag);
  inp.value = '';
}

function saveGradReq() {
  const btn = event.target;
  btn.textContent = '✓ 저장됨';
  btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = '💾 저장'; btn.style.background = ''; }, 2000);
  // TODO: PUT /api/academic/graduation API 호출
}

function resetGradReq() {
  document.getElementById('gr-total').value    = 130;
  document.getElementById('gr-major-req').value = 42;
  document.getElementById('gr-major-el').value  = 40;
  document.getElementById('gr-gen-req').value   = 20;
  document.getElementById('gr-gen-el').value    = 28;
  document.getElementById('gr-cert-list').innerHTML = '';
  updateGradPreview();
}

function updateGradPreview() {
  const total   = parseInt(document.getElementById('gr-total').value) || 130;
  const current = 92;   // TODO: 실제 이수 학점으로 교체
  const pct     = Math.min(100, Math.round(current / total * 100));
  const rem     = Math.max(0, total - current);

  const pctEl  = document.getElementById('grad-pct');
  const ring   = document.getElementById('grad-ring');
  const msg    = document.getElementById('grad-msg');
  const badge  = document.getElementById('grad-status-badge');

  if (pctEl) pctEl.textContent = pct + '%';
  if (ring) {
    const circ = 314;
    ring.setAttribute('stroke-dasharray', Math.round(circ * pct / 100) + ' ' + circ);
    ring.setAttribute('stroke', pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--accent)' : 'var(--amber)');
  }
  if (msg)   msg.textContent = rem > 0 ? `졸업까지 ${rem}학점 남음` : '모든 학점 요건 충족!';
  if (badge) {
    badge.className   = 'badge ' + (pct >= 100 ? 'badge-green' : pct >= 70 ? 'badge-blue' : 'badge-amber');
    badge.textContent = pct >= 100 ? '졸업 가능' : '진행중';
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', updateGradPreview);
