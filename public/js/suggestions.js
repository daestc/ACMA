const MAX_IMAGES = 3;

function showMsg(text, isError) {
  const box = document.getElementById('sg-msg');
  if (!box) return;
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

function renderImagePreview() {
  const input = document.getElementById('sg-images');
  const wrap = document.getElementById('sg-image-preview-wrap');
  if (!input || !wrap) return;

  wrap.innerHTML = '';
  const files = Array.from(input.files || []).slice(0, MAX_IMAGES);

  files.forEach((file) => {
    const img = document.createElement('img');
    img.className = 'sg-image-preview';
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    wrap.appendChild(img);
  });
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

async function submitSuggestion() {
  const category = document.getElementById('sg-category')?.value;
  const title = document.getElementById('sg-title')?.value.trim();
  const content = document.getElementById('sg-content')?.value.trim();
  const imageInput = document.getElementById('sg-images');
  const btn = document.getElementById('sg-submit-btn');

  if (!title || !content) {
    showMsg('제목과 내용을 입력해주세요.', true);
    return;
  }

  const files = Array.from(imageInput?.files || []);
  if (files.length > MAX_IMAGES) {
    showMsg(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`, true);
    return;
  }

  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const formData = new FormData();
    formData.append('category', category);
    formData.append('title', title);
    formData.append('content', content);
    files.forEach((file) => formData.append('images', file));

    const res = await fetch('/suggestions', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (data.ok) {
      showMsg('건의가 등록되었습니다.', false);
      setTimeout(() => { window.location.reload(); }, 700);
    } else {
      showMsg(data.message || '등록에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '등록하기';
  }
}

function closeSuggestionModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('sg-modal-backdrop')?.classList.remove('open');
}

async function openSuggestion(id) {
  try {
    const res = await fetch(`/suggestions/${id}`);
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || '건의를 불러올 수 없습니다.');
      return;
    }

    const item = data.suggestion;
    document.getElementById('sg-modal-title').textContent = item.title;
    document.getElementById('sg-modal-meta').innerHTML =
      `<span class="badge badge-blue">${escapeHtml(item.categoryName)}</span>` +
      `<span style="margin-left:8px;">${escapeHtml(item.statusName)}</span>` +
      `<span style="margin-left:8px;">${formatDate(item.createdAt)}</span>`;
    document.getElementById('sg-modal-content').textContent = item.content;
    renderModalImages('sg-modal-images', item.imageUrls);

    const replyWrap = document.getElementById('sg-modal-reply-wrap');
    if (item.status === 'completed' && item.staffReply) {
      replyWrap.style.display = 'block';
      document.getElementById('sg-modal-reply').textContent = item.staffReply;
      document.getElementById('sg-modal-reply-meta').textContent =
        `${item.repliedByName || '대학관계자'} · ${formatDate(item.repliedAt)}`;
    } else {
      replyWrap.style.display = 'none';
    }

    document.getElementById('sg-modal-backdrop').classList.add('open');
  } catch {
    alert('서버와 통신할 수 없습니다.');
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

document.getElementById('sg-images')?.addEventListener('change', renderImagePreview);

window.submitSuggestion = submitSuggestion;
window.openSuggestion = openSuggestion;
window.closeSuggestionModal = closeSuggestionModal;
