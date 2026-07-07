/* ================================================
   AcadMe — common.js
   모든 페이지에서 공통으로 사용하는 유틸리티 함수
   ================================================ */

// ── 사이드바 (데스크탑: 호버 / 모바일: 토글) ─────
let _sbTimer = null;

function sbExpand() {
  clearTimeout(_sbTimer);
  const sb = document.getElementById('app-sidebar');
  if (!sb) return;
  sb.classList.add('expanded');
  sb.style.width = '220px';
}

function sbCollapse() {
  _sbTimer = setTimeout(() => {
    const sb = document.getElementById('app-sidebar');
    if (!sb) return;
    sb.classList.remove('expanded');
    sb.style.width = '52px';
  }, 150);
}

// 모바일 전용 토글
function toggleSidebar() {
  if (window.innerWidth >= 769) return;
  const sidebar  = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  backdrop?.classList.toggle('visible', !isOpen);
}

function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('visible');
}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 769) closeSidebar();
});

// ── 체크박스 토글 ─────────────────────────────────
function toggleCheck(el) {
  el.classList.toggle('checked');
  el.textContent = el.classList.contains('checked') ? '✓' : '';
  if (el.nextElementSibling) {
    el.nextElementSibling.classList.toggle('done', el.classList.contains('checked'));
  }
}

// ── 필터 칩 (공지사항, 진로정보 등) ──────────────
function filterChip(el) {
  el.closest('.filter-row').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ── 토글 스위치 ───────────────────────────────────
function toggleSwitch(el) {
  el.classList.toggle('on');
}

// ── 마이페이지 모달 ───────────────────────────────
function openMyPageModal() {
  document.getElementById('mypage-modal-overlay').style.display = 'flex';
}

function closeMyPageModal() {
  document.getElementById('mypage-modal-overlay').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('mypage-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeMyPageModal();
    });
  }
});

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeMyPageModal();
  document.querySelectorAll('[id$="-modal"]').forEach(m => {
    m.style.display = 'none';
  });
});

// ── 로그아웃 ──────────────────────────────────────
function logout() {
  fetch('/auth/logout', { method: 'POST' })
    .finally(() => { window.location.href = '/'; });
}
