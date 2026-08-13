/* ================================================
   AcadMe — careerAi.js
   주간 계획/포트폴리오/진단 3개 페이지가 공유하는
   /ai/* 호출 헬퍼 (aiTest.ejs의 폴링 패턴을 옮김)
   ================================================ */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

// fetch를 감싸서 항상 { httpStatus, ...body } 형태로 반환 — 호출부가 매번
// response.ok/response.json()을 따로 안 챙겨도 되게 한다.
async function callApi(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let body;
  try {
    body = await res.json();
  } catch (_) {
    body = { parseError: true, statusText: res.statusText };
  }
  return { httpStatus: res.status, ...body };
}

// status가 'done'|'failed'가 될 때까지 url을 2초 간격으로 조회한다.
// onUpdate(data)는 매 폴링마다, onDone(data)는 끝났을 때(성공/실패/타임아웃 공통) 호출.
function pollUntilDone(url, onUpdate, onDone) {
  const startedAt = Date.now();

  const timer = setInterval(async () => {
    const data = await callApi(url);
    if (onUpdate) onUpdate(data);

    const finished = data.status === 'done' || data.status === 'failed';
    const timedOut = Date.now() - startedAt > POLL_TIMEOUT_MS;

    if (finished || timedOut) {
      clearInterval(timer);
      if (onDone) onDone(data, timedOut && !finished);
    }
  }, POLL_INTERVAL_MS);

  return timer;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// KST 자정 기준 YYYY.MM.DD로 포맷 — 서버(utils/kstDate.js)와 동일 규칙,
// 브라우저 로캘/타임존에 흔들리지 않게 직접 계산한다.
function formatKstDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

// readinessService.checkReadiness/checkDiagnosisReadiness의 breakdown(7행: key/label/
// score/weight/detail)을 포트폴리오·진단 두 페이지가 동일한 시각 언어로 렌더한다.
function renderScoreBreakdown(breakdown) {
  return (breakdown || []).map(row => {
    const pct = Math.max(0, Math.min(100, row.score || 0));
    return `
      <div class="progress-wrap">
        <div class="progress-header">
          <span class="progress-label">${escapeHtml(row.label)}</span>
          <span class="progress-value">${escapeHtml(row.detail || '-')}</span>
        </div>
        <div class="progress-track"><div class="progress-fill fill-blue" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// missingAnalyzer.analyzeMissing 결과(key/label/reason/impact/link)를 링크 가능한
// 리스트로 렌더한다.
function renderMissingList(missing) {
  if (!missing || !missing.length) return '';
  const impactBadge = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' };
  return `
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
      ${missing.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:8px;">
          <div>
            <span class="badge ${impactBadge[m.impact] || 'badge-blue'}" style="margin-right:6px;">${escapeHtml(m.label)}</span>
            <span style="font-size:12px;color:var(--text2);">${escapeHtml(m.reason)}</span>
          </div>
          ${m.link ? `<a href="${escapeHtml(m.link)}" class="btn btn-ghost btn-sm" style="white-space:nowrap;">채우러 가기</a>` : ''}
        </div>
      `).join('')}
    </div>`;
}
