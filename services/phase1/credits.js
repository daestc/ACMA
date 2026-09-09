const academicSevice = require('../academicSevice');
const graduationService = require('../graduationService');

// academicSevice.calcRemainingCredits를 AI 컨텍스트 시그니처에 맞게 감싸는 어댑터.
// gpa/earnedTotal은 contextBuilder가 academic.gpa/earnedCredits로 바로 쓸 수 있도록
// 추가로 얹어준 필드(스펙의 5개 필드 위에 additive) — 중복 계산/중복 CreditSummary
// upsert를 피하기 위해 contextBuilder가 이 함수 하나만 호출하면 되도록 함.
async function calcRemainingCredits(userId) {
  const result = await academicSevice.calcRemainingCredits(userId);
  if (!result.available) {
    return { total: 0, majorRequired: 0, majorElective: 0, generalRequired: 0, generalElective: 0, gpa: null, earnedTotal: 0 };
  }

  const { total, majorRequired, majorElective, generalRequired, generalElective } = result.remaining;
  return { total, majorRequired, majorElective, generalRequired, generalElective, gpa: result.gpa, earnedTotal: result.earned.total };
}

// 대학 마스터 → 전공 추가요건 → 개인 override 병합 결과(GraduationRequirements 형태)만 노출
async function resolveRequirements(userId) {
  const result = await graduationService.resolveRequirements(userId);
  return result.available ? result.requirements : null;
}

module.exports = { calcRemainingCredits, resolveRequirements };
