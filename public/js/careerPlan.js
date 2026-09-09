/* ================================================
   AcadMe — careerPlan.js
   주간 계획 페이지 (/career/plan) — /ai/weekly-plan* 연동
   ================================================ */

const CATEGORY_LABEL = {
  cert: '자격증', course: '과목', skill: '스킬', project: '프로젝트',
  language: '어학', graduation: '졸업요건', other: '기타',
};
const CATEGORY_BADGE = {
  cert: 'badge-purple', course: 'badge-blue', skill: 'badge-green',
  project: 'badge-amber', language: 'badge-blue', graduation: 'badge-red', other: 'badge-blue',
};
const ACADEMIC_PHASE_LABEL = {
  normal: '평소', midterm: '중간고사 기간', final: '기말고사 기간',
  vacation: '방학', registration: '수강신청 기간',
};

let currentPlanId = null;
let pollTimer = null;
let currentTargetJob = null; // loadCurrentTargetJob()이 채움 — 계획 jobCode와 대조용

// KST 자정 기준 오늘 날짜(YYYY-MM-DD) — <input type="date"> value로 그대로 쓸 수 있다.
function todayKstDateString() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// escapeHtml/formatKstDate는 careerAi.js(공용, 이 스크립트보다 먼저 로드됨) 참고.

function showSection(id) {
  ['cp-empty', 'cp-pending', 'cp-failed', 'cp-plan'].forEach(sectionId => {
    document.getElementById(sectionId).style.display = sectionId === id ? 'block' : 'none';
  });
}

function renderItem(item) {
  const categoryLabel = CATEGORY_LABEL[item.category] || item.category;
  const categoryBadge = CATEGORY_BADGE[item.category] || 'badge-blue';
  const deadlineBadge = item.isDeadline
    ? `<span class="badge badge-red" style="margin-left:6px;">마감 ${escapeHtml(formatKstDate(item.dueDate))}</span>`
    : '';

  return `
    <div class="card" style="padding:16px 18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge ${categoryBadge}">${escapeHtml(categoryLabel)}</span>
          <strong style="font-size:14px;">${escapeHtml(item.title)}</strong>
          ${deadlineBadge}
        </div>
        <div style="font-size:12px;color:var(--text2);white-space:nowrap;">
          ${item.estimatedHours}h · 우선순위 ${item.priority}
        </div>
      </div>
      ${item.reason ? `<p style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.6;">${escapeHtml(item.reason)}</p>` : ''}
    </div>`;
}

function renderPlan(plan) {
  currentPlanId = plan._id;

  document.getElementById('cp-range').textContent =
    `${formatKstDate(plan.weekStart)} ~ ${formatKstDate(plan.weekEnd)}`;

  const phaseLabel = ACADEMIC_PHASE_LABEL[plan.computed?.academicPhase] || plan.computed?.academicPhase || '-';
  document.getElementById('cp-status-badge').textContent = `학사 상태: ${phaseLabel}`;

  // notices: 정보성 안내(시간표 데이터 없음, 마감 매칭 실패 등) — 조치가 필요한 건
  // 아니라서 amber로만 표시. errors: 실제로 시간/항목이 버려진 경우만 — red로 구분해서
  // 사용자가 뭘 조치해야 하는지 헷갈리지 않게 한다.
  const distNotices = plan.distribution?.notices || [];
  const noticesEl = document.getElementById('cp-timetable-warning');
  noticesEl.innerHTML = distNotices.length
    ? `<div style="margin-top:10px;padding:10px 14px;background:var(--amber-bg);color:var(--amber);border-radius:8px;font-size:12px;line-height:1.6;">
        ${distNotices.map(n => `ℹ️ ${escapeHtml(n)}`).join('<br>')}
      </div>`
    : '';

  const distErrors = plan.distribution?.errors || [];
  const distEl = document.getElementById('cp-dist-errors');
  distEl.innerHTML = distErrors.length
    ? `<div style="margin-top:10px;padding:10px 14px;background:var(--red-bg);color:var(--red);border-radius:8px;font-size:12px;line-height:1.6;">
        ${distErrors.map(e => `⚠️ ${escapeHtml(e)}`).join('<br>')}
      </div>`
    : '';

  const total = plan.computed?.availableHoursTotal || 0;
  const allocated = plan.computed?.allocatedHours || 0;
  const pct = total ? Math.min(100, Math.round(allocated / total * 100)) : 0;
  document.getElementById('cp-hours').textContent = `${allocated}h / ${total}h`;
  document.getElementById('cp-hours-fill').style.width = pct + '%';

  document.getElementById('cp-goal').textContent = plan.goal || '';

  // 계획 생성 시점 목표 직무(plan.jobCode)와 지금 목표 직무가 다르면 배너를 띄운다 —
  // 옛 jobCode 없는 계획(스키마 추가 이전 생성분)은 대조할 수 없으므로 조용히 건너뛴다.
  const isStale = plan.jobCode && currentTargetJob?.jobCode && plan.jobCode !== currentTargetJob.jobCode;
  const mismatchEl = document.getElementById('cp-job-mismatch');
  if (isStale) {
    mismatchEl.style.display = 'block';
    mismatchEl.textContent = `⚠️ 이 계획은 '${plan.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '${currentTargetJob.title}'입니다. 다시 생성하면 반영됩니다.`;
  } else {
    mismatchEl.style.display = 'none';
  }

  const itemsEl = document.getElementById('cp-items');
  itemsEl.innerHTML = (plan.items || []).map(renderItem).join('')
    || '<div class="card" style="text-align:center;padding:24px;color:var(--text2);font-size:13px;">배치된 항목이 없습니다.</div>';

  showSection('cp-plan');
  loadDailyChecklist(plan._id);
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']; // getWeekDateStrings와 동일 순서(0=일)

