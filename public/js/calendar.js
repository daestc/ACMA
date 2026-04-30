/* ================================================
   AcadMe — calendar.js
   캘린더 페이지 전용: 월간 ↔ 주간 뷰 전환
   ================================================ */

function switchCalView(view) {
  const isMonth = view === 'month';

  document.getElementById('cal-month-view').style.display = isMonth ? 'block' : 'none';
  document.getElementById('cal-week-view').style.display  = isMonth ? 'none'  : 'block';

  document.getElementById('cal-tab-month').classList.toggle('active',  isMonth);
  document.getElementById('cal-tab-week').classList.toggle('active',  !isMonth);
}
