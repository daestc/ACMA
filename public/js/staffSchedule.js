function showMsg(text, isError) {
  const box = document.getElementById('sch-msg');
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

async function submitSchedule() {
  const title = document.getElementById('sch-title').value.trim();
  const startDate = document.getElementById('sch-start').value;
  const endDate = document.getElementById('sch-end').value;
  const description = document.getElementById('sch-desc').value.trim();
  const btn = document.getElementById('sch-submit-btn');

  if (!title || !startDate) {
    showMsg('제목과 시작일을 입력해주세요.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const res = await fetch('/staff/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startDate, endDate, description }),
    });
    const data = await res.json();

    if (data.ok) {
      showMsg('일정이 등록되었습니다.', false);
      setTimeout(() => location.reload(), 800);
    } else {
      showMsg(data.message || '등록에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '일정 등록';
  }
}

async function deleteSchedule(id, btn) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;

  btn.disabled = true;
  try {
    const res = await fetch(`/staff/schedules/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      btn.closest('[style*="border:1px solid"]').remove();
    } else {
      alert(data.message || '삭제에 실패했습니다.');
      btn.disabled = false;
    }
  } catch {
    alert('서버와 통신할 수 없습니다.');
    btn.disabled = false;
  }
}
