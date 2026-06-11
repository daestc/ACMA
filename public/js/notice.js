//공지사항

// 1. 사이드바 / 알림바 토글 제어
window.toggleSidebar = function() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('active');
  }
};

window.closeSidebar = function() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  }
};

// 2. 공지사항 카테고리 칩 버튼 필터링
window.filterChip = function(clickedChip) {
  const chips = document.querySelectorAll('.chip'); 
  chips.forEach(chip => chip.classList.remove('active'));
  clickedChip.classList.add('active');

  // 한글만 남기고 정규식 컷팅
  const selected = clickedChip.innerText.replace(/[^\uAC00-\uD7AF]/gi, "").trim();
  const items = document.querySelectorAll('.notice-item');

  items.forEach(item => {
    const itemCat = item.getAttribute('data-category');
    if (selected === '전체' || itemCat === selected) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};