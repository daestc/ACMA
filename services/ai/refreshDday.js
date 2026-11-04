const { getRemainingDays } = require('../dateCalculateService');

// 진단·추천 결과의 부족 역량에는 "생성한 날 기준" D-Day(dDay)가 저장돼 있다. 며칠 뒤에 다시 열면
// 그 값이 이미 지난 숫자라서(실제로 9월에 만든 진단이 11월에도 "D-13"으로 보였다), 응답을 내보낼
// 때 저장된 nextExamDate로 오늘 기준 값을 다시 계산한다. 구조를 가리지 않고 nextExamDate와 dDay를
// 함께 가진 객체를 찾아 고치므로 진단(gaps)과 추천(후보별 gaps)에 같이 쓴다.
function refreshDdays(node) {
  if (Array.isArray(node)) {
    node.forEach(refreshDdays);
    return node;
  }
  if (!node || typeof node !== 'object') return node;
  if (node instanceof Date || node._bsontype || ArrayBuffer.isView(node)) return node;

  if (node.nextExamDate && 'dDay' in node) {
    node.dDay = getRemainingDays(node.nextExamDate);
  }
  Object.values(node).forEach(refreshDdays);
  return node;
}

module.exports = { refreshDdays };