function renderDailyDay(day, index) {
  const [, month, dayOfMonth] = day.date.split('-');
  const hasItems = (day.items || []).length > 0;
  // 오늘 이전 + 배치 항목 없는 날은 흐리게 — 중간 주에 계획을 새로 생성하면 지나간
  // 빈 요일 칸이 앞으로 채워질 요일보다 시선을 더 끌어서 정작 봐야 할 오늘 이후를 가린다.
  const isEmptyPast = !hasItems && day.date < todayKstDateString();
  const itemsHtml = (day.items || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => `
      <div style="font-size:11px;line-height:1.5;color:${item.isCompleted ? 'var(--text2)' : 'var(--text1)'};${item.isCompleted ? 'text-decoration:line-through;' : ''}">
        <span onclick="toggleChecklistItem('${item._id}')" style="cursor:pointer;">${item.isCompleted ? '✅' : '⬜'}</span> ${escapeHtml(item.content)}
      </div>`)
    .join('') || '<div style="font-size:11px;color:var(--text2);">-</div>';

  return `
    <div style="flex:1;min-width:100px;background:var(--bg3);border-radius:8px;padding:10px;${isEmptyPast ? 'opacity:0.45;' : ''}">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px;">${month}/${dayOfMonth} (${DAY_LABELS[index]})</div>
      <div style="display:flex;flex-direction:column;gap:6px;">${itemsHtml}</div>
    </div>`;
}

async function loadDailyChecklist(planId) {
  const data = await callApi(`/ai/weekly-plan/${planId}/checklist`);
  const container = document.getElementById('cp-daily');
  if (data.httpStatus !== 200 || !data.success) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text2);">일별 배치 정보를 불러오지 못했습니다.</div>';
    return;
  }
  container.innerHTML = (data.days || []).map(renderDailyDay).join('');
}

async function toggleChecklistItem(itemId) {
  const data = await callApi(`/ai/weekly-plan/checklist/${itemId}/toggle`, { method: 'POST' });
  if (data.httpStatus === 200 && currentPlanId) {
    loadDailyChecklist(currentPlanId);
  }
}

async function loadCurrentPlan() {
  const data = await callApi('/ai/weekly-plan/current');

  if (data.httpStatus === 404) {
    showSection('cp-empty');
    return;
  }

  if (data.status === 'pending') {
    showSection('cp-pending');
    currentPlanId = data.id || currentPlanId;
    startPolling();
    return;
  }

  if (data.status === 'failed') {
    document.getElementById('cp-failed-msg').textContent = data.errorMessage || '생성에 실패했습니다.';
    showSection('cp-failed');
    return;
  }

  if (data.status === 'done' && data.data) {
    renderPlan(data.data);
    return;
  }

  showSection('cp-empty');
}

function startPolling() {
  if (!currentPlanId) return;
  showSection('cp-pending');
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = pollUntilDone(
    `/ai/weekly-plan/${currentPlanId}`,
    null,
    (data) => {
      if (data.status === 'done' && data.data) {
        renderPlan(data.data);
      } else {
        document.getElementById('cp-failed-msg').textContent = data.errorMessage || '생성에 실패했습니다.';
        showSection('cp-failed');
      }
    },
  );
}

