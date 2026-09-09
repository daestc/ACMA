// 스펙 추가 모달 공통 엔진
const TEST_OPTIONS = {
  english:  ['TOEIC', 'TOEFL', 'IELTS', 'OPIc', 'TEPS'],
  japanese: ['JLPT', 'JPT'],
  chinese:  ['HSK', 'TSC'],
  other:    ['기타'],
};
function createSpecModal(config) {
  const modal = document.getElementById(config.modalId);
  const closeBtn = modal.querySelector('[data-modal-close]');
  const cancelBtn = modal.querySelector('[data-modal-cancel]');
  const submitBtn = modal.querySelector('[data-modal-submit]');
  const deleteBtn = modal.querySelector('[data-modal-delete]'); // 추가 (없으면 null)
  const errorBox = modal.querySelector('[data-modal-error]');
  const titleEl = modal.querySelector('[data-modal-title]');     // 제목 바꿔주려고

  const inputs = config.fields.map(f => ({ ...f, el: document.getElementById(f.id) }));

  let editingId = null; // null이면 추가, 값 있으면 수정

  function fillForm(data) {
    inputs.forEach(f => {
      let v = data ? (data[f.key] ?? '') : '';
      // 날짜는 input[type=date]가 yyyy-MM-dd만 받음
      if (v && f.el.type === 'date') v = new Date(v).toISOString().slice(0, 10);
      f.el.value = v;
    });
  }

  function openForAdd() {
    editingId = null;
    errorBox.hidden = true;
    fillForm(null);
    if (titleEl) titleEl.textContent = config.addTitle || '추가';
    if (deleteBtn) deleteBtn.hidden = true; // 추가 땐 삭제 버튼 숨김
    modal.hidden = false;
    inputs[0]?.el.focus();
  }

  function openForEdit(data) {
    editingId = data._id;
    errorBox.hidden = true;
    fillForm(data);
    if (titleEl) titleEl.textContent = config.editTitle || '수정';
    if (deleteBtn) deleteBtn.hidden = false; // 수정 땐 삭제 버튼 노출
    // language 모달이면 시험 옵션도 채워야 함 (아래 §4 참고)
    config.afterFill?.(data);
    modal.hidden = false;
  }

  function close() { modal.hidden = true; editingId = null; }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#' + config.openBtnId)) openForAdd();
  });
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

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

    const isEdit = !!editingId;
    const url = isEdit ? `${config.endpoint}/${editingId}` : config.endpoint;
    const method = isEdit ? 'PUT' : 'POST';

    submitBtn.disabled = true;
    try {
      const res = await fetch(url, {
        method,
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

  async function remove() {
    if (!editingId) return;
    if (!confirm('정말 삭제하시겠어요?')) return;
    try {
      const res = await fetch(`${config.endpoint}/${editingId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('삭제에 실패했습니다.');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '삭제에 실패했습니다.');
      close();
      location.reload();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  }

  submitBtn.addEventListener('click', submit);
  deleteBtn?.addEventListener('click', remove);

  return { openForAdd, openForEdit };
}
// 3개 모달 설정 — 스키마 필드에 맞춤
function initSpecModals() {
  const modals = {};

  if (document.getElementById('award-modal')) {
    modals.award = createSpecModal({
      modalId: 'award-modal', openBtnId: 'award-open-btn', endpoint: '/spec/award',
      addTitle: '수상경력 추가', editTitle: '수상경력 수정',
      fields: [
        { id: 'award-name', key: 'name', label: '수상명', required: true },
        { id: 'award-organizer', key: 'organizer', label: '주최 기관' },
        { id: 'award-rank', key: 'rank', label: '수상 등급' },
        { id: 'award-acquired-date', key: 'acquiredDate', label: '취득일' },
      ],
    });
  }

  if (document.getElementById('language-modal')) {
    modals.language = createSpecModal({
      modalId: 'language-modal', openBtnId: 'language-open-btn', endpoint: '/spec/language',
      addTitle: '어학성적 추가', editTitle: '어학성적 수정',
      fields: [
        { id: 'language-lang', key: 'language', label: '언어', required: true },
        { id: 'language-test', key: 'testName', label: '시험 종류' },
        { id: 'language-score', key: 'score', label: '점수/등급', required: true },
        { id: 'language-acquired', key: 'acquiredDate', label: '취득일' },
        { id: 'language-expiry', key: 'expiryDate', label: '만료일' },
      ],
      // 수정으로 열 때 언어에 맞는 시험 옵션을 먼저 채운 뒤 값 선택
      afterFill: (data) => {
        const langSel = document.getElementById('language-lang');
        const testSel = document.getElementById('language-test');
        const opts = TEST_OPTIONS[data.language] || [];
        testSel.innerHTML = '<option value="" disabled>시험 선택</option>'
          + opts.map(t => `<option value="${t}">${t}</option>`).join('');
        testSel.value = data.testName || '';
      },
    });

    // ← 이게 빠져있음: 추가 모드에서 언어 선택 시 시험 목록 갱신
  const langSel = document.getElementById('language-lang');
  const testSel = document.getElementById('language-test');
  if (langSel && testSel) {
    langSel.addEventListener('change', () => {
      const opts = TEST_OPTIONS[langSel.value] || [];
      testSel.innerHTML = '<option value="" disabled selected>시험 선택</option>'
        + opts.map(t => `<option value="${t}">${t}</option>`).join('');
    });
  }
  }

  if (document.getElementById('experience-modal')) {
    modals.experience = createSpecModal({
      modalId: 'experience-modal', openBtnId: 'experience-open-btn', endpoint: '/spec/experience',
      addTitle: '경험/활동 추가', editTitle: '경험/활동 수정',
      fields: [
        { id: 'experience-title', key: 'title', label: '활동명', required: true },
        { id: 'experience-host', key: 'host', label: '주최 기관' },
        { id: 'experience-location', key: 'location', label: '장소' },
        { id: 'experience-start', key: 'startDate', label: '시작일' },
        { id: 'experience-end', key: 'endDate', label: '종료일' },
        { id: 'experience-note', key: 'note', label: '활동 설명' },
      ],
    });
  }

  if (document.getElementById('skill-modal')) {
    modals.skill = createSpecModal({
      modalId: 'skill-modal', openBtnId: 'skill-open-btn', endpoint: '/spec/skill',
      addTitle: '스킬 추가', editTitle: '스킬 수정',
      fields: [
        { id: 'skill-name', key: 'name', label: '스킬명', required: true },
        { id: 'skill-level', key: 'level', label: '숙련도', required: true },
      ],
    });
  }

  window._specModals = modals; // 항목 클릭 핸들러에서 사용
}