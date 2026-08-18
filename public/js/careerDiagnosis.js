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
let currentTargetJob = null; // loadReadiness()가 채움 — 진단 jobCode와 대조용

function renderReadiness(data) {
  document.getElementById('dg-total-badge').textContent = `총점 ${data.total ?? 0}`;
  document.getElementById('dg-breakdown').innerHTML = renderScoreBreakdown(data.breakdown);

  const blockersEl = document.getElementById('dg-blockers');
  blockersEl.innerHTML = (data.blockers || []).length
    ? `<div style="margin-top:12px;padding:10px 14px;background:var(--red-bg);color:var(--red);border-radius:8px;font-size:12px;line-height:1.6;">
        ${data.blockers.map(b => `⚠️ ${escapeHtml(b)}`).join('<br>')}
      </div>`
    : '';

  // graduation 카드가 같은 정보(졸업 요건)를 더 자세히 보여주므로, 여기 missing
  // 목록에서는 중복 표시하지 않는다.
  document.getElementById('dg-missing').innerHTML = renderMissingList((data.missing || []).filter(m => m.key !== 'graduation'));

  const btn = document.getElementById('dg-generate-btn');
  btn.disabled = !data.ready;
  btn.title = data.ready ? '' : '목표 직무를 먼저 설정해주세요.';
}

function renderStrength(strength) {
  const evidenceChips = (strength.evidence || []).map(e =>
    `<span class="evidence-chip" style="margin-right:4px;margin-top:4px;">${escapeHtml(e)}</span>`,
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

// "직무 갭" 축과 별개인 "시간 제약" 축(졸업까지 학점) — graduationAdvisor.summarizeGraduation
// 계산값 + suggestedFields(LLM). horizon에 따라 표시 관점을 다르게 한다: 저학년은
// "다음 학기에 뭘 채울지", 졸업 임박이면 "졸업까지 뭐가 남았는지".
function renderGraduation(graduation) {
  const card = document.getElementById('dg-graduation-card');
  if (!graduation?.hasData) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const r = graduation.remaining || {};
  const titleEl = document.getElementById('dg-graduation-title');
  const bodyEl = document.getElementById('dg-graduation-body');

  const suggestedHtml = (graduation.suggestedFields || []).length
    ? `<div style="margin-top:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">이런 분야를 채우면 좋습니다</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${graduation.suggestedFields.map(s => `
            <div style="padding:10px 14px;background:var(--bg3);border-radius:8px;">
              <span class="badge badge-purple" style="margin-right:8px;">${escapeHtml(s.field)}</span>
              <span style="font-size:12px;color:var(--text2);">${escapeHtml(s.reason || '')}</span>
            </div>`).join('')}
        </div>
      </div>`
    : '';

  const pendingLabel = graduation.horizon === 'semester' ? '졸업 전까지 준비할 것' : '남은 졸업 요건';
  const pendingHtml = (graduation.pendingRequirements || []).length
    ? `<div style="margin-top:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">${pendingLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${graduation.pendingRequirements.map(p => `<span class="badge badge-amber">${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>`
    : '';

  if (graduation.horizon === 'semester') {
    // 전공필수·교양필수는 지정된 과목을 그대로 들어야 해서 "채운다"는 개념이 없다 —
    // "남은 요건"으로만 보여주고, 실제로 분야를 골라 채울 수 있는 전공선택·교양선택만
    // "채울 수 있는 학점"으로 강조한다.
    titleEl.textContent = '🎓 다음 학기 이수 계획';
    bodyEl.innerHTML = `
      <div style="font-size:13px;color:var(--text2);">
        채울 수 있는 학점 <strong style="color:var(--text1);">전공선택 ${r.majorElective ?? 0}학점 · 교양선택 ${r.generalElective ?? 0}학점</strong>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">
        남은 요건(선택 여지 없음): 전공필수 ${r.majorRequired ?? 0}학점 · 교양필수 ${r.generalRequired ?? 0}학점
      </div>
      ${suggestedHtml}
      ${pendingHtml}`;
  } else {
    titleEl.textContent = '🎓 졸업까지 남은 학점';
    bodyEl.innerHTML = `
      <div style="font-size:13px;color:var(--text2);">
        총 <strong style="color:var(--text1);">${r.total ?? 0}학점</strong>${graduation.estimatedSemesters != null ? ` · 약 ${graduation.estimatedSemesters}학기` : ''}
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">
        전공필수 ${r.majorRequired ?? 0} · 전공선택 ${r.majorElective ?? 0} · 교양필수 ${r.generalRequired ?? 0} · 교양선택 ${r.generalElective ?? 0}
      </div>
      ${suggestedHtml}
      ${pendingHtml}`;
  }
}

// 생성 시점 목표 직무(doc.jobCode)와 지금 목표 직무가 다르면 배너를 띄운다 —
// 포트폴리오와 달리 진단은 PDF 내보내기가 없어 배너만으로 충분하다.
function renderDiagnosis(doc) {
  currentDiagnosisId = doc._id;

  document.getElementById('dg-job-title').textContent = doc.jobTitle ? `목표 직무: ${doc.jobTitle}` : '진로 진단';
  document.getElementById('dg-overview').textContent = doc.overview || '';

  const isStale = doc.jobCode && currentTargetJob?.jobCode && doc.jobCode !== currentTargetJob.jobCode;
  const mismatchEl = document.getElementById('dg-job-mismatch');
  if (isStale) {
    mismatchEl.style.display = 'block';
    mismatchEl.textContent = `⚠️ 이 진단은 '${doc.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '${currentTargetJob.title}'입니다. 다시 생성해 주세요.`;
  } else {
    mismatchEl.style.display = 'none';
  }

  renderGraduation(doc.graduation);

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
  if (data.httpStatus === 200) {
    currentTargetJob = data.currentJob || null;
    renderReadiness(data);
  }
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
  } else if (data.httpStatus === 409 && data.reason === 'job_mismatch') {
    alert(data.message || '목표 직무가 변경되어 추가할 수 없습니다.');
    buttonEl.disabled = false;
  } else if (data.httpStatus === 409) {
    buttonEl.textContent = '이미 추가됨';
  } else {
    alert(data.message || '추가에 실패했습니다.');
    buttonEl.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // currentTargetJob이 채워진 뒤에 렌더해야 첫 로드에서도 직무 불일치 배너가 정확히 뜬다.
  await loadReadiness();
  loadLatestDiagnosis();
  renderAllBlockedBanner('dg-all-blocked-banner');
});
