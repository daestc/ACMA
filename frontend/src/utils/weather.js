export const WEATHER_CACHE_KEY = 'acme_weather_v1'
export const WEATHER_CACHE_TTL = 30 * 60 * 1000 // 30분

function getPosition(options) {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options))
}

// 현재 위치의 위경도 반환. 실패(권한 거부, 미지원, 타임아웃) 시 null 반환
export async function getCurrentCoords() {
  if (!navigator.geolocation) return null
  try {
    const pos = await getPosition({ timeout: 5000, maximumAge: 1000 * 60 * 30 })
    return { lat: pos.coords.latitude, lon: pos.coords.longitude }
  } catch {
    return null
  }
}

// 위경도로 도시 이름 가져오기 
export async function getCityName(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const parts = [data.principalSubdivision, data.locality].filter(Boolean)
    return [...new Set(parts)].join(' ') || null
  } catch {
    return null
  }
}

export function formatDateYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function fetchWeatherList() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.ts < WEATHER_CACHE_TTL) return cached.data
    }
  } catch {
    /* localStorage 접근 실패는 무시하고 새로 요청 */
  }

  const coords = await getCurrentCoords()
  const query = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''

  const res = await fetch(`/calendar/weather${query}`)
  if (!res.ok) throw new Error('날씨 API 요청 실패')
  const data = await res.json()

  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    /* 저장 실패는 무시 */
  }

  return data
}
