// AI 진로 추천 적합도 점수 계산 (순수 함수만, DB 접근 없음).
// 정규화 함수는 Phase5 계획서 §4-4에서 스텁으로 검증한 코드 그대로다.

const norm = v => String(v || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

// "정보처리기사·산업기사" → ["정보처리기사", "정보처리산업기사"]
const CERT_SERIES = /(기술사|기능장|산업기사|기사|기능사|\d급)$/;
function expandCert(raw) {
  const parts = String(raw).split('·').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  const m = parts[0].match(CERT_SERIES);
  const stem = m ? parts[0].slice(0, -m[0].length) : parts[0];
  return [parts[0], ...parts.slice(1).map(p => (p.replace(CERT_SERIES, '') === '' ? stem + p : p))];
}

module.exports = { norm, expandCert };
