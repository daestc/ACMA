// getCurrentPosition은 콜백 방식 API라 await를 쓰려면 Promise 래퍼가 한 번 필요함
function getPosition(options) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
}

// 현재 위치의 위경도 반환. 실패(권한 거부, 미지원, 타임아웃) 시 null 반환
async function getCurrentCoords() {
  if (!navigator.geolocation) return null;

  try {
    const pos = await getPosition({
      timeout: 5000,
      maximumAge: 1000 * 60 * 30, // 30분 내 캐시된 위치 허용
    });

    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    };
  } catch {
    return null;
  }
}

// 위경도로 도시 이름 가져오기
async function getCityName(lat, lon) {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=ko`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    // principalSubdivision: 시/도
    const parts = [data.principalSubdivision, data.locality]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i); // 중복 제거

    return parts.length > 0 ? parts.join(' ') : null;
  } catch {
    return null;
  }
}
