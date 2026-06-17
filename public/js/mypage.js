// 마이페이지 회원 정보 수정, 비밀번호 변경, 회원 탈퇴 등과 관련된 스크립트
/* ================================================
   AcadMe — mypage.js
   마이페이지 모달 전용:
   페이지 네비게이션 / 비밀번호 변경 / 회원 탈퇴
   ================================================ */

// ============ 1. 페이지 네비게이션 / 헤더 ============

// 페이지 타이틀 매핑
const pageTitles = {
  home: '홈', calendar: '캘린더', mystatus: 'MyStatus',
  notice: '공지사항', academic: '학사관리', study: '공부', career: '진로정보'
};

// 페이지별 헤더 액션 버튼
const pageActions = {
  mystatus: `<button class="btn btn-accent btn-sm" onclick="openMyPageModal()">✏️ 정보 수정</button>`,
  calendar: `<div class="tabs" style="margin-bottom:0;"><button class="tab-btn active" id="cal-tab-month" onclick="switchCalView('month')">월간</button><button class="tab-btn" id="cal-tab-week" onclick="switchCalView('week')">주간</button></div>`,
};

function showPage(id) {
  document.querySelectorAll('.auth-page,.page,.landing-page').forEach(p => p.classList.remove('active'));
  document.getElementById('app-layout').style.display = 'none';
  const el = document.getElementById('page-' + id);
  if (el) el.classList.add('active');
}

function goToApp() {
  document.querySelectorAll('.auth-page,.landing-page').forEach(p => p.classList.remove('active'));
  document.getElementById('app-layout').style.display = 'flex';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('pg-home').classList.add('active');
  updateGlobalHeader('home');
  const mc = document.querySelector('.main-content');
  if (mc) mc.scrollTop = 0;
}

function logout() {
  closeMyPageModal();
  closeSidebar();
  document.getElementById('app-layout').style.display = 'none';
  document.querySelectorAll('.auth-page,.page,.landing-page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-landing').classList.add('active');
}

async function serverLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch (_) {}
  window.location.href = '/auth/login';
}

function updateGlobalHeader(pageId) {
  const titleEl = document.getElementById('gh-title');
  if (titleEl) titleEl.textContent = pageTitles[pageId] || '';
  const actionsEl = document.getElementById('gh-actions');
  if (actionsEl) actionsEl.innerHTML = pageActions[pageId] || '';
}

// 페이지 이동 (URL 방식)
function switchPage(page, params) {
  console.log('이동 시도:', page);
  window.location.href = '/' + page;
}


// ============ 2. 비밀번호 변경 모달 ============

const _eyeOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const _eyeOff  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function togglePw(id, btn) {
  const el = document.getElementById(id);
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.innerHTML = show ? _eyeOff : _eyeOpen;
}

const cpwState = { current: false, newPw: false, confirm: false };

function _cpwMsg(id, msg, ok) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.color = ok ? '#22c55e' : 'var(--red)';
  el.style.display = msg ? 'block' : 'none';
}

const cpwCheck = {
  current() {
    const val = document.getElementById('current-pw').value;
    const ok = val.length > 0;
    cpwState.current = ok;
    _cpwMsg('msg-current-pw', ok ? '' : '현재 비밀번호를 입력해주세요.', false);
  },
  newPw() {
    const val = document.getElementById('new-pw').value;
    const ok = /[a-zA-Z]/.test(val) && /[0-9]/.test(val) && val.length >= 8;
    cpwState.newPw = ok;
    _cpwMsg('msg-new-pw',
      val.length === 0 ? '' : ok ? '사용 가능한 비밀번호입니다.' : '영문+숫자 포함 8자 이상이어야 합니다.',
      ok);
    this.confirm();
  },
  confirm() {
    const newVal = document.getElementById('new-pw').value;
    const confirmVal = document.getElementById('new-pw-confirm').value;
    if (!confirmVal) { _cpwMsg('msg-new-pw-confirm', '', false); cpwState.confirm = false; return; }
    const ok = newVal === confirmVal;
    cpwState.confirm = ok;
    _cpwMsg('msg-new-pw-confirm', ok ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.', ok);
  },
};

async function openChangePwModal() {
  let provider = 'local';
  try {
    const r = await fetch('/auth/me');
    if (r.ok) ({ provider } = await r.json());
  } catch (_) {}

  if (provider !== 'local') {
    alert('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.');
    return;
  }

  ['current-pw', 'new-pw', 'new-pw-confirm'].forEach(id => document.getElementById(id).value = '');
  ['msg-current-pw', 'msg-new-pw', 'msg-new-pw-confirm'].forEach(id => document.getElementById(id).style.display = 'none');
  Object.keys(cpwState).forEach(k => cpwState[k] = false);
  document.getElementById('changepw-error').style.display = 'none';
  document.getElementById('changepw-success').style.display = 'none';
  document.getElementById('changepw-overlay').style.display = 'flex';
}

function closeChangePwModal() {
  document.getElementById('changepw-overlay').style.display = 'none';
}

async function submitChangePw() {
  const currentPassword = document.getElementById('current-pw').value;
  const newPassword = document.getElementById('new-pw').value;
  const errEl = document.getElementById('changepw-error');
  const okEl = document.getElementById('changepw-success');

  errEl.style.display = okEl.style.display = 'none';

  cpwCheck.current(); cpwCheck.newPw(); cpwCheck.confirm();
  if (!cpwState.current || !cpwState.newPw || !cpwState.confirm) return;

  try {
    const res = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.message;
      errEl.style.display = 'block';
      return;
    }
    okEl.textContent = data.message;
    okEl.style.display = 'block';
    setTimeout(closeChangePwModal, 1500);
  } catch (_) {
    errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    errEl.style.display = 'block';
  }
}


