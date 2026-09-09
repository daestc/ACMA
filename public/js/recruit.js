function switchRecruitStatus(status, btn) {
      document.querySelectorAll('.recruit-status-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cards = document.querySelectorAll('.recruit-card');
      let visibleCount = 0;

      cards.forEach(card => {
        let show = false;
        if (status === 'open') show = card.dataset.status === 'open';
        else if (status === 'closed') show = card.dataset.status === 'closed';
        else if (status === 'scrap') show = card.classList.contains('is-scrapped');

        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      document.getElementById('recruit-empty-state').style.display = visibleCount === 0 ? 'block' : 'none';
    }

    function toggleScrap(event, btn) {
      event.stopPropagation();
      btn.classList.toggle('active');

      const card = btn.closest('.recruit-card');
      card.classList.toggle('is-scrapped', btn.classList.contains('active'));

      const activeTab = document.querySelector('.recruit-status-tabs .tab-btn.active');
      if (activeTab && activeTab.dataset.status === 'scrap' && !btn.classList.contains('active')) {
        card.style.display = 'none';
        const anyVisible = [...document.querySelectorAll('.recruit-card')].some(c => c.style.display !== 'none');
        document.getElementById('recruit-empty-state').style.display = anyVisible ? 'none' : 'block';
      }
    }

function toggleJobCategoryBox() {
  const box = document.getElementById('recruit-category-box');
  const field = document.getElementById('recruit-job-field');
  const caret = document.getElementById('recruit-job-caret');
  const isOpen = box.classList.toggle('open');
  if(field) field.classList.toggle('active', isOpen);
  if(caret) caret.textContent = isOpen ? '▴' : '▾';
}

function selectCategory(el) {
  const wasActive = el.classList.contains('active');
  document.querySelectorAll('.recruit-category-item').forEach(b => b.classList.remove('active'));
  if (!wasActive) el.classList.add('active');
}

function switchRecruitRegion(region, btn) {
  document.querySelectorAll('.recruit-region-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
    

// 카테고리 박스 열고 닫기
function toggleJobCategoryBox() {
    const box = document.getElementById('recruit-category-box');
    const field = document.getElementById('recruit-job-field');
    const caret = document.getElementById('recruit-job-caret');
    if(box) {
        const isOpen = box.classList.toggle('open');
        if(field) field.classList.toggle('active', isOpen);
        if(caret) caret.textContent = isOpen ? '▴' : '▾';
    }
}

// 지역 탭 전환
function switchRecruitRegion(region, btn) {
    document.querySelectorAll('.recruit-region-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// 🚀 진짜 서버와 통신하는 스크랩 버튼 함수
async function toggleScrap(event, btn) {
    event.stopPropagation(); // 카드 클릭(새창 열기) 방지
    
    const recruitId = btn.dataset.id;
    if (!recruitId) return;

    try {
        const response = await fetch(`/recruit/${recruitId}/scrap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // 로그인 세션 유지
        });

        const data = await response.json();

        if (data.success) {
            btn.classList.toggle('active', data.isScrapped);
            
            const activeTab = document.querySelector('.recruit-status-tabs .tab-btn.active');
            if (activeTab && activeTab.dataset.status === 'scrap' && !data.isScrapped) {
                btn.closest('.recruit-card').style.display = 'none';
            }
        } else {
            alert(data.message || '로그인이 필요합니다.');
        }
    } catch (error) {
        console.error('스크랩 요청 에러:', error);
        alert('서버와 통신할 수 없습니다.');
    }
}
