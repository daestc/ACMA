/* ================================================
   AcadMe — academic.js
   학사관리 페이지 전용:
   GPA 계산기, 이수현황, 졸업요건 설정, 목표 시뮬레이터
   ================================================ */

// ── 탭 전환 ──────────────────────────────────────
function switchAcademicTab(tab, btn) {
  ['gpa', 'credit', 'grad', 'sim'].forEach(t => {
    const section = document.getElementById('ac-' + t);
    if (section) section.style.display = 'none';
  });
  const activeSection = document.getElementById('ac-' + tab);
  if (activeSection) activeSection.style.display = 'block';

  if (btn) {
    btn.closest('.tabs')?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

// ── GPA 계산기 ────────────────────────────────────
const gradeMap = {
  'A+': 4.5, 'A': 4.0,
  'B+': 3.5, 'B': 3.0,
  'C+': 2.5, 'C': 2.0,
  'D+': 1.5, 'D': 1.0,
  'F':  0
};
// 학기별 과목 입력 → GPA 계산 → 서버 저장
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
// 학기 코드 → { semester, year, semesterNumber }
function parseSemesterOrder(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-(\d)$/);
  if (!match) {
    return { year: 0, semesterNumber: 0 };
  }

  return {
    year: Number(match[1]),
    semesterNumber: Number(match[2]),
  };
}
// 학기 텍스트 → { semester, year, semesterNumber }
function formatSemesterLabel(semester) {
  return String(semester || '').replace(/^(\d{4})-(\d)$/, '$1-$2학기');
}

function buildAcademicTrendSvg(records, targetGpa) { // GPA 추이 그래프 SVG 생성
  const width = 760;
  const height = 280;
  const padding = { top: 28, right: 36, bottom: 54, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const validRecords = records.filter(record => Number.isFinite(record.semesterGPA));

  if (!validRecords.length) {
    return '<div style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text2);font-size:13px;">표시할 GPA 데이터가 없습니다.</div>';
  }

  const gpaValues = validRecords.map(record => record.semesterGPA);
  const minGpa = Math.min(...gpaValues, targetGpa);
  const yMax = 4.5;
  const yMin = Math.max(0, Math.min(3.0, Math.floor((minGpa - 0.25) * 10) / 10));
  const yRange = Math.max(0.5, yMax - yMin);
  const stepX = validRecords.length === 1 ? 0 : chartWidth / (validRecords.length - 1);

  const toY = (value) => padding.top + ((yMax - value) / yRange) * chartHeight;
  const toX = (index) => padding.left + (index * stepX);
  const points = validRecords.map((record, index) => `${toX(index)},${toY(record.semesterGPA)}`);
  const areaPoints = [`${padding.left},${padding.top + chartHeight}`, ...points, `${padding.left + chartWidth},${padding.top + chartHeight}`].join(' ');
  const targetY = toY(targetGpa);
  const bestRecord = validRecords.reduce((best, current) => (current.semesterGPA > best.semesterGPA ? current : best), validRecords[0]);
  const tickValues = [];
  for (let value = yMax; value >= yMin; value -= 0.5) {
    tickValues.push(Number(value.toFixed(1)));
  }

  const pointsMarkup = validRecords.map((record, index) => {
    const x = toX(index);
    const y = toY(record.semesterGPA);
    const isBest = record.semester === bestRecord.semester;
    return `
      <g>
        <circle cx="${x}" cy="${y}" r="${isBest ? 6 : 5}" fill="${isBest ? 'var(--green)' : 'var(--accent)'}" stroke="white" stroke-width="2"/>
        <text x="${x}" y="${y - 14}" text-anchor="middle" fill="${isBest ? 'var(--green)' : 'var(--accent)'}" font-size="11" font-weight="700" font-family="DM Sans">${record.semesterGPA.toFixed(2)}</text>
        <text x="${x}" y="${height - 18}" text-anchor="middle" fill="var(--text2)" font-size="11" font-family="DM Sans">${formatSemesterLabel(record.semester)}</text>
      </g>`;
  }).join('');

  const gridLines = tickValues.map(value => {
    const y = toY(value);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="var(--border)" stroke-width="0.7" stroke-dasharray="3,4"/>
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="var(--text3)" font-size="11" font-family="DM Sans">${value.toFixed(1)}</text>`;
  }).join('');

  return `
    <svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="학기별 GPA 추이 그래프">
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" stroke="var(--border)" stroke-width="1"/>
      ${gridLines}
      <line x1="${padding.left}" y1="${targetY}" x2="${padding.left + chartWidth}" y2="${targetY}" stroke="#a5b4fc" stroke-width="1.5" stroke-dasharray="6,4"/>
      <text x="${padding.left + chartWidth}" y="${targetY - 6}" text-anchor="end" fill="#6366f1" font-size="10" font-family="DM Sans" font-weight="700">목표 ${targetGpa.toFixed(1)}</text>
      <polygon points="${areaPoints}" fill="var(--accent)" opacity="0.07"/>
      ${validRecords.length > 1 ? `<polyline points="${points.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${pointsMarkup}
    </svg>`;
}
// 학기별 GPA 추이 렌더링
function renderAcademicTrend(records) {
  const chartContainer = document.getElementById('semester-gpa-chart');
  const tableBody = document.getElementById('semester-gpa-history-body');
  const averageEl = document.getElementById('semester-gpa-average');
  const bestEl = document.getElementById('semester-gpa-best');
  const countEl = document.getElementById('semester-gpa-count');

  if (!chartContainer || !tableBody) {
    return;
  }

  const targetGpa = Number(chartContainer.dataset.targetGpa) || 3.9;
  const normalizedRecords = (Array.isArray(records) ? records : [])
    .filter(record => record && record.semester)
    .map(record => ({
      ...record,
      semesterGPA: Number(record.semesterGPA),
    }))
    .sort((left, right) => {
      const leftOrder = parseSemesterOrder(left.semester);
      const rightOrder = parseSemesterOrder(right.semester);
      return (leftOrder.year - rightOrder.year) || (leftOrder.semesterNumber - rightOrder.semesterNumber);
    });

  const validRecords = normalizedRecords.filter(record => Number.isFinite(record.semesterGPA));

  if (!validRecords.length) {
    chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text2);font-size:13px;">표시할 GPA 데이터가 없습니다.</div>';
    tableBody.innerHTML = '<tr><td colspan="4" style="padding:14px 10px;font-size:13px;color:var(--text2);text-align:center;">학기별 성적 데이터가 없습니다.</td></tr>';
    if (averageEl) averageEl.textContent = '-';
    if (bestEl) bestEl.textContent = '-';
    if (countEl) countEl.textContent = '-';
    return;
  }

  chartContainer.innerHTML = buildAcademicTrendSvg(validRecords, targetGpa);

  const averageGpa = validRecords.reduce((sum, record) => sum + record.semesterGPA, 0) / validRecords.length;
  const bestRecord = validRecords.reduce((best, current) => (current.semesterGPA > best.semesterGPA ? current : best), validRecords[0]);
  const totalCredits = validRecords.reduce((sum, record) => sum + (Number(record.earnedCredits) || 0), 0);

  tableBody.innerHTML = validRecords.map((record, index) => {
    const isBest = record.semester === bestRecord.semester;
    return `
      <tr style="border-bottom:1px solid var(--border);${index % 2 === 1 ? 'background:var(--bg3);' : ''}">
        <td style="padding:10px;font-size:13px;">${formatSemesterLabel(record.semester)}</td>
        <td style="padding:10px;font-size:13px;color:var(--text2);">${Number(record.attemptedCredits || 0)}</td>
        <td style="padding:10px;font-size:13px;color:var(--text2);">${Number(record.earnedCredits || 0)}</td>
        <td style="padding:10px;"><strong style="color:${isBest ? 'var(--green)' : 'var(--accent)'};font-family:'DM Sans';">${record.semesterGPA.toFixed(2)}</strong>${isBest ? ' <span class="badge badge-green" style="font-size:9px;padding:1px 6px;">최고</span>' : ''}</td>
      </tr>`;
  }).join('');

  if (averageEl) averageEl.textContent = averageGpa.toFixed(2);
  if (bestEl) bestEl.textContent = bestRecord.semesterGPA.toFixed(2);
  if (countEl) countEl.textContent = String(totalCredits);
}

// 진도 프로그레스 (DB 기반)
window._ac_progress = { totals: null, profile: null };

async function fetchProgress() {
  try {
    const res = await fetch('/academic/progress', { credentials: 'same-origin' });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success) return;

    const totals = json.totals || {};
    const profile = json.profile || {};
    window._ac_progress = { totals, profile };

    const req = profile?.GraduationRequirements || {};
    const map = [
      { key: 'major_required', pv: 'pv-major-req', pf: 'pf-major-req', rightPv: 'pv-right-major-req', rightPf: 'pf-right-major-req', reqKey: 'requiredMajorCredits' },
      { key: 'major_elective', pv: 'pv-major-el', pf: 'pf-major-el', rightPv: 'pv-right-major-el', rightPf: 'pf-right-major-el', reqKey: 'requiredMajorElective' },
      { key: 'general_required', pv: 'pv-gen-req', pf: 'pf-gen-req', rightPv: 'pv-right-gen-req', rightPf: 'pf-right-gen-req', reqKey: 'requiredGeneralCredits' },
      { key: 'general_elective', pv: 'pv-gen-el', pf: 'pf-gen-el', rightPv: 'pv-right-gen-el', rightPf: 'pf-right-gen-el', reqKey: 'requiredGeneralElective' },
    ];

    map.forEach(item => {
      const earned = Number(totals[item.key] || 0);
      const needed = Number(req[item.reqKey] || 0) || 0;
      const pct = needed ? Math.min(100, Math.round(earned / needed * 100)) : 0;

      const pv = document.getElementById(item.pv);
      const pf = document.getElementById(item.pf);
      const rightPv = document.getElementById(item.rightPv);
      const rightPf = document.getElementById(item.rightPf);

      if (pv) pv.textContent = needed ? `${earned}/${needed}` : `${earned}`;
      if (pf) pf.style.width = pct + '%';
      if (rightPv) rightPv.textContent = needed ? `${earned}/${needed}` : `${earned}`;
      if (rightPf) rightPf.style.width = pct + '%';
    });

    // 총합
    const totalEarned = Number(totals.totalEarned || 0);
    const totalNeeded = Number(req.requiredTotalCredits || 0) || 0;
    const totalPct = totalNeeded ? Math.min(100, Math.round(totalEarned / totalNeeded * 100)) : 0;
    const pvTotal = document.getElementById('pv-total');
    const pfTotal = document.getElementById('pf-total');
    if (pvTotal) pvTotal.textContent = totalNeeded ? `${totalEarned}/${totalNeeded}` : `${totalEarned}`;
    if (pfTotal) pfTotal.style.width = totalPct + '%';

    // 오른쪽 요약 총취득학점 업데이트
    const semesterGpaCount = document.getElementById('semester-gpa-count');
    if (semesterGpaCount) semesterGpaCount.textContent = String(totalEarned);

    // 그레이드 프리뷰와 시뮬레이터에서 사용
    window._ac_currentEarnedCredits = totalEarned;
    updateGradPreview();
  } catch (err) {
    console.error('fetchProgress failed', err);
  }
}

async function fetchAcademicTrend() {
  const chartContainer = document.getElementById('semester-gpa-chart');
  if (!chartContainer) {
    return;
  }

  try {
    const response = await fetch('/academic/all-gpa', { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('학기별 GPA를 불러오지 못했습니다.');
    }

    const result = await response.json();
    renderAcademicTrend(result.success ? result.records : []);
  } catch (error) {
    console.error(error);
    chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text2);font-size:13px;">학기별 GPA를 불러오지 못했습니다.</div>';
  }
}

function addSubjectRow() {
  const list = document.getElementById('subject-list');
  const row = buildSubjectRow();
  list.appendChild(row);
}

function buildSubjectRow(subject = {}) {
  const sName = subject.subjectName || '';
  const sType = subject.subjectType || 'free';
  const sCredits = String(subject.credits ?? '3');
  const sGrade = subject.grade || 'A';

  const row = document.createElement('div');
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
      <option value="A+">A+</option><option value="A">A</option><option value="B+">B+</option><option value="B">B</option><option value="C+">C+</option><option value="C">C</option><option value="D+">D+</option><option value="D">D</option><option value="F">F</option>
    </select>
    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.subject-row').remove(); calcGPA()">✕</button>`;

  // populate values after element creation
  setTimeout(() => {
    row.querySelector('input[name="subjectName"]').value = sName;
    row.querySelector('select[name="subjectType"]').value = sType;
    row.querySelector('select[name="credits"]').value = sCredits;
    row.querySelector('select[name="grade"]').value = sGrade;
  }, 0);

  return row;
}
// 학기별 과목 입력 → GPA 계산 → 서버 저장
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

// 서버에서 학기 레코드를 가져와 subject-list를 채움
async function fetchSemesterRecord(semester) {
  try {
    const res = await fetch(`/academic/record/${encodeURIComponent(semester)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('학기 데이터를 불러오지 못했습니다.');
    const json = await res.json();
    if (!json.success) return null;
    return json.record || null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function populateSemester(semester) {
  const record = await fetchSemesterRecord(semester);
  const list = document.getElementById('subject-list');
  list.innerHTML = '';

  if (!record || !record.subjects || !record.subjects.length) {
    // 기본 빈 행 3개
    addSubjectRow(); addSubjectRow(); addSubjectRow();
    calcGPA();
    return;
  }

  record.subjects.forEach(s => {
    const row = buildSubjectRow(s);
    list.appendChild(row);
  });
  // 약간의 지연 후 GPA 계산
  setTimeout(calcGPA, 10);
}

// 학기 선택 변경 시 서버에서 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
  const semesterSelect = document.querySelector('#ac-gpa select[name="semester"]');
  if (semesterSelect) {
    semesterSelect.addEventListener('change', (e) => {
      const sem = e.target.value;
      populateSemester(sem);
    });
    // 초기 로드
    populateSemester(semesterSelect.value);
  }
});

// ── 목표 GPA 시뮬레이터 ───────────────────────────
function calcSim() {
  const target     = parseFloat(document.getElementById('target-gpa').value)  || 3.9;
  const next       = parseInt(document.getElementById('next-credits').value)   || 18;
  const curCredits = Number(window._ac_currentEarnedCredits || document.getElementById('semester-gpa-count')?.textContent || 0) || 0;
  const curGPA     = Number(document.getElementById('semester-gpa-average')?.textContent || 0) || 0;

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
// 졸업요건 입력 → 서버 저장 → DB 업데이트 → 진도 프로그레스에 반영
function addGradCert() { 
  const inp = document.getElementById('gr-cert-input');
  const val = inp.value.trim();
  if (!val) return;

  const list = document.getElementById('gr-cert-list');
  const tag  = document.createElement('div');
  tag.className = 'gr-cert-chip';
  tag.style.cssText = 'display:flex;align-items:center;gap:4px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--accent);font-weight:600;';
  tag.innerHTML = `${val} <span onclick="this.parentElement.remove()" style="cursor:pointer;margin-left:2px;opacity:.7;">✕</span>`;
  list.appendChild(tag);
  inp.value = '';
}
// 졸업요건 입력값 → 서버 저장용 객체 변환
function getGradReqPayload() {
  const certList = Array.from(document.querySelectorAll('#gr-cert-list .gr-cert-chip'));
  const certs = certList.map(el => String(el.childNodes[0]?.textContent || el.textContent || '').trim()).filter(Boolean);
  const languageType = document.getElementById('gr-lang-type')?.value || '없음';
  const languageScore = document.getElementById('gr-lang-score')?.value?.trim() || '';

  return {
    major: document.querySelector('.badge.badge-blue')?.textContent?.trim() || '',
    GraduationRequirements: {
      requiredTotalCredits: Number(document.getElementById('gr-total')?.value) || 130,
      requiredMajorCredits: Number(document.getElementById('gr-major-req')?.value) || 42,
      requiredMajorElective: Number(document.getElementById('gr-major-el')?.value) || 40,
      requiredGeneralCredits: Number(document.getElementById('gr-gen-req')?.value) || 20,
      requiredGeneralElective: Number(document.getElementById('gr-gen-el')?.value) || 28,
      requiresGraduationWork: document.getElementById('gr-grad-work')?.classList.contains('on') ?? true,
      requiredCapstonDesign: document.getElementById('gr-capstone-design')?.classList.contains('on') ?? false,
      requiredCertifications: certs,
      requiredLanguageScore: languageType === '없음' ? null : `${languageType}${languageScore ? ` ${languageScore}` : ''}`.trim(),
      requiredInternship: document.getElementById('gr-internship')?.value || null,
      requiredNCProgram: document.getElementById('gr-nc-program')?.value || null,
      requiredVolunteer: document.getElementById('gr-volunteer')?.value === ''
        ? null
        : Number(document.getElementById('gr-volunteer')?.value) || 0,
    },
  };
}

function setGradSaveStatus(message, isSuccess = false) {
  const statusEl = document.getElementById('gr-save-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isSuccess ? 'var(--green)' : 'var(--text2)';
  }
}

async function saveGradReq() {
  const button = document.querySelector('#ac-grad .btn.btn-accent');
  const originalText = button ? button.textContent : '저장';
  const payload = getGradReqPayload();

  try {
    if (button) {
      button.disabled = true;
      button.textContent = '저장 중...';
    }
    setGradSaveStatus('졸업요건을 저장하는 중입니다...');

    const response = await fetch('/academic/graduation-requirements', {
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
      throw new Error(result.message || '졸업요건 저장에 실패했습니다.');
    }

    setGradSaveStatus('졸업요건을 저장했습니다.', true);
    if (button) {
      button.textContent = '✓ 저장됨';
      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    }
  } catch (error) {
    console.error(error);
    setGradSaveStatus(error.message || '졸업요건 저장에 실패했습니다.');
  } finally {
    if (button) {
      button.disabled = false;
      if (button.textContent === '저장 중...') {
        button.textContent = originalText;
      }
    }
  }
}
// 졸업요건 초기화 (기본값으로 리셋)
function resetGradReq() {
  const total = document.getElementById('gr-total');
  const majorReq = document.getElementById('gr-major-req');
  const majorEl = document.getElementById('gr-major-el');
  const genReq = document.getElementById('gr-gen-req');
  const genEl = document.getElementById('gr-gen-el');
  const gradWork = document.getElementById('gr-grad-work');
  const capstoneDesign = document.getElementById('gr-capstone-design');
  const langType = document.getElementById('gr-lang-type');
  const langScore = document.getElementById('gr-lang-score');
  const certList = document.getElementById('gr-cert-list');
  const internship = document.getElementById('gr-internship');
  const ncProgram = document.getElementById('gr-nc-program');
  const volunteer = document.getElementById('gr-volunteer');

  if (total) total.value = 130;
  if (majorReq) majorReq.value = 42;
  if (majorEl) majorEl.value = 40;
  if (genReq) genReq.value = 20;
  if (genEl) genEl.value = 28;
  gradWork?.classList.add('on');
  capstoneDesign?.classList.remove('on');
  if (langType) langType.value = 'TOEIC';
  if (langScore) langScore.value = '';
  if (certList) certList.innerHTML = '';
  if (internship) internship.value = '';
  if (ncProgram) ncProgram.value = '';
  if (volunteer) volunteer.value = '';
  updateGradPreview();
}
// 졸업요건 입력값 → 미리보기 업데이트
function updateGradPreview() {
  const totalInput = document.getElementById('gr-total');
  if (!totalInput) return;

  const total   = parseInt(totalInput.value) || 130;
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

  const summary = document.getElementById('grad-summary');
  if (summary) {
    const majorReq = document.getElementById('gr-major-req')?.value || 42;
    const majorEl = document.getElementById('gr-major-el')?.value || 40;
    const genReq = document.getElementById('gr-gen-req')?.value || 20;
    const genEl = document.getElementById('gr-gen-el')?.value || 28;
    const gradWork = document.getElementById('gr-grad-work')?.classList.contains('on') ? '필요' : '불필요';
    const capstoneDesign = document.getElementById('gr-capstone-design')?.classList.contains('on') ? '필요' : '선택';
    const languageType = document.getElementById('gr-lang-type')?.value || '없음';
    const languageScore = document.getElementById('gr-lang-score')?.value?.trim() || '';
    const certifications = Array.from(document.querySelectorAll('#gr-cert-list .gr-cert-chip'))
      .map(el => String(el.childNodes[0]?.textContent || el.textContent || '').trim())
      .filter(Boolean);
    const internship = document.getElementById('gr-internship')?.value;
    const ncProgram = document.getElementById('gr-nc-program')?.value;
    const volunteer = document.getElementById('gr-volunteer')?.value?.trim();

    summary.innerHTML = `
      <div style="font-weight:700;color:var(--text);">달성률 ${pct}% · 졸업까지 ${rem}학점 남음</div>
      <div>총 필요학점: ${total}학점</div>
      <div>전공필수 ${majorReq}학점, 전공선택 ${majorEl}학점</div>
      <div>교양필수 ${genReq}학점, 교양선택 ${genEl}학점</div>
      <div>졸업작품: ${gradWork} / 캡스톤 디자인: ${capstoneDesign}</div>
      <div>외국어 성적: ${languageType === '없음' ? '없음' : `${languageType}${languageScore ? ` ${languageScore}` : ''}`}</div>
      <div>자격증: ${certifications.length ? certifications.join(', ') : '없음'}</div>
      <div>인턴십: ${internship === '' ? '미지정' : internship === 'true' ? '필수' : '선택'} / 비교과: ${ncProgram === '' ? '미지정' : ncProgram === 'true' ? '필수' : '선택'} / 봉사시간: ${volunteer || '미지정'}</div>
    `;
  }
}
// 서버에서 졸업요건 가져와 입력 폼과 미리보기 업데이트
function applyGraduationRequirements(profile) {
  const requirements = profile?.GraduationRequirements;
  if (!requirements) {
    return;
  }

  const total = document.getElementById('gr-total');
  const majorReq = document.getElementById('gr-major-req');
  const majorEl = document.getElementById('gr-major-el');
  const genReq = document.getElementById('gr-gen-req');
  const genEl = document.getElementById('gr-gen-el');
  const gradWork = document.getElementById('gr-grad-work');
  const capstoneDesign = document.getElementById('gr-capstone-design');
  const langType = document.getElementById('gr-lang-type');
  const langScore = document.getElementById('gr-lang-score');
  const certList = document.getElementById('gr-cert-list');
  const internship = document.getElementById('gr-internship');
  const ncProgram = document.getElementById('gr-nc-program');
  const volunteer = document.getElementById('gr-volunteer');

  if (total) total.value = requirements.requiredTotalCredits ?? 130;
  if (majorReq) majorReq.value = requirements.requiredMajorCredits ?? 42;
  if (majorEl) majorEl.value = requirements.requiredMajorElective ?? 40;
  if (genReq) genReq.value = requirements.requiredGeneralCredits ?? 20;
  if (genEl) genEl.value = requirements.requiredGeneralElective ?? 28;

  if (gradWork) {
    gradWork.classList.toggle('on', Boolean(requirements.requiresGraduationWork));
  }

  if (capstoneDesign) {
    capstoneDesign.classList.toggle('on', Boolean(requirements.requiredCapstonDesign));
  }

  if (langType || langScore) {
    const languageValue = String(requirements.requiredLanguageScore || '');
    const knownType = ['TOEIC', 'TOEFL', 'IELTS', 'JLPT'].find(type => languageValue.startsWith(type));
    if (langType) langType.value = knownType || '없음';
    if (langScore) langScore.value = knownType ? languageValue.replace(knownType, '').trim() : languageValue;
  }

  if (certList) {
    const certifications = Array.isArray(requirements.requiredCertifications) ? requirements.requiredCertifications : [];
    certList.innerHTML = certifications.map(cert => `
      <div class="gr-cert-chip" style="display:flex;align-items:center;gap:4px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--accent);font-weight:600;">
        ${cert} <span onclick="this.parentElement.remove()" style="cursor:pointer;margin-left:2px;opacity:.7;">✕</span>
      </div>`).join('');
  }

  if (internship) {
    internship.value = requirements.requiredInternship == null ? '' : String(requirements.requiredInternship);
  }

  if (ncProgram) {
    ncProgram.value = requirements.requiredNCProgram == null ? '' : String(requirements.requiredNCProgram);
  }

  if (volunteer) {
    volunteer.value = requirements.requiredVolunteer ?? '';
  }

  updateGradPreview();
}

async function fetchGraduationRequirements() {
  try {
    const response = await fetch('/academic/graduation-requirements', { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('졸업요건을 불러오지 못했습니다.');
    }
    const result = await response.json();
    if (result.success && result.profile) {
      applyGraduationRequirements(result.profile);
    }
  } catch (error) {
    console.error(error);
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', updateGradPreview);
document.addEventListener('DOMContentLoaded', fetchAcademicTrend);
document.addEventListener('DOMContentLoaded', fetchGraduationRequirements);
document.addEventListener('DOMContentLoaded', fetchProgress);
document.addEventListener('DOMContentLoaded', calcSim);
