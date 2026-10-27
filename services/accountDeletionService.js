// 계정 삭제(본인 탈퇴·관계자의 학생 삭제·관리자의 계정 삭제)가 공통으로 쓰는 사용자 소유 데이터 정리.
// 예전에는 세 경로 모두 User 문서만 지워 성적·시간표·스펙·AI 기록이 주인 없이 남았다(DAR-009).
//
// 순서는 연관 데이터 먼저, User 마지막이다 — 중간에 실패하면 User가 남아 있어 같은 요청으로 다시
// 시도할 수 있다(반대로 하면 userId로 찾을 주인이 사라져 다시 지울 방법이 없다). 트랜잭션은 쓰지
// 않는다 — 운영 DB가 replica set이라는 보장이 없다.
//
// 지우지 않는 것: Payment(전자상거래 기록, 법정 보존), Lecture·UniversitySchedule(관계자가 등록한
// 대학 데이터, 다른 학생이 쓴다). Suggestion은 관계자가 답변한 기록이라 작성자명만 익명화한다.

const fs = require('fs/promises');
const User = require('../models/User');
const { AcademicRecord, CreditSummary } = require('../models/Academic_records');
const { CalendarEvent, Timetable, DailyChecklist } = require('../models/Calendar');
const { UserCertification, Job } = require('../models/Certifications_jobs');
const { WeeklyPlan, CareerPortfolio, CareerDiagnosis, CareerRecommendation } = require('../models/Ai');
const Notification = require('../models/Notification');
const Study = require('../models/Study');
const Suggestion = require('../models/Suggestion');
const UniversityProfile = require('../models/University_profile');
const UserSkill = require('../models/User_skills');
const { verificationFilePath } = require('../config/upload');
const logger = require('../config/logger');

const ANONYMOUS_AUTHOR = '탈퇴한 사용자';

const OWNED_MODELS = {
  AcademicRecord,
  CreditSummary,
  UniversityProfile,
  UserSkill,
  CalendarEvent,
  Timetable,
  DailyChecklist,
  UserCertification,
  Job,
  WeeklyPlan,
  CareerPortfolio,
  CareerDiagnosis,
  CareerRecommendation,
  Notification,
  Study,
};

async function removeVerificationImage(relativePath, userId) {
  if (!relativePath) return;
  try {
    await fs.unlink(verificationFilePath(relativePath));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`인증 사진 삭제 실패(계정 삭제는 계속) | userId=${userId} | ${error.message}`);
    }
  }
}

/**
 * 사용자 소유 데이터를 정리하고 마지막에 User를 지운다. 권한·대상 확인은 호출부가 먼저 한다.
 * @returns {Promise<{ deleted: Record<string, number>, anonymizedSuggestions: number }>}
 */
async function deleteUserAccount(userId) {
  const user = await User.findById(userId).select('verificationImage').lean();

  const deleted = {};
  for (const [name, Model] of Object.entries(OWNED_MODELS)) {
    const result = await Model.deleteMany({ userId });
    deleted[name] = result.deletedCount;
  }

  const anonymized = await Suggestion.updateMany(
    { authorId: userId },
    { $set: { authorName: ANONYMOUS_AUTHOR } },
  );

  await removeVerificationImage(user?.verificationImage, userId);
  await User.deleteOne({ _id: userId });

  return { deleted, anonymizedSuggestions: anonymized.modifiedCount };
}

// 로그용 합계
function countDeleted(result) {
  return Object.values(result?.deleted || {}).reduce((sum, n) => sum + n, 0);
}

module.exports = { deleteUserAccount, countDeleted, OWNED_MODELS };
