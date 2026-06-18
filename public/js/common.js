/* ================================================
   AcadMe — common.js
   모든 페이지에서 공통으로 사용하는 유틸리티 함수
   ================================================ */

// ── 사이드바 토글 ─────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const icon     = document.getElementById('hamburger-icon');
  const isOpen   = sidebar.classList.contains('open');

  sidebar.classList.toggle('open', !isOpen);
  backdrop.classList.toggle('visible', !isOpen);
  if (icon) icon.classList.toggle('open', !isOpen);
}

function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('visible');
  document.getElementById('hamburger-icon')?.classList.remove('open');
}

// 화면 넓어지면 사이드바 자동으로 닫기
window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) closeSidebar();
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

// 수상경력 추가 모달
function openAwardModal() {
  document.getElementById('award-modal').style.display = 'flex';
}
function closeAwardModal() {
  document.getElementById('award-modal').style.display = 'none';
}

// 오버레이 클릭 닫기
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('mypage-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeMyPageModal();
    });
  }
});

// ESC 키로 모달 전체 닫기
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