async function generatePlan() {
  // weekStart를 안 보내면 서버가 "오늘이 일/월이 아니면 다음 주"를 기본값으로 잡는다
  // (이미 절반 지난 주를 계획해봐야 의미가 적다는 이유 — controllers/aiController.js
  // resolveWeekStart 참고). 이 페이지는 /ai/weekly-plan/current로 "이번 주"를 보여주고
  // 있으므로, 화면에 보여준 주와 항상 같은 주를 생성하도록 명시적으로 오늘 날짜를 보낸다.
  const weekStart = document.getElementById('cp-weekstart')?.value || todayKstDateString();

  const data = await callApi('/ai/weekly-plan', {
    method: 'POST',
    body: JSON.stringify({ weekStart }),
  });

  if (data.httpStatus === 202 && data.id) {
    currentPlanId = data.id;
    startPolling();
  } else if (data.httpStatus === 400) {
    alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`);
  } else if (data.httpStatus === 409) {
    alert('이미 생성 중인 계획이 있습니다.');
  } else {
    alert(data.message || '요청 처리에 실패했습니다.');
  }
}

async function redistribute() {
  if (!currentPlanId) return;
  const data = await callApi(`/ai/weekly-plan/${currentPlanId}/distribute`, { method: 'POST' });
  if (data.httpStatus === 200) {
    loadCurrentPlan();
  } else {
    alert(data.message || '재분배에 실패했습니다.');
  }
}

async function loadCurrentTargetJob() {
  const data = await callApi('/ai/portfolio/readiness');
  if (data.httpStatus === 200) currentTargetJob = data.currentJob || null;

  // 목표 직무 없이 생성하면 서버가 400으로 막지만(POST /ai/weekly-plan), 버튼을 눌러보고
  // 나서야 아는 것보다 애초에 못 누르게 하는 게 낫다 — 포트폴리오/진단 페이지와 동일한 패턴.
  const disabledTitle = currentTargetJob ? '' : '목표 직무를 먼저 설정해주세요.';
  [document.getElementById('cp-generate-btn'), document.getElementById('cp-regenerate-btn')].forEach(btn => {
    if (!btn) return;
    btn.disabled = !currentTargetJob;
    btn.title = disabledTitle;
  });
}

// 0~100 퍼센트 값으로 배지 색을 고른다 — fillClassForScore(진행바용, careerAi.js)와
// 같은 구간 기준이라 화면 전체에서 "70 이상은 초록" 같은 색 언어가 일관된다.
function pctBadgeClass(pct) {
  if (pct >= 70) return 'badge-green';
  if (pct >= 40) return 'badge-blue';
  if (pct > 0) return 'badge-amber';
  return 'badge-red';
}

// completionRate와 같은 방식(슬롯 단위)으로 센 카테고리별 실행률 — planned가 0인
// 카테고리는 애초에 서버가 안 보내므로 여기서 따로 거를 필요가 없다.
function renderCategoryStats(byCategory) {
  if (!byCategory.length) {
    return '<div style="font-size:12px;color:var(--text2);">아직 카테고리별로 볼 데이터가 없습니다.</div>';
  }
  return byCategory.map(c => {
    const pct = Math.round((c.rate || 0) * 100);
    const label = CATEGORY_LABEL[c.category] || c.category;
    return `
      <div class="progress-wrap" style="margin-bottom:10px;">
        <div class="progress-header">
          <span class="progress-label">${escapeHtml(label)}</span>
          <span class="progress-value">${c.completed}/${c.planned} (${pct}%)</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${fillClassForScore(pct)}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function renderHistoryItem(plan) {
  const pct = plan.completionRate == null ? null : Math.round(plan.completionRate * 100);
  const badgeText = pct == null ? '집계 불가' : `${pct}%`;
  const badgeClass = pct == null ? 'badge-blue' : pctBadgeClass(pct);

  return `
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--text2);">${formatKstDate(plan.weekStart)} ~ ${formatKstDate(plan.weekEnd)}</span>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      <p style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.6;">${escapeHtml(plan.goal || '-')}</p>
    </div>`;
}

async function loadStatsAndHistory() {
  const [statsData, historyData] = await Promise.all([
    callApi('/ai/weekly-plan/stats'),
    callApi('/ai/weekly-plan/history?limit=12'),
  ]);

  if (statsData.httpStatus !== 200 || !statsData.totalWeeks) {
    document.getElementById('cp-stats-empty').style.display = 'block';
    document.getElementById('cp-stats-body').style.display = 'none';
    return;
  }

  document.getElementById('cp-stats-empty').style.display = 'none';
  document.getElementById('cp-stats-body').style.display = 'block';

  document.getElementById('cp-stats-total').textContent = `${statsData.totalWeeks}주`;
  document.getElementById('cp-stats-avg').textContent =
    statsData.avgCompletionRate == null ? '-' : `${Math.round(statsData.avgCompletionRate * 100)}%`;
  document.getElementById('cp-stats-streak').textContent = `${statsData.currentStreak}주`;

  document.getElementById('cp-stats-category').innerHTML = renderCategoryStats(statsData.byCategory || []);

  const history = historyData.httpStatus === 200 ? (historyData.history || []) : [];
  document.getElementById('cp-history-list').innerHTML = history.length
    ? history.map(renderHistoryItem).join('')
    : '<div style="font-size:12px;color:var(--text2);">기록이 없습니다.</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
  const weekstartInput = document.getElementById('cp-weekstart');
  if (weekstartInput) weekstartInput.value = todayKstDateString();
  // currentTargetJob이 채워진 뒤에 렌더해야 첫 로드에서도 직무 불일치 배너가 정확히 뜬다.
  await loadCurrentTargetJob();
  loadCurrentPlan();
  loadStatsAndHistory();
  renderAllBlockedBanner('cp-all-blocked-banner');
});
