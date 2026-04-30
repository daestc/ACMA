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
