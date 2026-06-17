/* 
   AcadMe — weather.js
   날씨 API(기상청 단기예보) 공용 모듈
   사용 페이지: home.ejs(날씨 위젯), calendar.ejs(달력 날씨 아이콘)
*/

// 마지막 조회에 사용한 좌표 (홈 위젯 위치 표기용, null이면 기본 좌표 사용)
let lastCoords = null;

// 일별 날씨 배열 [{ date:'YYYY-MM-DD', time, temp, sky, pty, icon, description }] 반환
// 현재 위치(location.js)를 구해 위경도를 쿼리로 전달, 실패 시 서버 기본 좌표(서울) 사용
async function fetchWeatherList() {
  const coords = await getCurrentCoords();
  lastCoords = coords;
  const query = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : '';

  const response = await fetch(`/calendar/weather${query}`);
  if (!response.ok) throw new Error('날씨 API 요청 실패');
  return await response.json();
}

// Date -> 'YYYY-MM-DD' (날씨 API의 date 형식과 동일)
function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 홈 날씨 위젯 렌더링 
async function loadHomeWeather() {
  try {
    const weatherList = await fetchWeatherList();

    const todayStr    = formatDateYMD(new Date());
    const tomorrowStr = formatDateYMD(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const today    = weatherList.find(w => w.date === todayStr) || weatherList[0];
    const tomorrow = weatherList.find(w => w.date === tomorrowStr);

    if (!today) throw new Error('오늘 날씨 데이터 없음');

    document.getElementById('weather-temp').textContent = `${today.temp ?? '--'}°C`;
    document.getElementById('weather-desc').textContent = today.description;
    document.getElementById('weather-icon').textContent = today.icon;
    updateLocationLabel();

    // 예보 기준 시각 (예: "1200" → "12시 예보 기준")
    if (today.time) {
      document.getElementById('weather-base').textContent =
        `${today.time.slice(0, 2)}시 예보 기준`;
    }

    if (tomorrow) {
      document.getElementById('weather-tomorrow').textContent =
        `내일 ${tomorrow.icon} ${tomorrow.temp ?? '--'}°`;
    }
  } catch (err) {
    console.error('날씨 로드 실패:', err);
    document.getElementById('weather-desc').textContent = '날씨 정보를 불러올 수 없습니다';
  }
}

// 위치 표기: 현재 위치면 도시 이름(역지오코딩), 아니면 기본 좌표 안내
async function updateLocationLabel() {
  const el = document.getElementById('weather-location');

  if (!lastCoords) {
    el.textContent = '📍 서울특별시 (기본)';
    return;
  }

  el.textContent = '📍 현재 위치';

  const cityName = await getCityName(lastCoords.lat, lastCoords.lon); // location.js
  if (cityName) el.textContent = `📍 ${cityName}`;
}

// 홈 날씨 위젯이 있는 페이지에서만 자동 실행
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('weather-temp')) loadHomeWeather();
});
