/* ================================================
   AcadMe — mystatus.js
   MyStatus 페이지 전용: 자격증/대외활동/어학성적 탭,
   활동 히스토리 탭, 경험/활동/교육 탭
   ================================================ */

// ── 자격증 / 대외활동 / 어학성적 탭 ──────────────
function switchStatusTab(tab, btn) {
  ['cert', 'activity', 'lang'].forEach(t => {
    document.getElementById('st-' + t).style.display = 'none';
  });
  document.getElementById('st-' + tab).style.display = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 활동 히스토리 탭 ──────────────────────────────
function switchHistTab(tab, btn) {
  ['study', 'quiz', 'login'].forEach(t => {
    document.getElementById('hist-' + t).style.display = 'none';
  });
  document.getElementById('hist-' + tab).style.display = 'block';

  btn.closest('.card-header').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 경험 / 활동 / 교육 탭 ────────────────────────
function switchExpTab(tab, btn) {
  ['work', 'activity', 'education'].forEach(t => {
    document.getElementById('exp-' + t).style.display = 'none';
  });
  document.getElementById('exp-' + tab).style.display = 'block';

  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

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

// 학기 코드 → 정렬용 { year, semesterNumber }
function parseSemesterOrder(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-(\d)$/);
  if (!match) return { year: 0, semesterNumber: 0 };
  return { year: Number(match[1]), semesterNumber: Number(match[2]) };
}

// 학기 코드 → 표시용 텍스트 ("2024-1" → "2024-1학기")
function formatSemesterLabel(semester) {
  return String(semester || '').replace(/^(\d{4})-(\d)$/, '$1-$2학기');
}

// 학기별 성적 이력 불러오기
async function fetchAcademicTrend() {
  const tableBody = document.getElementById('semester-gpa-history-body');
  if (!tableBody) return;

  try {
    const response = await fetch('/academic/all-gpa', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('학기별 GPA를 불러오지 못했습니다.');
    const result = await response.json();
    renderAcademicTrend(result.success ? result.records : []);
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = '<tr><td colspan="4" style="padding:14px 10px;font-size:13px;color:var(--text2);text-align:center;">학기별 데이터를 불러오지 못했습니다.</td></tr>';
  }
}

// 표 렌더링
function renderAcademicTrend(records) {
  const tableBody = document.getElementById('semester-gpa-history-body');
  const averageEl = document.getElementById('semester-gpa-average');
  const bestEl = document.getElementById('semester-gpa-best');
  const countEl = document.getElementById('semester-gpa-count');

  if (!tableBody) return;

  const normalizedRecords = (Array.isArray(records) ? records : [])
    .filter(record => record && record.semester)
    .map(record => ({ ...record, semesterGPA: Number(record.semesterGPA) }))
    .sort((left, right) => {
      const l = parseSemesterOrder(left.semester);
      const r = parseSemesterOrder(right.semester);
      return (l.year - r.year) || (l.semesterNumber - r.semesterNumber);
    });

  const validRecords = normalizedRecords.filter(record => Number.isFinite(record.semesterGPA));

  if (!validRecords.length) {
    tableBody.innerHTML = '<tr><td colspan="4" style="padding:14px 10px;font-size:13px;color:var(--text2);text-align:center;">학기별 성적 데이터가 없습니다.</td></tr>';
    if (averageEl) averageEl.textContent = '-';
    if (bestEl) bestEl.textContent = '-';
    if (countEl) countEl.textContent = '-';
    return;
  }

  const averageGpa = validRecords.reduce((sum, r) => sum + r.semesterGPA, 0) / validRecords.length;
  const bestRecord = validRecords.reduce((best, cur) => (cur.semesterGPA > best.semesterGPA ? cur : best), validRecords[0]);
  const totalCredits = validRecords.reduce((sum, r) => sum + (Number(r.earnedCredits) || 0), 0);
  document.getElementById('credit-avg').textContent = averageGpa.toFixed(2);
  document.getElementById('credit-earned').textContent = String(totalCredits);

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
// 페이지 로드 시 사용자 프로필 정보 가져오기
async function fetchUserProfile() {
  try {
    const response = await fetch('/user/profile');
    if (!response.ok) throw new Error('프로필 정보를 가져오는데 실패했습니다.');
    const data = await response.json();
    const user = data.user;
    if (!user) throw new Error('사용자 정보가 없습니다.');
    document.getElementById('profile-avatar').textContent = user.name ? user.name.charAt(0) : '';
    document.getElementById('profile-name').textContent = `${user.name || ''}`;
    document.getElementById('profile-meta').textContent = `${user.university || ''} · ${user.major || ''} · ${user.studentId || ''} · ${user.enrollmentStatus || ''}`;
  } catch (error) {
    console.error('Error fetching profile:', error);
    alert('프로필 정보를 가져오는데 실패했습니다. 다시 시도해주세요.');
  }
}
// 목표 직무와 자격증 정보 가져와서 프로필 상단에 표시하기/ 자격증 목록 표시
async function fetchCareerAndCerts() {
  try {
    const response = await fetch('/career/my-career-and-certs', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('목표 직무와 자격증 정보를 가져오는데 실패했습니다.');
    const data = await response.json();
    if (!data.success) throw new Error('목표 직무와 자격증 정보를 가져오는데 실패했습니다.');
    const career = data.career || {};
    const certs = data.certifications || [];
    document.getElementById('profile-job').textContent = career.title || '목표 직무 없음';
    document.getElementById('profile-certification').textContent = certs.length > 0 ? certs.map(c => c.certificationId.name).join(', ') : '목표 자격증 없음';
    document.getElementById('st-cert').innerHTML = `<div class="card-header" style="margin-bottom:12px;"><span class="card-title">🏅 자격증</span><button type="button" class="btn btn-accent btn-sm" id="cert-open-btn">+ 추가</button></div>`;
    document.getElementById('st-cert').innerHTML += certs.length > 0 ? certs.map(c => 
      `<div class="cert-item"><div class="cert-icon">📋</div><div class="cert-name">${c.certificationId.name}</div>
      <span class="badge badge-green">${
        c.status === 'acquired' ? '취득' : 
        c.status === 'wish' ? '관심' : '목표'}</span>
      <span style="font-size:11px;color:var(--text2);margin-left:4px;">${
        c.status === 'acquired' && c.earnedDate ? new Date(c.earnedDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }) :
        c.targetDate ? `목표 ${new Date(c.targetDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}` : ''}</span></div>`).join('') : '<div style="padding:14px 10px;font-size:13px;color:var(--text2);text-align:center;">등록된 자격증이 없습니다.</div>';
    document.addEventListener('click', (event) => {
      if (event.target && event.target.id === 'cert-open-btn') {
        const url = '/career';
        window.location.href = url;
      } 
    });
  } catch (error) {
    console.error('Error fetching career and certifications:', error);
    // 실패해도 프로필 기본 정보는 보여주도록 함
  }
};

// 초기화
document.addEventListener('DOMContentLoaded', fetchAcademicTrend);

document.addEventListener('DOMContentLoaded', () => {
  fetchProgress();
  fetchAcademicTrend();
  fetchUserProfile();
  fetchCareerAndCerts();
});

