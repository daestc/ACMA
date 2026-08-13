/* ================================================
   AcadMe — careerDiagnosis.js
   진로 진단 페이지 (/career/diagnosis) — /ai/diagnosis* 연동
   ================================================ */

const SEVERITY_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' };
const ACTION_TYPE_LABEL = {
  cert: '자격증', project: '프로젝트', course: '과목', language: '어학', experience: '경험', none: '기타',
};

let currentDiagnosisId = null;
let dgPollTimer = null;

function renderReadiness(data) {
  document.getElementById('dg-total-badge').textContent = `총점 ${data.total ?? 0}`;
  document.getElementById('dg-breakdown').innerHTML = renderScoreBreakdown(data.breakdown);

  const blockersEl = document.getElementById('dg-blockers');
  blockersEl.innerHTML = (data.blockers || []).length
    ? `<div style="margin-top:12px;padding:10px 14px;background:var(--red-bg);color:var(--red);border-radius:8px;font-size:12px;line-height:1.6;">
        ${data.blockers.map(b => `⚠️ ${escapeHtml(b)}`).join('<br>')}
      </div>`
    : '';

  document.getElementById('dg-missing').innerHTML = renderMissingList(data.missing);

  const btn = document.getElementById('dg-generate-btn');
  btn.disabled = !data.ready;
  btn.title = data.ready ? '' : '목표 직무를 먼저 설정해주세요.';
}

function renderStrength(strength) {
  const evidenceChips = (strength.evidence || []).map(e =>
    `<span class="badge badge-blue" style="margin-right:4px;margin-top:4px;">${escapeHtml(e)}</span>`,
  ).join('');

  return `
    <div style="padding:12px 14px;background:var(--bg3);border-radius:8px;">
      <strong style="font-size:13px;">${escapeHtml(strength.title)}</strong>
      <p style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.6;">${escapeHtml(strength.body)}</p>
      ${evidenceChips ? `<div style="margin-top:8px;">${evidenceChips}</div>` : ''}
    </div>`;
}

function gapScheduleText(gap) {
  if (gap.actionType === 'cert' && gap.dDay != null) {
    return `<span class="badge badge-red" style="margin-left:6px;">${escapeHtml(gap.examType || '시험')} D-${gap.dDay}</span>`;
  }
  if (gap.relatedCertName) {
    return `<span class="badge badge-amber" style="margin-left:6px;">관련 자격증: ${escapeHtml(gap.relatedCertName)}(일정 확인 필요)</span>`;
  }
  return '';
}

function renderGap(gap) {
  const severityBadge = SEVERITY_BADGE[gap.severity] || 'badge-blue';
  const actionLabel = ACTION_TYPE_LABEL[gap.actionType] || gap.actionType;

  return `
    <div class="card" style="padding:14px 16px;" data-gap-id="${escapeHtml(gap._id)}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge ${severityBadge}">${escapeHtml(gap.severity)}</span>
          <span class="badge badge-purple">${escapeHtml(actionLabel)}</span>
          <strong style="font-size:13px;">${escapeHtml(gap.item)}</strong>
          ${gapScheduleText(gap)}
        </div>
        <button class="btn btn-ghost btn-sm gap-add-btn" onclick="addGapToPlan('${escapeHtml(gap._id)}', this)">이번 주 계획에 추가</button>
      </div>
      ${gap.reason ? `<p style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.6;">${escapeHtml(gap.reason)}</p>` : ''}
    </div>`;
}

function renderDiagnosis(doc) {
  currentDiagnosisId = doc._id;

  document.getElementById('dg-job-title').textContent = doc.jobTitle ? `목표 직무: ${doc.jobTitle}` : '진로 진단';
  document.getElementById('dg-overview').textContent = doc.overview || '';

  document.getElementById('dg-strengths').innerHTML = (doc.strengths || []).map(renderStrength).join('')
    || '<div style="font-size:12px;color:var(--text2);">아직 뚜렷한 강점 항목이 없습니다.</div>';

  document.getElementById('dg-gaps').innerHTML = (doc.gaps || []).map(renderGap).join('')
    || '<div style="font-size:12px;color:var(--text2);">부족한 점이 확인되지 않았습니다.</div>';

  showResultSection('dg-result');
}

function showResultSection(id) {
  ['dg-empty', 'dg-pending', 'dg-failed', 'dg-result'].forEach(sectionId => {
    document.getElementById(sectionId).style.display = sectionId === id ? 'block' : 'none';
  });
}

async function loadLatestDiagnosis() {
  const data = await callApi('/ai/diagnosis/latest');

  if (data.httpStatus === 404) {
    showResultSection('dg-empty');
    return;
  }
  if (data.status === 'done' && data.data) {
    renderDiagnosis(data.data);
  } else {
    showResultSection('dg-empty');
  }
}

async function loadReadiness() {
  const data = await callApi('/ai/diagnosis/scores');
  if (data.httpStatus === 200) renderReadiness(data);
}

function startDgPolling() {
  if (!currentDiagnosisId) return;
  showResultSection('dg-pending');
  if (dgPollTimer) clearInterval(dgPollTimer);
  dgPollTimer = pollUntilDone(
    `/ai/diagnosis/${currentDiagnosisId}`,
    null,
    (data) => {
      if (data.status === 'done' && data.data) {
        renderDiagnosis(data.data);
      } else {
        document.getElementById('dg-failed-msg').textContent = data.errorMessage || '생성에 실패했습니다.';
        showResultSection('dg-failed');
      }
      loadReadiness();
    },
  );
}

async function generateDiagnosis() {
  const data = await callApi('/ai/diagnosis', { method: 'POST' });

  if (data.httpStatus === 202 && data.id) {
    currentDiagnosisId = data.id;
    startDgPolling();
  } else if (data.httpStatus === 400) {
    alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`);
  } else if (data.httpStatus === 409) {
    alert('이미 생성 중인 진단이 있습니다.');
  } else {
    alert(data.message || '요청 처리에 실패했습니다.');
  }
}

async function addGapToPlan(gapId, buttonEl) {
  if (!currentDiagnosisId) return;
  buttonEl.disabled = true;

  const data = await callApi(`/ai/diagnosis/${currentDiagnosisId}/gaps/${gapId}/to-plan`, { method: 'POST' });

  if (data.httpStatus === 200) {
    buttonEl.textContent = '추가됨';
  } else if (data.httpStatus === 404) {
    alert('먼저 이번 주 계획을 생성해 주세요.');
    if (confirm('주간 계획 페이지로 이동할까요?')) window.location.href = '/career/plan';
    buttonEl.disabled = false;
  } else if (data.httpStatus === 409) {
    buttonEl.textContent = '이미 추가됨';
  } else {
    alert(data.message || '추가에 실패했습니다.');
    buttonEl.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadReadiness();
  loadLatestDiagnosis();
});
