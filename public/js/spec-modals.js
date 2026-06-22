// 스펙 추가 모달 공통 엔진
function createSpecModal(config) {
  const modal = document.getElementById(config.modalId);
  const openBtn = document.getElementById(config.openBtnId);
  const closeBtn = modal.querySelector('[data-modal-close]');
  const cancelBtn = modal.querySelector('[data-modal-cancel]');
  const submitBtn = modal.querySelector('[data-modal-submit]');
  const errorBox = modal.querySelector('[data-modal-error]');

  // config.fields: [{ id, key, required, transform? }]
  const inputs = config.fields.map(f => ({
    ...f,
    el: document.getElementById(f.id),
  }));

  function open() {
    errorBox.hidden = true;
    inputs.forEach(f => (f.el.value = ''));
    modal.hidden = false;
    inputs[0]?.el.focus();
  }
  function close() { modal.hidden = true; }

   document.addEventListener('click', (e) => {
    if (e.target.closest('#' + config.openBtnId)) open();
  });
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  async function submit() {
    const payload = {};
    for (const f of inputs) {
      const raw = f.el.value.trim();
      if (f.required && !raw) {
        errorBox.textContent = `${f.label}은(는) 필수입니다.`;
        errorBox.hidden = false;
        f.el.focus();
        return;
      }
      payload[f.key] = raw || null;
    }

    submitBtn.disabled = true;
    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('저장에 실패했습니다.');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '저장에 실패했습니다.');
      close();
      location.reload();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  submitBtn.addEventListener('click', submit);
  return { open, close };
}

// 3개 모달 설정 — 스키마 필드에 맞춤
function initSpecModals() {
  // 수상경력 (userAward)
  if (document.getElementById('award-modal')) {
    createSpecModal({
      modalId: 'award-modal',
      openBtnId: 'award-open-btn',
      endpoint: '/spec/award',
      fields: [
        { id: 'award-name',          key: 'name',         label: '수상명', required: true },
        { id: 'award-organizer',     key: 'organizer',    label: '주최 기관' },
        { id: 'award-rank',          key: 'rank',         label: '수상 등급' },
        { id: 'award-acquired-date', key: 'acquiredDate', label: '취득일' },
      ],
    });
  }

  // 어학성적 (userLanguage)
  if (document.getElementById('language-modal')) {
    createSpecModal({
      modalId: 'language-modal',
      openBtnId: 'language-open-btn',
      endpoint: '/spec/language',
      fields: [
        { id: 'language-lang',     key: 'language',     label: '언어', required: true },
        { id: 'language-test',     key: 'testName',     label: '시험 종류' },   // ← 추가
        { id: 'language-score',    key: 'score',        label: '점수/등급', required: true },
        { id: 'language-acquired', key: 'acquiredDate', label: '취득일' },
        { id: 'language-expiry',   key: 'expiryDate',   label: '만료일' },
      ],
    });
  }
  // initSpecModals 안, 어학 모달 블록에 이어서
  const TEST_OPTIONS = {
    english:  ['TOEIC', 'TOEFL', 'IELTS', 'OPIc', 'TEPS'],
    japanese: ['JLPT', 'JPT'],
    chinese:  ['HSK', 'TSC'],
    other:    ['기타'],
  };
  const langSel = document.getElementById('language-lang');
  const testSel = document.getElementById('language-test');
  if (langSel && testSel) {
    langSel.addEventListener('change', () => {
      const opts = TEST_OPTIONS[langSel.value] || [];
      testSel.innerHTML = '<option value="" disabled selected>시험 선택</option>'
        + opts.map(t => `<option value="${t}">${t}</option>`).join('');
    });
  }

  // 경험/활동/교육 (userExperience)
  if (document.getElementById('experience-modal')) {
    createSpecModal({
      modalId: 'experience-modal',
      openBtnId: 'experience-open-btn',
      endpoint: '/spec/experience',
      fields: [
        { id: 'experience-title',     key: 'title',     label: '활동명', required: true },
        { id: 'experience-host',      key: 'host',      label: '주최 기관' },
        { id: 'experience-location',  key: 'location',  label: '장소' },
        { id: 'experience-start',     key: 'startDate', label: '시작일' },
        { id: 'experience-end',       key: 'endDate',   label: '종료일' },
        { id: 'experience-note',      key: 'note',      label: '활동 설명' },
      ],
    });
  }
}

window.initSpecModals = initSpecModals;