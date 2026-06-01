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
    const creditSelect = r.querySelector('select[name="credits"]');
    const gradeSelect = r.querySelector('select[name="grade"]');
    const c = parseInt(creditSelect?.value) || 3;
    const g = gradeSelect?.value;
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
    <input class="input-field" name="subjectName" placeholder="과목명" style="flex:2;">
    <select class="select-field" name="subjectType" style="min-width:120px;">
      <option value="major_required">전필</option>
      <option value="major_elective">전선</option>
      <option value="general_required">교필</option>
      <option value="general_elective">교선</option>
      <option value="free">일선</option>
    </select>
    <select class="select-field" name="credits">
      <option value="3">3학점</option><option value="2">2학점</option><option value="1">1학점</option>
    </select>
    <select class="select-field" name="grade" onchange="calcGPA()">
      <option value="B+">B+</option><option value="A+">A+</option><option value="A">A</option><option value="B">B</option>
      <option value="C+">C+</option><option value="C">C</option><option value="D+">D+</option><option value="D">D</option><option value="F">F</option>
    </select>
    <button type="button" class="btn btn-ghost btn-sm"
      onclick="this.closest('.subject-row').remove(); calcGPA()">✕</button>`;
  list.appendChild(row);
}

async function saveAcademicData() {
  const semesterSelect = document.querySelector('#ac-gpa select[name="semester"]');
  const rows = document.querySelectorAll('#subject-list .subject-row');

  const subjects = Array.from(rows).map(row => {
    const subjectName = row.querySelector('input[name="subjectName"]')?.value?.trim() || '';
    const subjectType = row.querySelector('select[name="subjectType"]')?.value || 'free';
    const credits = row.querySelector('select[name="credits"]')?.value || '3';
    const grade = row.querySelector('select[name="grade"]')?.value || null;

    return { subjectName, subjectType, credits, grade };
  }).filter(subject => subject.subjectName);

  if (!subjects.length) {
    alert('과목을 하나 이상 입력해 주세요.');
    return;
  }

  const payload = {
    semester: semesterSelect?.value || '2026-1',
    subjectName: subjects.map(subject => subject.subjectName),
    subjectType: subjects.map(subject => subject.subjectType),
    credits: subjects.map(subject => subject.credits),
    grade: subjects.map(subject => subject.grade),
  };

  const button = document.querySelector('#ac-gpa .btn-accent');
  const originalText = button ? button.textContent : '저장';
  let restoreTimer = null;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = '저장 중...';
    }

    const response = await fetch('/academic/addCourse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '저장에 실패했습니다.');
    }

    if (button) {
      button.textContent = '✓ 저장됨';
      restoreTimer = setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    }
  } catch (error) {
    alert(error.message || '저장에 실패했습니다.');
  } finally {
    if (button) {
      button.disabled = false;
      if (!restoreTimer) {
        button.textContent = originalText;
      }
    }
  }
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
