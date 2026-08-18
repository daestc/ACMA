// portfolio.js/diagnosis.js/weeklyPlan.js 세 프롬프트가 공유하는 규칙 문구를 한 곳에
// 모아둔다. 각자 따로 적어두면 한쪽에 규칙을 추가할 때 다른 쪽엔 깜빡 빠뜨리는 사고가
// 반복된다 — 실제로 weeklyPlan.js에만 이 규칙이 없어서 "pendingRequirements에 포함된
// TOEIC 요건을"처럼 필드명이 그대로 출력 문장에 노출되는 사고가 있었다.
const NO_RAW_FIELD_NAMES =
  '입력 데이터의 필드명(pendingRequirements, targetJob, evidence, specs, availableHoursByDay 등)을 출력 문장에 그대로 쓰지 마라. 한국어로 풀어 쓴다.';

module.exports = { NO_RAW_FIELD_NAMES };
