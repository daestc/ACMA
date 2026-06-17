const certPickerConfig = {
  school: {
    listId: 'gr-cert-list',
    inputId: 'gr-cert-input',
    resultsId: 'gr-cert-results',
  },
  major: {
    listId: 'mgr-cert-list',
    inputId: 'mgr-cert-input',
    resultsId: 'mgr-cert-results',
  },
};

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showMsg(text, isError, targetId = 'gr-msg') {
  const box = document.getElementById(targetId);
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

function getCertNames(pickerKey) {
  const { listId } = certPickerConfig[pickerKey];
  return Array.from(document.querySelectorAll(`#${listId} .gr-cert-chip`))
    .map((el) => el.dataset.certName?.trim())
    .filter(Boolean);
}

function renderCertChips(pickerKey, certifications = []) {
  const { listId } = certPickerConfig[pickerKey];
  const list = document.getElementById(listId);
  if (!list) return;

  const unique = [];
  const seen = new Set();
  certifications.forEach((cert) => {
    const name = String(cert || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    unique.push(name);
  });

  list.innerHTML = unique.map((cert) => `
    <div class="gr-cert-chip" data-cert-name="${escapeHtml(cert)}" style="display:flex;align-items:center;gap:4px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--accent);font-weight:600;">
      ${escapeHtml(cert)}
      <button type="button" class="gr-cert-remove" data-picker="${pickerKey}" style="border:none;background:transparent;cursor:pointer;margin-left:2px;opacity:.7;color:inherit;">✕</button>
    </div>
  `).join('');
}

function removeCertChip(pickerKey, certName) {
  const next = getCertNames(pickerKey).filter((name) => name !== certName);
  renderCertChips(pickerKey, next);
}

function addCertChip(pickerKey, certName) {
  const name = String(certName || '').trim();
  if (!name) return;
  if (getCertNames(pickerKey).includes(name)) return;
  renderCertChips(pickerKey, [...getCertNames(pickerKey), name]);
}

function hideCertResults(pickerKey) {
  const { resultsId } = certPickerConfig[pickerKey];
  const box = document.getElementById(resultsId);
  if (box) box.style.display = 'none';
}

function renderCertResults(pickerKey, items) {
  const { resultsId } = certPickerConfig[pickerKey];
  const box = document.getElementById(resultsId);
  if (!box) return;

  if (!items.length) {
    box.style.display = 'block';
    box.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text2);">검색 결과가 없습니다.</div>';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = items.map((item) => `
    <button type="button" class="staff-cert-result-item" data-cert-name="${escapeHtml(item.name)}">
      <div style="text-align:left;">
        <div style="font-size:13px;font-weight:700;">${escapeHtml(item.name)}</div>
        <div class="staff-cert-result-meta">${escapeHtml([item.field1, item.field2, item.seriesName].filter(Boolean).join(' · ') || '자격증 DB')}</div>
      </div>
      <span class="badge badge-blue">추가</span>
    </button>
  `).join('');

  box.querySelectorAll('.staff-cert-result-item').forEach((button) => {
    button.addEventListener('click', () => {
      selectPickerCert(pickerKey, button.dataset.certName);
    });
  });
}

async function searchPickerCerts(pickerKey) {
  const { inputId } = certPickerConfig[pickerKey];
  const keyword = document.getElementById(inputId)?.value?.trim() || '';

  if (!keyword) {
    showMsg('검색할 자격증명을 입력해주세요.', true, pickerKey === 'major' ? 'mgr-msg' : 'gr-msg');
    return;
  }

  try {
    const params = new URLSearchParams({ keyword });
    const res = await fetch(`/career/search-cert?${params.toString()}`);
    if (!res.ok) throw new Error('search failed');

    const items = await res.json();
    renderCertResults(pickerKey, Array.isArray(items) ? items.slice(0, 20) : []);
  } catch {
    showMsg('자격증 검색에 실패했습니다.', true, pickerKey === 'major' ? 'mgr-msg' : 'gr-msg');
  }
}

function selectPickerCert(pickerKey, certName) {
  addCertChip(pickerKey, certName);
  const { inputId } = certPickerConfig[pickerKey];
  const input = document.getElementById(inputId);
  if (input) input.value = '';
  hideCertResults(pickerKey);
}

function getSelectedMajor() {
  return document.getElementById('mgr-major-select')?.value?.trim() || '';
}

function setMajorBadge(major) {
  const badge = document.getElementById('mgr-major-badge');
  if (badge) badge.textContent = major || '학과 선택';
}

function applyCustomMajor() {
  const input = document.getElementById('mgr-major-input');
  const select = document.getElementById('mgr-major-select');
  const major = input?.value?.trim();
  if (!major) return;

  const exists = Array.from(select.options).some((option) => option.value === major);
  if (!exists) {
    const option = document.createElement('option');
    option.value = major;
    option.textContent = major;
    select.appendChild(option);
  }

  select.value = major;
  input.value = '';
  loadMajorRequirements();
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value == null ? '' : String(value);
}

function getSelectBool(id) {
  const value = document.getElementById(id)?.value;
  if (value === '') return null;
  return value === 'true';
}

function parseLanguageValue(languageValue) {
  const value = String(languageValue || '').trim();
  if (!value) return { type: '', score: '' };

  const knownTypes = ['TOEIC', 'TOEFL', 'IELTS', 'JLPT'];
  const knownType = knownTypes.find((type) => value.startsWith(type));
  if (!knownType) {
    return { type: '', score: value };
  }

  return {
    type: knownType,
    score: value.replace(knownType, '').trim(),
  };
}

function buildLanguageValue(type, score) {
  if (!type || type === '없음') return null;
  return `${type}${score ? ` ${score}` : ''}`.trim();
}

function resetMajorForm() {
  setSelectValue('mgr-grad-work', null);
  setSelectValue('mgr-capstone-design', null);
  document.getElementById('mgr-lang-type').value = '';
  document.getElementById('mgr-lang-score').value = '';
  document.getElementById('mgr-internship').value = '';
  document.getElementById('mgr-nc-program').value = '';
  document.getElementById('mgr-volunteer').value = '';
  renderCertChips('major', []);
  hideCertResults('major');
}

function applyMajorRequirements(requirements) {
  if (!requirements) {
    resetMajorForm();
    return;
  }

  setSelectValue('mgr-grad-work', requirements.requiresGraduationWork);
  setSelectValue('mgr-capstone-design', requirements.requiredCapstonDesign);

  const language = parseLanguageValue(requirements.requiredLanguageScore);
  document.getElementById('mgr-lang-type').value = language.type || (requirements.requiredLanguageScore ? '' : '');
  document.getElementById('mgr-lang-score').value = language.score || '';

  document.getElementById('mgr-internship').value = requirements.requiredInternship == null
    ? ''
    : String(requirements.requiredInternship);
  document.getElementById('mgr-nc-program').value = requirements.requiredNCProgram == null
    ? ''
    : String(requirements.requiredNCProgram);
  document.getElementById('mgr-volunteer').value = requirements.requiredVolunteer ?? '';
  renderCertChips('major', Array.isArray(requirements.requiredCertifications) ? requirements.requiredCertifications : []);
  hideCertResults('major');
}

async function loadMajorRequirements() {
  const major = getSelectedMajor();
  setMajorBadge(major);

  if (!major) {
    resetMajorForm();
    return;
  }

  try {
    const res = await fetch(`/staff/graduation/majors/${encodeURIComponent(major)}`);
    const data = await res.json();
    if (!data.ok) {
      showMsg(data.message || '학과별 요건을 불러오지 못했습니다.', true, 'mgr-msg');
      return;
    }

    applyMajorRequirements(data.additionalRequirements);
    document.getElementById('mgr-msg').style.display = 'none';
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true, 'mgr-msg');
  }
}

async function saveGraduation() {
  const btn = document.getElementById('gr-save-btn');
  const body = {
    requiredTotalCredits: document.getElementById('gr-total').value,
    requiredMajorCredits: document.getElementById('gr-major-req').value,
    requiredMajorElective: document.getElementById('gr-major-el').value,
    requiredGeneralCredits: document.getElementById('gr-gen-req').value,
    requiredGeneralElective: document.getElementById('gr-gen-el').value,
    requiresGraduationWork: document.getElementById('gr-grad-work').classList.contains('on'),
    requiredLanguageScore: document.getElementById('gr-lang').value.trim(),
    requiredCertifications: getCertNames('school'),
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
      showMsg('학교 기본 졸업요건이 저장되었습니다.', false);
    } else {
      showMsg(data.message || '저장에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 학교 기본값 저장';
  }
}

async function saveMajorGraduation() {
  const major = getSelectedMajor();
  if (!major) {
    showMsg('학과를 선택해주세요.', true, 'mgr-msg');
    return;
  }

  const btn = document.getElementById('mgr-save-btn');
  const body = {
    major,
    requiresGraduationWork: getSelectBool('mgr-grad-work'),
    requiredCapstonDesign: getSelectBool('mgr-capstone-design'),
    requiredLanguageScore: buildLanguageValue(
      document.getElementById('mgr-lang-type').value,
      document.getElementById('mgr-lang-score').value.trim(),
    ),
    requiredCertifications: getCertNames('major'),
    requiredInternship: document.getElementById('mgr-internship').value,
    requiredNCProgram: document.getElementById('mgr-nc-program').value,
    requiredVolunteer: document.getElementById('mgr-volunteer').value,
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const res = await fetch('/staff/graduation/majors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.ok) {
      showMsg(`${major} 학과별 추가 이수 요건이 저장되었습니다.`, false, 'mgr-msg');
    } else {
      showMsg(data.message || '저장에 실패했습니다.', true, 'mgr-msg');
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true, 'mgr-msg');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 학과별 요건 저장';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderCertChips('school', window.initialSchoolCerts || []);

  document.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.gr-cert-remove');
    if (!removeBtn) return;
    const chip = removeBtn.closest('.gr-cert-chip');
    removeCertChip(removeBtn.dataset.picker, chip?.dataset.certName);
  });
});
