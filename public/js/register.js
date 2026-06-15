/* ================================================
   AcadMe — register.js
   회원가입 클라이언트 유효성 검사
   ================================================ */

// ── 헬퍼 ─────────────────────────────────────────

function setMsg(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className   = 'field-msg ' + (isError ? 'field-error' : 'field-ok');
}

function clearMsg(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.className   = 'field-msg';
}

function setInputState(input, isError) {
  input.classList.toggle('input-error', isError);
  input.classList.toggle('input-ok',    !isError);
}

// ── 각 필드 검사 함수 ────────────────────────────

function validateName() {
  const input = document.getElementById('name');
  const val   = input.value.trim();
  if (!val) {
    setMsg('name-msg', '이름을 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  if (val.length < 2) {
    setMsg('name-msg', '이름은 2자 이상 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  setMsg('name-msg', '확인되었습니다.', false);
  setInputState(input, false);
  return true;
}

// 이메일 중복 확인 (debounce)
let emailTimer = null;
let emailValid = false;

function validateEmail() {
  const input = document.getElementById('email');
  const val   = input.value.trim();
  const regex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,7}$/;

  emailValid = false;

  if (!val) {
    setMsg('email-msg', '이메일을 입력해주세요.', true);
    setInputState(input, true);
    return;
  }
  if (!regex.test(val)) {
    setMsg('email-msg', '유효하지 않은 이메일 형식입니다.', true);
    setInputState(input, true);
    return;
  }

  setMsg('email-msg', '중복 확인 중...', false);

  clearTimeout(emailTimer);
  emailTimer = setTimeout(async () => {
    try {
      const res  = await fetch(`/auth/check-email?email=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.exists) {
        setMsg('email-msg', '이미 사용 중인 이메일입니다.', true);
        setInputState(input, true);
        emailValid = false;
      } else {
        setMsg('email-msg', '사용 가능한 이메일입니다.', false);
        setInputState(input, false);
        emailValid = true;
      }
    } catch {
      clearMsg('email-msg');
      emailValid = false;
    }
  }, 500);
}

function validateUniversity() {
  const input = document.getElementById('university');
  const val   = input.value.trim();
  if (!val || val.length < 2) {
    setMsg('university-msg', '대학교 이름을 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  setMsg('university-msg', '확인되었습니다.', false);
  setInputState(input, false);
  return true;
}

function validateMajor() {
  const input = document.getElementById('major');
  const val   = input.value.trim();
  if (!val || val.length < 2) {
    setMsg('major-msg', '전공을 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  setMsg('major-msg', '확인되었습니다.', false);
  setInputState(input, false);
  return true;
}

function validatePassword() {
  const input = document.getElementById('password');
  const val   = input.value;
  const hasLetter = /[a-zA-Z]/.test(val);
  const hasNumber = /[0-9]/.test(val);

  if (!val) {
    setMsg('password-msg', '비밀번호를 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  if (val.length < 8) {
    setMsg('password-msg', '비밀번호는 8자 이상이어야 합니다.', true);
    setInputState(input, true);
    return false;
  }
  if (!hasLetter || !hasNumber) {
    setMsg('password-msg', '영문과 숫자를 모두 포함해야 합니다.', true);
    setInputState(input, true);
    return false;
  }
  setMsg('password-msg', '사용 가능한 비밀번호입니다.', false);
  setInputState(input, false);
  // 비밀번호 확인 필드도 재검사
  const confirm = document.getElementById('passwordConfirm');
  if (confirm.value) validatePasswordConfirm();
  return true;
}

function validatePasswordConfirm() {
  const input   = document.getElementById('passwordConfirm');
  const pw      = document.getElementById('password').value;
  const val     = input.value;

  if (!val) {
    setMsg('passwordConfirm-msg', '비밀번호를 다시 입력해주세요.', true);
    setInputState(input, true);
    return false;
  }
  if (val !== pw) {
    setMsg('passwordConfirm-msg', '비밀번호가 일치하지 않습니다.', true);
    setInputState(input, true);
    return false;
  }
  setMsg('passwordConfirm-msg', '비밀번호가 일치합니다.', false);
  setInputState(input, false);
  return true;
}

// ── 이벤트 바인딩 ────────────────────────────────

document.getElementById('name').addEventListener('blur',   validateName);
document.getElementById('email').addEventListener('input',  validateEmail);
document.getElementById('university').addEventListener('blur', validateUniversity);
document.getElementById('major').addEventListener('blur',   validateMajor);
document.getElementById('password').addEventListener('input', validatePassword);
document.getElementById('passwordConfirm').addEventListener('input', validatePasswordConfirm);

// ── 폼 제출 최종 검사 ────────────────────────────

document.getElementById('registerForm').addEventListener('submit', function (e) {
  const okName       = validateName();
  const okUniversity = validateUniversity();
  const okMajor      = validateMajor();
  const okPassword   = validatePassword();
  const okConfirm    = validatePasswordConfirm();

  // 이메일은 비동기 검사이므로 emailValid 플래그로 판단
  if (!emailValid) {
    const emailInput = document.getElementById('email');
    if (!document.getElementById('email-msg').textContent) {
      setMsg('email-msg', '이메일 중복 확인이 필요합니다.', true);
    }
    setInputState(emailInput, true);
  }

  if (!okName || !emailValid || !okUniversity || !okMajor || !okPassword || !okConfirm) {
    e.preventDefault();
  }
});
