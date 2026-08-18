/* ================================================
   AcadMe — careerPortfolio.js
   진로 포트폴리오 페이지 (/career/portfolio) — /ai/portfolio* 연동
   ================================================ */

let currentPortfolioId = null;
let pfPollTimer = null;
let currentTargetJob = null; // loadReadiness()가 채움 — 포트폴리오 jobCode와 대조용

function renderReadiness(data) {
  document.getElementById('pf-total-badge').textContent = `총점 ${data.total ?? 0}`;
  document.getElementById('pf-breakdown').innerHTML = renderScoreBreakdown(data.breakdown);

  const blockersEl = document.getElementById('pf-blockers');
  blockersEl.innerHTML = (data.blockers || []).length
    ? `<div style="margin-top:12px;padding:10px 14px;background:var(--red-bg);color:var(--red);border-radius:8px;font-size:12px;line-height:1.6;">
        ${data.blockers.map(b => `⚠️ ${escapeHtml(b)}`).join('<br>')}
      </div>`
    : '';

  document.getElementById('pf-missing').innerHTML = renderMissingList(data.missing);

  const btn = document.getElementById('pf-generate-btn');
  btn.disabled = !data.ready;
  btn.title = data.ready ? '' : '준비도 요건을 먼저 채워주세요.';
}

function renderSection(section) {
  const evidenceChips = (section.evidence || []).map(e =>
    `<span class="evidence-chip" style="margin-right:4px;margin-top:4px;">${escapeHtml(e)}</span>`,
  ).join('');

  return `
    <div class="card">
      <div class="card-title" style="margin-bottom:8px;">${escapeHtml(section.heading)}</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.7;">${escapeHtml(section.body)}</p>
      ${evidenceChips ? `<div style="margin-top:10px;">${evidenceChips}</div>` : ''}
    </div>`;
}

// 생성 시점 목표 직무(doc.jobCode)와 지금 목표 직무가 다르면 배너를 띄우고 PDF
// 내보내기를 막는다 — 옛 직무 기준 문서를 제출용으로 뽑아내는 사고를 막기 위함.
// (서버 /ai/portfolio/:id/print도 같은 조건으로 한 번 더 막는다, 배너는 우회 가능하므로.)
function renderPortfolio(doc) {
  currentPortfolioId = doc._id;

  document.getElementById('pf-job-title').textContent = doc.jobTitle ? `목표 직무: ${doc.jobTitle}` : '진로 포트폴리오';
  document.getElementById('pf-summary').textContent = doc.summary || '';
  document.getElementById('pf-sections').innerHTML = (doc.sections || []).map(renderSection).join('')
    || '<div class="card" style="text-align:center;padding:24px;color:var(--text2);font-size:13px;">생성된 섹션이 없습니다.</div>';

  const isStale = doc.jobCode && currentTargetJob?.jobCode && doc.jobCode !== currentTargetJob.jobCode;
  const printLink = document.getElementById('pf-print-link');
  const mismatchEl = document.getElementById('pf-job-mismatch');
  if (isStale) {
    printLink.style.display = 'none';
    mismatchEl.style.display = 'block';
    mismatchEl.textContent = `⚠️ 이 포트폴리오는 '${doc.jobTitle}' 기준으로 생성되었습니다. 현재 목표 직무는 '${currentTargetJob.title}'입니다. 다시 생성해 주세요.`;
  } else {
    printLink.style.display = '';
    printLink.href = `/ai/portfolio/${doc._id}/print`;
    mismatchEl.style.display = 'none';
  }

  showResultSection('pf-result');
}

function showResultSection(id) {
  ['pf-empty', 'pf-pending', 'pf-failed', 'pf-result'].forEach(sectionId => {
    document.getElementById(sectionId).style.display = sectionId === id ? 'block' : 'none';
  });
}

async function loadLatestPortfolio() {
  const data = await callApi('/ai/portfolio/latest');

  if (data.httpStatus === 404) {
    showResultSection('pf-empty');
    return;
  }
  if (data.status === 'done' && data.data) {
    renderPortfolio(data.data);
  } else {
    showResultSection('pf-empty');
  }
}

async function loadReadiness() {
  const data = await callApi('/ai/portfolio/readiness');
  if (data.httpStatus === 200) {
    currentTargetJob = data.currentJob || null;
    renderReadiness(data);
  }
}

function startPfPolling() {
  if (!currentPortfolioId) return;
  showResultSection('pf-pending');
  if (pfPollTimer) clearInterval(pfPollTimer);
  pfPollTimer = pollUntilDone(
    `/ai/portfolio/${currentPortfolioId}`,
    null,
    (data) => {
      if (data.status === 'done' && data.data) {
        renderPortfolio(data.data);
      } else {
        document.getElementById('pf-failed-msg').textContent = data.errorMessage || '생성에 실패했습니다.';
        showResultSection('pf-failed');
      }
      loadReadiness();
    },
  );
}

async function generatePortfolio() {
  const data = await callApi('/ai/portfolio', { method: 'POST' });

  if (data.httpStatus === 202 && data.id) {
    currentPortfolioId = data.id;
    startPfPolling();
  } else if (data.httpStatus === 400) {
    alert(`아직 준비가 부족합니다.\n${(data.blockers || []).join('\n')}`);
  } else if (data.httpStatus === 409) {
    alert('이미 생성 중인 포트폴리오가 있습니다.');
  } else {
    alert(data.message || '요청 처리에 실패했습니다.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // currentTargetJob이 채워진 뒤에 렌더해야 첫 로드에서도 직무 불일치 배너가 정확히 뜬다.
  await loadReadiness();
  loadLatestPortfolio();
  renderAllBlockedBanner('pf-all-blocked-banner');
});
