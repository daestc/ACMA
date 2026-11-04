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
    doubleMajorPrimaryCredits: document.getElementById('gr-dm-primary').value,
    doubleMajorCredits: document.getElementById('gr-dm-credits').value,
    fromYear: graduationYear === '' ? null : Number(graduationYear),
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const res = await fetch('/staff/graduation/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.ok) {
      if (data.fromYear == null) {
        showMsg('학교 기본 졸업요건이 저장되었습니다.', false);
      } else {
        if (!graduationYears.includes(data.fromYear)) graduationYears = [...graduationYears, data.fromYear].sort((a, b) => a - b);
        graduationYearIsNew = false;
        showMsg(`${data.fromYear}학번부터 적용되는 졸업요건이 저장되었습니다.`, false);
      }
      updateYearUi();
    } else {
      showMsg(data.message || '저장에 실패했습니다.', true);
    }
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  } finally {
    btn.disabled = false;
    updateYearUi();
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

// ── 적용 학번(입학년도)별 졸업요건 ─────────────────────────────────
// ''(빈 문자열)은 학교 기본값(학번 구분 없음). 학번을 고르면 그 학번부터 적용되는 요건 전체를 따로 저장한다.
let graduationYear = '';
let graduationYearIsNew = false;
let graduationYears = [];

function renderYearOptions() {
  const select = document.getElementById('gr-year');
  if (!select) return;
  const years = [...new Set([...graduationYears, ...(graduationYear !== '' ? [Number(graduationYear)] : [])])].sort((a, b) => a - b);
  select.innerHTML = '<option value="">학교 기본값 (학번 구분 없음)</option>' + years.map((y) => {
    const unsaved = !graduationYears.includes(y);
    return `<option value="${y}">${y}학번부터${unsaved ? ' (새 학번, 저장 전)' : ''}</option>`;
  }).join('');
  select.value = graduationYear;
}

function updateYearUi() {
  const badge = document.getElementById('gr-year-badge');
  if (badge) badge.textContent = graduationYear === '' ? '학교 기본값' : `${graduationYear}학번부터`;
  const del = document.getElementById('gr-year-del');
  if (del) del.style.display = graduationYear !== '' && !graduationYearIsNew ? 'inline-flex' : 'none';
  const btn = document.getElementById('gr-save-btn');
  if (btn) btn.textContent = graduationYear === '' ? '💾 학교 기본값 저장' : '💾 이 학번 요건 저장';
  renderYearOptions();
}

function applyRequirementsToForm(r = {}) {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('gr-total', r.requiredTotalCredits ?? 130);
  set('gr-major-req', r.requiredMajorCredits ?? 42);
  set('gr-major-el', r.requiredMajorElective ?? 40);
  set('gr-gen-req', r.requiredGeneralCredits ?? 20);
  set('gr-gen-el', r.requiredGeneralElective ?? 28);
  set('gr-volunteer', r.requiredVolunteer);
  set('gr-dm-primary', r.doubleMajorPrimaryCredits);
  set('gr-dm-credits', r.doubleMajorCredits);
  set('gr-lang', r.requiredLanguageScore);
  setSelectValue('gr-internship', r.requiredInternship);
  setSelectValue('gr-capstone', r.requiredCapstonDesign);
  setSelectValue('gr-nc', r.requiredNCProgram);
  document.getElementById('gr-grad-work')?.classList.toggle('on', r.requiresGraduationWork !== false);
  renderCertChips('school', Array.isArray(r.requiredCertifications) ? r.requiredCertifications : []);
  hideCertResults('school');
}

async function loadGraduationYear(year) {
  const query = year === '' ? '' : `?fromYear=${encodeURIComponent(year)}`;
  try {
    const res = await fetch(`/staff/graduation/data${query}`);
    const data = await res.json();
    if (!data.ok) {
      showMsg(data.message || '요건을 불러오지 못했습니다.', true);
      renderYearOptions();
      return;
    }
    graduationYears = data.years || [];
    graduationYear = data.fromYear == null ? '' : String(data.fromYear);
    graduationYearIsNew = Boolean(data.isNew);
    applyRequirementsToForm(data.requirements || {});
    updateYearUi();
    document.getElementById('gr-msg').style.display = 'none';
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  }
}

function changeGraduationYear(value) {
  loadGraduationYear(value);
}

function addGraduationYear() {
  const input = document.getElementById('gr-year-new');
  const year = Number(input.value);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    showMsg('적용 학번은 1990~2100 사이 연도로 입력해주세요.', true);
    return;
  }
  input.value = '';
  loadGraduationYear(String(year));
}

async function deleteGraduationYear() {
  if (graduationYear === '' || graduationYearIsNew) return;
  if (!window.confirm(`${graduationYear}학번부터 적용되는 요건을 삭제할까요? 해당 학번 학생에게는 바로 앞 학번 요건이나 기본 요건이 적용됩니다.`)) return;
  try {
    const res = await fetch('/staff/graduation/years/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromYear: Number(graduationYear) }),
    });
    const data = await res.json();
    if (!data.ok) {
      showMsg(data.message || '삭제에 실패했습니다.', true);
      return;
    }
    await loadGraduationYear('');
    showMsg(`${data.fromYear}학번 요건을 삭제했습니다.`, false);
  } catch {
    showMsg('서버와 통신할 수 없습니다.', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderCertChips('school', window.initialSchoolCerts || []);
  graduationYears = window.initialYears || [];
  updateYearUi();

  document.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.gr-cert-remove');
    if (!removeBtn) return;
    const chip = removeBtn.closest('.gr-cert-chip');
    removeCertChip(removeBtn.dataset.picker, chip?.dataset.certName);
  });
});
