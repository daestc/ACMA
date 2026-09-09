let currentSuggestionId = null;

function showStaffMsg(text, isError) {
  const box = document.getElementById('st-sg-msg');
  if (!box) return;
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

function closeStaffSuggestionModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('st-sg-modal-backdrop')?.classList.remove('open');
  currentSuggestionId = null;
}

function renderModalImages(containerId, imageUrls) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!imageUrls?.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'grid';
  container.innerHTML = imageUrls.map((url) =>
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      <img src="${escapeHtml(url)}" alt="첨부 사진">
    </a>`,
  ).join('');
}

async function openStaffSuggestion(id) {
  currentSuggestionId = id;

  try {
    const res = await fetch(`/staff/suggestions/${id}`);
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || '건의를 불러올 수 없습니다.');
      return;
    }

    const item = data.suggestion;
    document.getElementById('st-sg-modal-title').textContent = item.title;
    document.getElementById('st-sg-modal-meta').innerHTML =
      `<span class="badge badge-blue">${escapeHtml(item.categoryName)}</span>` +
      `<span style="margin-left:8px;">${escapeHtml(item.authorName)}</span>` +
      `<span style="margin-left:8px;">${escapeHtml(item.statusName)}</span>` +
      `<span style="margin-left:8px;">${formatDate(item.createdAt)}</span>`;
    document.getElementById('st-sg-modal-content').textContent = item.content;
    renderModalImages('st-sg-modal-images', item.imageUrls);

    const existingReply = document.getElementById('st-sg-existing-reply');
    const replyForm = document.getElementById('st-sg-reply-form');
    const replyInput = document.getElementById('st-sg-reply');
    const replyBtn = document.getElementById('st-sg-reply-btn');

    if (item.status === 'completed' && item.staffReply) {
      existingReply.style.display = 'block';
      document.getElementById('st-sg-existing-reply-text').textContent = item.staffReply;
      document.getElementById('st-sg-existing-reply-meta').textContent =
        `${item.repliedByName || '대학관계자'} · ${formatDate(item.repliedAt)}`;
      replyForm.style.display = 'none';
    } else {
      existingReply.style.display = 'none';
      replyForm.style.display = 'block';
      replyInput.value = '';
      replyBtn.disabled = false;
      replyBtn.textContent = '답변 등록 · 처리완료';
      document.getElementById('st-sg-msg').style.display = 'none';
    }

    document.getElementById('st-sg-modal-backdrop').classList.add('open');
  } catch {
    alert('서버와 통신할 수 없습니다.');
  }
}

async function submitStaffReply() {
  if (!currentSuggestionId) return;

  const reply = document.getElementById('st-sg-reply')?.value.trim();
  const btn = document.getElementById('st-sg-reply-btn');

  if (!reply) {
    showStaffMsg('답변 내용을 입력해주세요.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const res = await fetch(`/staff/suggestions/${currentSuggestionId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    });
    const data = await res.json();

    if (data.ok) {
      showStaffMsg('답변이 등록되었습니다.', false);
      setTimeout(() => { window.location.reload(); }, 700);
    } else {
      showStaffMsg(data.message || '등록에 실패했습니다.', true);
      btn.disabled = false;
      btn.textContent = '답변 등록 · 처리완료';
    }
  } catch {
    showStaffMsg('서버와 통신할 수 없습니다.', true);
    btn.disabled = false;
    btn.textContent = '답변 등록 · 처리완료';
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ko-KR');
}

window.openStaffSuggestion = openStaffSuggestion;
window.closeStaffSuggestionModal = closeStaffSuggestionModal;
window.submitStaffReply = submitStaffReply;
