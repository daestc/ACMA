// React 개발 서버(5173)의 요청이 Express(3000)의 CSRF 검증을 통과하게 한다.
// EJS 화면은 views/partials/head.ejs가 fetch에 X-CSRF-Token을 붙이는데, React는 그 메타 태그가 없어서
// 저장·생성 같은 POST가 전부 403이었다. 같은 방식으로 window.fetch를 한 번 감싼다.
// 토큰은 같은 출처에서만 읽을 수 있다(서버에 CORS 설정 없음).

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const TOKEN_URL = '/auth/csrf-token'
const CSRF_REJECTION = '요청이 유효하지 않습니다' // middleware/csrf.js의 거부 메시지

const nativeFetch = window.fetch.bind(window)
let tokenPromise = null

function loadToken(force = false) {
  if (!tokenPromise || force) {
    tokenPromise = nativeFetch(TOKEN_URL, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body?.csrfToken ?? null)
      .catch(() => null)
      .then((token) => {
        if (!token) tokenPromise = null // 실패는 저장하지 않는다(다음 요청에서 다시 시도)
        return token
      })
  }
  return tokenPromise
}

function describe(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  return { url, method }
}

async function isCsrfRejection(res) {
  if (res.status !== 403) return false
  try {
    return (await res.clone().text()).includes(CSRF_REJECTION)
  } catch {
    return false
  }
}

async function csrfFetch(input, init = {}) {
  const { url, method } = describe(input, init)
  const sameOrigin = new URL(url, window.location.href).origin === window.location.origin
  if (SAFE_METHODS.has(method) || !sameOrigin) return nativeFetch(input, init)

  const send = (token) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    if (token && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', token)
    return nativeFetch(input, { ...init, headers })
  }

  const usedToken = await loadToken()
  const res = await send(usedToken)

  // 로그인·로그아웃으로 세션이 바뀌면 캐시한 토큰이 거부된다 → 새 토큰으로 한 번만 다시 보낸다.
  // 본문을 다시 쓸 수 있는 요청(문자열 URL)만 재시도한다.
  const replayable = typeof input === 'string' || input instanceof URL
  if (replayable && await isCsrfRejection(res)) {
    const fresh = await loadToken(true)
    if (fresh && fresh !== usedToken) return send(fresh)
  }
  return res
}

window.fetch = csrfFetch
