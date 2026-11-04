const { toKstDateString } = require('./kstDate');

// 학기 선택 목록 — 가장 최근에 시작한 학기부터 과거 순서. (예: 2026-11 → 2026-2, 2026-1, 2025-2, …)
// 3~8월은 1학기(여름방학 포함), 9월~다음 해 2월은 2학기(겨울방학 포함)로 본다.
// 예전에는 목록이 '2026-1'까지 하드코딩돼 있어서 2026-2학기부터는 현재 학기를 고를 수 없었다.
function buildSemesterOptions(now = new Date(), count = 8) {
  const [y, m] = toKstDateString(now).split('-').map(Number);

  let year = m <= 2 ? y - 1 : y;
  let term = m >= 3 && m <= 8 ? 1 : 2;

  const options = [];
  for (let i = 0; i < count; i += 1) {
    options.push({ value: `${year}-${term}`, label: `${year}-${term}학기` });
    if (term === 1) { year -= 1; term = 2; } else { term = 1; }
  }
  return options;
}

module.exports = { buildSemesterOptions };
