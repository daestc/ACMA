function showMsg(text, isError) {
  const box = document.getElementById('gr-msg');
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

async function saveGraduation() {
  const btn = document.getElementById('gr-save-btn');
  const certs = document.getElementById('gr-certs').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const body = {
    requiredTotalCredits: document.getElementById('gr-total').value,
    requiredMajorCredits: document.getElementById('gr-major-req').value,
    requiredMajorElective: document.getElementById('gr-major-el').value,
    requiredGeneralCredits: document.getElementById('gr-gen-req').value,
    requiredGeneralElective: document.getElementById('gr-gen-el').value,
    requiresGraduationWork: document.getElementById('gr-grad-work').classList.contains('on'),
    requiredLanguageScore: document.getElementById('gr-lang').value.trim(),
    requiredCertifications: certs,
    requiredInternship: document.getElementById('gr-internship').value,
    requiredCapstonDesign: document.getElementById('gr-capstone').value,
    requiredNCProgram: document.getElementById('gr-nc').value,
    requiredVolunteer: document.getElementById('gr-volunteer').value,
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const res = await fetch('/staff/graduation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.ok) {
      showMsg('졸업요건이 저장되었습니다.', false);
    } else {
      showMsg(data.message || '저장에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 졸업요건 저장';
  }
}
