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

  const itemsEl = document.getElementById('cp-items');
  itemsEl.innerHTML = (plan.items || []).map(renderItem).join('')
    || '<div class="card" style="text-align:center;padding:24px;color:var(--text2);font-size:13px;">배치된 항목이 없습니다.</div>';

  showSection('cp-plan');
  loadDailyChecklist(plan._id);
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']; // getWeekDateStrings와 동일 순서(0=일)

function renderDailyDay(day, index) {
  const [, month, dayOfMonth] = day.date.split('-');
  const itemsHtml = (day.items || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => `
      <div style="font-size:11px;line-height:1.5;color:${item.isCompleted ? 'var(--text2)' : 'var(--text1)'};${item.isCompleted ? 'text-decoration:line-through;' : ''}">
        <span onclick="toggleChecklistItem('${item._id}')" style="cursor:pointer;">${item.isCompleted ? '✅' : '⬜'}</span> ${escapeHtml(item.content)}
      </div>`)
    .join('') || '<div style="font-size:11px;color:var(--text2);">-</div>';

  return `
    <div style="flex:1;min-width:100px;background:var(--bg3);border-radius:8px;padding:10px;">
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

document.addEventListener('DOMContentLoaded', () => {
  const weekstartInput = document.getElementById('cp-weekstart');
  if (weekstartInput) weekstartInput.value = todayKstDateString();
  loadCurrentPlan();
});