// ============ 3. 회원 탈퇴 모달 ============

async function openWithdrawModal() {
  let provider = 'local';
  try {
    const r = await fetch('/auth/me');
    if (r.ok) ({ provider } = await r.json());
  } catch (_) {}

  document.getElementById('withdraw-pw-wrap').style.display     = provider === 'local' ? 'block' : 'none';
  document.getElementById('withdraw-social-wrap').style.display = provider !== 'local' ? 'block' : 'none';
  document.getElementById('withdraw-pw').value = '';
  document.getElementById('withdraw-error').style.display = 'none';

  document.getElementById('withdraw-overlay').style.display = 'flex';
}

function closeWithdrawModal() {
  document.getElementById('withdraw-overlay').style.display = 'none';
}

async function submitWithdraw() {
  const pw = document.getElementById('withdraw-pw').value;
  const errEl = document.getElementById('withdraw-error');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/auth/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });

    const data = await res.json();
    if (!data.ok) {
      errEl.textContent = data.message;
      errEl.style.display = 'block';
      return;
    }

    window.location.href = '/auth/login';
  } catch (_) {
    errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    errEl.style.display = 'block';
  }
}
 
// 회원 정보 수정 폼 제출
async function saveProfile() {
  const studentId = document.getElementById('studentId').value;
  const university = document.getElementById('university').value;
  const major = document.getElementById('major').value;
  const enrollmentStatus = document.getElementById('enrollmentStatus').value;
  console.log('프로필 저장 시도:', { studentId, university, major, enrollmentStatus });

  try {
    const response = await fetch('/user/updateProfile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, university, major, enrollmentStatus })
    });
    const result = await response.json();
    if (result.success) {
      if (result.universityChanged && result.clearedLectureCount > 0) {
        alert(`프로필이 업데이트되었습니다.\n대학 변경으로 시간표 강의 ${result.clearedLectureCount}개가 삭제되었습니다.`);
      } else if (result.universityChanged) {
        alert('프로필이 업데이트되었습니다.\n대학 정보가 변경되어 기존 강의 시간표가 초기화되었습니다.');
      } else {
        alert('프로필이 성공적으로 업데이트되었습니다.');
      }
      fetchUserProfile();
    } else {
      alert('프로필 업데이트에 실패했습니다. 다시 시도해주세요.');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('프로필 업데이트 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
};
// 페이지 로드 시 사용자 프로필 정보 가져오기
async function fetchUserProfile() {
  try {
    const response = await fetch('/user/profile');
    if (!response.ok) throw new Error('프로필 정보를 가져오는데 실패했습니다.');
    const data = await response.json();
    const user = data.user;
    if (!user) throw new Error('사용자 정보가 없습니다.');

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      const editBtn = avatarEl.querySelector('.avatar-edit');
      avatarEl.textContent = user.name ? user.name.charAt(0) : '';
      if (editBtn) avatarEl.appendChild(editBtn);
    }

    document.getElementById('profile-name').textContent = `${user.name || ''}`;

    if (user.role === 'staff') {
      document.getElementById('profile-meta').textContent = `${user.email || ''} · 대학관계자`;
      const staffUniversity = document.getElementById('staff-university');
      if (staffUniversity) staffUniversity.value = user.university || '등록된 소속 대학 없음';
      return;
    }

    document.getElementById('profile-meta').textContent =
      `${user.university || ''} · ${user.major || ''} · ${user.studentId || ''}`;

    const studentIdEl = document.getElementById('studentId');
    if (!studentIdEl) return;

    studentIdEl.value = user.studentId || '';
    document.getElementById('university').value = user.university || '';
    document.getElementById('major').value = user.major || '';
    document.getElementById('enrollmentStatus').value = user.enrollmentStatus || '';
  } catch (error) {
    console.error('Error fetching profile:', error);
    alert('프로필 정보를 가져오는데 실패했습니다. 다시 시도해주세요.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchUserProfile();
});