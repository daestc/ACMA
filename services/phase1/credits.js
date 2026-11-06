const academicService = require('../academicService');
const graduationService = require('../graduationService');

// academicService.calcRemainingCredits를 AI 컨텍스트 시그니처에 맞게 감싸는 어댑터.
// gpa/earnedTotal은 contextBuilder가 academic.gpa/earnedCredits로 바로 쓸 수 있도록
// 추가로 얹어준 필드(스펙의 5개 필드 위에 additive) — 중복 계산/중복 CreditSummary
// upsert를 피하기 위해 contextBuilder가 이 함수 하나만 호출하면 되도록 함.
async function calcRemainingCredits(userId) {
  const result = await academicService.calcRemainingCredits(userId);
  if (!result.available) {
    return {
      total: 0, majorRequired: 0, majorElective: 0, generalRequired: 0, generalElective: 0, doubleMajor: null,
      gpa: null, earnedTotal: 0, earnedMajor: null, requiredMajor: null,
    };
  }

  // 전공 이수 학점 vs 졸업 기준 전공 학점(준비도 "전공 이수"용). 복수전공 모드면 두 전공을 합쳐 본다.
  // 단일전공의 취득은 전필+전선(내 현황의 영역별 이수 현황과 같은 값), 복수전공 모드의 트랙별 합도
  // 전공 과목 전체라 같은 값이다.
  const { earned, requirements: req } = result;
  const earnedMajor = result.doubleMajorMode
    ? earned.primaryMajor + earned.doubleMajor
    : earned.majorRequired + earned.majorElective;
  const requiredMajor = result.doubleMajorMode
    ? req.doubleMajorPrimaryCredits + req.doubleMajorCredits
    : req.requiredMajorCredits + req.requiredMajorElective;

  // doubleMajor는 복수전공 모드에서만 숫자, 단일전공이면 null(contextBuilder의 compact가 키를 지운다)
  const { total, majorRequired, majorElective, generalRequired, generalElective, doubleMajor } = result.remaining;
  return {
    total, majorRequired, majorElective, generalRequired, generalElective, doubleMajor,
    gpa: result.gpa, earnedTotal: result.earned.total,
    earnedMajor: Number.isFinite(requiredMajor) ? earnedMajor : null,
    requiredMajor: Number.isFinite(requiredMajor) ? requiredMajor : null,
  };
}

// 대학 요건(입학연도별) → 전공 추가요건 병합 결과(GraduationRequirements 형태)만 노출
async function resolveRequirements(userId) {
  const result = await graduationService.resolveRequirements(userId);
  return result.available ? result.requirements : null;
}

module.exports = { calcRemainingCredits, resolveRequirements };
