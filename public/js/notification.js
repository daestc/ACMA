//알림제어

let allAlerts = [];     // 지난 일정이 완벽 제외된 유효 알림 장부
let currentPage = 1; 
const itemsPerPage = 5; 
let totalNotifPages = 1;

// 1. 개별 알림 아이템 HTML 템플릿 생성
function createNotifItem(notice) {
  const badgeClass = notice.dDayBadgeClass || 'blue';
  let inlineBadgeStyle = 'color: #3b82f6; background: #dbeafe;'; // blue 기본
  if (badgeClass === 'red') inlineBadgeStyle = 'color: #ef4444; background: #fee2e2;';
  if (badgeClass === 'amber') inlineBadgeStyle = 'color: #f59e0b; background: #fef3c7;';

  return `
    <div class="notif-item" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="font-weight: 600; color: #334155; min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${notice.title || '알림'}
      </div>
      <div style="font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 6px; flex-shrink: 0; ${inlineBadgeStyle}">
        ${notice.dDayText || 'D-Day'}
      </div>
    </div>
  `;
}

// 2. 알림 패널 내부에 현재 페이지의 5개 아이템 덮어씌우기 렌더링
function renderNotifPage() {
  const notifListDiv = document.getElementById('dynamic-notif-list');
  const pageText = document.getElementById('notif-page-text');
  const prevBtn = document.getElementById('notif-prev-btn');
  const nextBtn = document.getElementById('notif-next-btn');

  if (!notifListDiv) return;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = allAlerts.slice(startIndex, endIndex);

  let htmlContent = '';
  pageItems.forEach(notice => {
    htmlContent += createNotifItem(notice);
  });
  notifListDiv.innerHTML = htmlContent;

  // 상단 미니 페이징 락 및 가이드 텍스트 제어
  if (pageText) pageText.innerText = `${currentPage}/${totalNotifPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage === 1);
  if (nextBtn) nextBtn.disabled = (currentPage === totalNotifPages);
}

// 3. 미니 페이징 화살표 `<` `>` 클릭 핸들러
window.moveNotifPage = function(direction) {
  const targetPage = currentPage + direction;
  if (targetPage >= 1 && targetPage <= totalNotifPages) {
    currentPage = targetPage;
    renderNotifPage();
  }
};

// 4. 사용자가 알림 종 클릭 시 패널 토글 및 읽음 처리
window.toggleNotifPanel = function() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;

  panel.classList.toggle('open'); 
  
  if (panel.classList.contains('open') && allAlerts.length > 0) {
    const currentAlerts = allAlerts.map(a => a.title).join('|');
    localStorage.setItem('last_read_alerts', currentAlerts); 
    
    // 알림창 확인 시 뱃지 색상을 회색으로 차분하게 톤다운
    const redDot = document.getElementById('notif-badge-dot');
    if (redDot) redDot.style.backgroundColor = '#94a3b8'; 
  }
};

// 5. 페이지 로드 시 실시간 급박한 알림 데이터 가져오기 순서
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/notice/urgent'); 
    const result = await response.json();
    const rawAlerts = Array.isArray(result) ? result : [];

    // 🎯 오늘 날짜 기준 유효한(지난 일정 제외) 알림 필터
    allAlerts = rawAlerts.filter(a => a.Dday >= 0);
    totalNotifPages = Math.ceil(allAlerts.length / itemsPerPage) || 1;

    const notifListDiv = document.getElementById('dynamic-notif-list');
    const redDot = document.getElementById('notif-badge-dot');

    if (allAlerts.length > 0) {
      currentPage = 1; 
      renderNotifPage(); 
         
      // 카운팅 배지 노출 및 숫자 바인딩
      if (redDot) {
        redDot.innerText = allAlerts.length;
        redDot.style.display = 'block';
      }

      // 읽음 상태 대조 지문 매칭
      const currentAlerts = allAlerts.map(a => a.title).join('|');
      const lastReadAlerts = localStorage.getItem('last_read_alerts');

      if (currentAlerts !== lastReadAlerts) {
        if (redDot) redDot.style.backgroundColor = '#ef4444'; // 새 알림 유입 시 레드
      } else {
        if (redDot) redDot.style.backgroundColor = '#94a3b8'; // 이미 읽었으면 차분한 회색
      }
  
    } else {
      if (notifListDiv) {
        notifListDiv.innerHTML = '<p class="notif-empty" style="padding: 20px; text-align: center; color: #94a3b8;">다가오는 일정이 없어요!</p>';
      }
      if (redDot) redDot.style.display = 'none';
      if (document.getElementById('notif-page-text')) {
        document.getElementById('notif-page-text').innerText = "0/0";
      }
    }
  } catch (error) {
    console.error(" 알림 데이터를 가져오는데 실패함:", error);
    const notifListDiv = document.getElementById('dynamic-notif-list');
    if (notifListDiv) {
      notifListDiv.innerHTML = '<p class="notif-empty" style="padding: 20px; text-align: center; color: #ef4444;">알림 로드 실패</p>';
    }
  }
});