const User = require('../../models/User');
const UniversityProfile = require('../../models/University_profile');
const AcademicRecordModel = require('../../models/Academic_records');
const UserSkill = require('../../models/User_skills');
const { Job, UserCertification } = require('../../models/Certifications_jobs');
const logger = require('../../config/logger');
const kstDate = require('../../utils/kstDate');

const availabilityAdapter = require('../phase1/availability');
const creditsAdapter = require('../phase1/credits');
const academicPhaseAdapter = require('../phase1/academicPhase');
const certScheduleAdapter = require('../phase1/certSchedule');
const completionService = require('./completionService');

const MAJOR_COURSES_LIMIT = 40;
const SPEC_LIST_LIMIT = 15;
const CERT_SCHEDULE_LIMIT = 12;
const CONTEXT_SIZE_WARN_BYTES = 12 * 1024;

// 학교 시스템이 과목명 앞에 붙이는 표기 아티팩트(*, ※) 제거 — 정제 안 하면
// "***AI빅데이터와융합IP" 같은 원본 오염이 그대로 LLM 출력에 노출된다.
const cleanSubjectName = s => String(s || '').replace(/^[*※\s]+/, '').trim();

// 과목 구분(subjectType) enum → 한글 라벨. LLM에 원본 enum 값을 그대로 넘기면
// "enrolled"처럼 영어 토큰이 한국어 문장에 그대로 박힌다 — 아래 ENROLLMENT_LABEL과
// 같은 이유로 모든 enum은 여기서 한 번에 한글로 바꿔서 넘긴다.
const SUBJECT_TYPE_LABEL = {
  major_required: '전공필수',
  major_elective: '전공선택',
  general_required: '교양필수',
  general_elective: '교양선택',
  free: '일반선택',
};

// enrollmentStatus는 모델마다 enum이 다르다(User: 한글, UniversityProfile: 영어) —
// 어느 쪽에서 오든 한글 라벨로 통일한다.
const ENROLLMENT_LABEL = {
  enrolled: '재학', leave: '휴학', dropout: '자퇴', graduated: '졸업',
  재학: '재학', 휴학: '휴학', 졸업: '졸업',
};

// UserSkill.userLanguage.language의 enum → 한글.
const LANGUAGE_LABEL = {
  english: '영어', japanese: '일본어', chinese: '중국어', other: '기타',
};

function mapLabel(labelMap, value) {
  if (!value) return value;
  return labelMap[value] || value;
}

// 이 컨텍스트에 들어있는 enum성 필드를 전부 한글로 통일하는 단일 지점.
// enrollmentStatus는 라벨링했는데 userLanguage.language는 빠뜨리는 식으로, 필드별로
// 따로 처리하면 새 enum 필드가 생길 때마다 놓치기 쉽다 — 여기 한 곳만 관리한다.
// buildUserContext가 context를 다 조립한 뒤, compact() 직전에 딱 한 번 호출한다.
function applyKoreanLabels(context) {
  if (context.profile) {
    context.profile.enrollmentStatus = mapLabel(ENROLLMENT_LABEL, context.profile.enrollmentStatus);
  }
  (context.academic?.currentSubjects || []).forEach(s => {
    s.subjectType = mapLabel(SUBJECT_TYPE_LABEL, s.subjectType);
  });
  (context.specs?.languages || []).forEach(l => {
    l.language = mapLabel(LANGUAGE_LABEL, l.language);
  });
  return context;
}

// 어학 성적: 시험별 최고점 1개만, 만료된 건 제외하고 LLM에 넘긴다 — 그래야
// "TOEIC 800과 TOEIC 600을 나란히" 같은 문장이 안 나온다. 만료 여부 자체는
// missingAnalyzer가 판단해야 하므로 필터링 전 원본 목록을 기준으로 별도 플래그를
// 계산해 hasAnyLanguage/hasExpiredLanguage로 전달한다(필터링된 배열만 보면
// missing 판정이 무력화된다).
function selectBestLanguages(languages) {
  const now = Date.now();
  const bestByTest = new Map();

  for (const l of languages) {
    const key = l.testName || l.language;
    if (!key) continue;
    if (l.expiryDate && new Date(l.expiryDate).getTime() < now) continue;

    const score = Number(l.score);
    const existing = bestByTest.get(key);
    const existingScore = existing ? Number(existing.score) : -Infinity;
    if (!existing || (Number.isFinite(score) && score > existingScore)) {
      bestByTest.set(key, l);
    }
  }

  return [...bestByTest.values()];
}

// 요구조건(requiredCertifications)만 보유 자격증과 대조해 미보유분을 추린다.
// boolean형 요건(requiresGraduationWork 등)은 이행 여부를 추적하는 DB 필드가 없어
// 판별할 수 없으므로 true인 항목을 이름 그대로 나열한다 — LLM에는 "없는 데이터를
// 지어내지 마라" 규칙이 있으므로 실질적 문제는 없다.
function derivePendingRequirements(requirements, acquiredCertNames) {
  if (!requirements) return [];

  const pending = [];
  if (requirements.requiresGraduationWork) pending.push('졸업논문/졸업작품');
  if (requirements.requiredCapstonDesign) pending.push('캡스톤디자인');
  if (requirements.requiredNCProgram) pending.push('비교과 프로그램');
  if (requirements.requiredInternship) pending.push('인턴십');
  if (requirements.requiredVolunteer) pending.push(`사회봉사 ${requirements.requiredVolunteer}시간`);
  if (requirements.requiredLanguageScore) pending.push(`어학성적 ${requirements.requiredLanguageScore}`);

  (requirements.requiredCertifications || []).forEach(name => {
    if (!acquiredCertNames.has(name)) pending.push(name);
  });

  return pending;
}

function extractMajorCourses(records) {
  const courses = [];
  for (const record of records) {
    for (const subject of (record.subjects || [])) {
      if (!subject.subjectType?.startsWith('major')) continue;
      if (!subject.grade || subject.grade === 'F') continue;
      courses.push({ name: cleanSubjectName(subject.subjectName), grade: subject.grade });
      if (courses.length >= MAJOR_COURSES_LIMIT) return courses;
    }
  }
  return courses;
}

// subjectType을 함께 넘겨 LLM이 "전공" 섹션에 교양 과목을 전공인 것처럼 인용하지
// 않게 한다(majorCourses는 전공만 걸렀지만 이번 학기 수강 과목은 구분이 없었음).
// 한글 라벨 변환은 여기서 하지 않는다 — applyKoreanLabels가 한 곳에서 일괄 처리한다.
function extractCurrentSubjects(records) {
  return records
    .filter(r => r.status === 'in_progress')
    .flatMap(r => (r.subjects || []).map(s => ({
      name: cleanSubjectName(s.subjectName),
      subjectType: s.subjectType || null,
    })));
}

// 날짜 내림차순(최신 우선) 정렬 — 서브도큐먼트 배열은 입력 순서일 뿐 날짜순이 아니므로,
// limit으로 자르기 전에 정렬하지 않으면 최근 성과가 잘려나갈 수 있다.
// 원본 배열(.lean() 결과)을 제자리 변경하지 않도록 스프레드로 복사한다.
function sortByDateDesc(list, key) {
  return [...list].sort((a, b) => new Date(b[key] || 0) - new Date(a[key] || 0));
}

// null/undefined/빈 배열 필드를 JSON에서 제거 — 토큰 절약
function compact(value) {
  return JSON.parse(JSON.stringify(value, (key, v) => {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v) && v.length === 0) return undefined;
    return v;
  }));
}

async function buildUserContext(userId) {
  const [user, profile, records, skillDoc, targetJob, acquiredCerts, creditsResult, requirements, certSchedule] = await Promise.all([
    User.findById(userId).select('major grade enrollmentStatus university').lean(),
    UniversityProfile.findOne({ userId }).select('major doubleMajor grade enrollmentStatus').lean(),
    AcademicRecordModel.AcademicRecord.find({ userId })
      .select('status year semesterNumber subjects')
      .sort({ year: -1, semesterNumber: -1 })
      .lean(),
    UserSkill.findOne({ userId }).select('userSkill userLanguage userAward userExperience').lean(),
    Job.findOne({ userId, status: 'target' })
      .select('title responsibilities abilities knowledge relatedCertifications')
      .lean(),
    UserCertification.find({ userId, status: 'acquired' })
      .select('date score')
      .populate('certificationId', 'name')
      .lean(),
    creditsAdapter.calcRemainingCredits(userId),
    creditsAdapter.resolveRequirements(userId),
    certScheduleAdapter.getUpcomingCertSchedule(userId, CERT_SCHEDULE_LIMIT),
  ]);

  // UniversityProfile은 신규 사용자에게 없을 수 있음 → User 필드로 폴백.
  // enrollmentStatus 한글 라벨 변환은 여기서 하지 않는다 — applyKoreanLabels가
  // 한 곳에서 일괄 처리한다.
  const resolvedProfile = {
    major: profile?.major || user?.major || null,
    doubleMajor: profile?.doubleMajor || null,
    grade: profile?.grade ?? user?.grade ?? null,
    enrollmentStatus: profile?.enrollmentStatus || user?.enrollmentStatus || null,
  };

  // 만료 판정은 필터링 전 원본 목록으로 미리 계산 — missingAnalyzer가 이 두
  // 플래그로 판정하므로, specs.languages를 최고점만 남기게 걸러내도 영향받지 않는다.
  const rawLanguages = skillDoc?.userLanguage || [];
  const hasAnyLanguage = rawLanguages.length > 0;
  const hasExpiredLanguage = rawLanguages.some(
    l => l.expiryDate && new Date(l.expiryDate).getTime() < Date.now(),
  );

  const acquiredCertNames = new Set(
    acquiredCerts.map(c => c.certificationId?.name).filter(Boolean),
  );

  // Phase1 어댑터가 undefined를 반환해도(구현 누락, 예외적 반환문 등) 여기서 바로
  // TypeError로 죽지 않도록 방어 — 지금은 스텁이 실 함수로 바뀐 상태라 위험이 낮지만,
  // 어댑터가 계약을 어기는 순간 생성 전체가 500으로 죽는 걸 막는 마지막 방어선.
  const credits = creditsResult ?? {};

  const context = {
    profile: resolvedProfile,
    academic: {
      gpa: credits.gpa ?? null,
      earnedCredits: credits.earnedTotal ?? null,
      remaining: {
        total: credits.total ?? null,
        majorRequired: credits.majorRequired ?? null,
        majorElective: credits.majorElective ?? null,
        generalRequired: credits.generalRequired ?? null,
        generalElective: credits.generalElective ?? null,
      },
      pendingRequirements: derivePendingRequirements(requirements, acquiredCertNames),
      majorCourses: extractMajorCourses(records),
      currentSubjects: extractCurrentSubjects(records),
    },
    specs: {
      certifications: acquiredCerts
        .filter(c => c.certificationId?.name)
        .map(c => ({ name: c.certificationId.name, acquiredDate: c.date, score: c.score || null })),
      skills: (skillDoc?.userSkill || []).map(s => ({ name: s.name, level: s.level })),
      languages: selectBestLanguages(rawLanguages).map(l => ({
        language: l.language, testName: l.testName, score: l.score, expiryDate: l.expiryDate,
      })),
      hasAnyLanguage,
      hasExpiredLanguage,
      awards: sortByDateDesc(skillDoc?.userAward || [], 'acquiredDate').slice(0, SPEC_LIST_LIMIT).map(a => ({
        name: a.name, organizer: a.organizer, rank: a.rank, acquiredDate: a.acquiredDate,
      })),
      experiences: sortByDateDesc(skillDoc?.userExperience || [], 'startDate').slice(0, SPEC_LIST_LIMIT).map(e => ({
        title: e.title, host: e.host, startDate: e.startDate, endDate: e.endDate, note: e.note,
      })),
    },
    targetJob: targetJob ? {
      title: targetJob.title,
      responsibilities: targetJob.responsibilities,
      abilities: targetJob.abilities,
      knowledge: targetJob.knowledge,
      relatedCertifications: targetJob.relatedCertifications,
    } : null,
    certSchedule,
  };

  applyKoreanLabels(context);
  const compacted = compact(context);
  const size = Buffer.byteLength(JSON.stringify(compacted), 'utf8');
  if (size > CONTEXT_SIZE_WARN_BYTES) {
    logger.warn(`[ai] buildUserContext exceeded size budget: ${size} bytes (userId=${userId})`);
  }

  return compacted;
}

async function buildWeeklyPlanContext(userId, weekStart) {
  const [userContext, rawAvailability, academicPhase, prevWeekFeedback] = await Promise.all([
    buildUserContext(userId),
    availabilityAdapter.calcAvailableHours(userId, academicPhaseAdapter.deriveSemesterFromDate(weekStart)),
    academicPhaseAdapter.getAcademicContext(userId, weekStart),
    completionService.getPreviousWeekFeedback(userId, weekStart),
  ]);

  const rawAvailableHoursByDay = rawAvailability?.hoursByDay;
  const hasTimetable = rawAvailability?.hasTimetable ?? true;

  // Phase1 계약 위반(배열이 아니거나 길이/값이 이상함) 방어 — 여기서 조용히 NaN이
  // 새어나가면 validator의 시간 예산 제한이 통째로 무력화된다.
  const isValidShape = Array.isArray(rawAvailableHoursByDay) && rawAvailableHoursByDay.length === 7;
  if (!isValidShape) {
    logger.error(`[ai] calcAvailableHours가 잘못된 형태를 반환함 (userId=${userId}): ${JSON.stringify(rawAvailableHoursByDay)}`);
  }
  const availableHoursByDay = (isValidShape ? rawAvailableHoursByDay : Array(7).fill(0))
    .map(h => (Number.isFinite(h) && h >= 0 ? h : 0));

  // 주 중간에 생성하면(예: 목요일에 "이번 주" 계획 생성) dailyDistributor.distribute()는
  // 이미 지난 요일을 배치 대상에서 제외하는데, 여기서 만드는 availableHoursTotal은 7일
  // 전체 기준이라 LLM이 실제로 분배 가능한 시간보다 큰 예산으로 계획을 짜는 불일치가
  // 있었다(그 결과 분배 단계에서 초과분이 통째로 버려짐 — 실제로 발생). 지난 요일의
  // 가용시간을 0으로 만들어 두 숫자를 맞춘다. weekStart가 미래 주면 전부 오늘 이후라
  // 아무것도 안 바뀐다.
  const todayStr = kstDate.toKstDateString(new Date());
  kstDate.getWeekDateStrings(weekStart).forEach(d => {
    if (d < todayStr) {
      availableHoursByDay[kstDate.getKstDayOfWeek(kstDate.fromKstDateString(d))] = 0;
    }
  });

  const availableHoursTotal = +availableHoursByDay.reduce((sum, h) => sum + h, 0).toFixed(1);

  // academicPhase.semester가 null이면(방학 등 학기 공백기) 이번 주엔 "현재 수강 중"이라
  // 부를 과목이 없다. AcademicRecord.status는 학기가 끝나고 성적이 다 들어가도 자동으로
  // 'completed'로 바뀌지 않아 'in_progress'로 남는 경우가 있어(실제 확인됨: 2026-1학기
  // 전 과목 성적 A대 기록 완료 상태인데 status는 여전히 in_progress), currentSubjects를
  // 그대로 넘기면 방학 중에도 끝난 학기 과목이 "이번 주 학습 대상"으로 잘못 들어간다
  // (실제로 발생). 날짜 기반으로 계산한 academicPhase.semester를 기준으로 덮어쓴다 —
  // portfolio/diagnosis(날짜 무관, 학업 스냅샷 목적)는 buildUserContext를 그대로 쓰므로
  // 영향 없다.
  if (!academicPhase?.semester && userContext.academic) {
    delete userContext.academic.currentSubjects;
  }

  return {
    ...userContext,
    computed: {
      availableHoursByDay,
      availableHoursTotal,
      academicPhase: academicPhase?.phase ?? null,
      semester: academicPhase?.semester ?? null,
      hasTimetable,
    },
    prevCompletionRate: prevWeekFeedback?.rate ?? null,
    incompleteItems: prevWeekFeedback?.incompleteItems ?? [],
  };
}

async function buildPortfolioContext(userId) {
  return buildUserContext(userId);
}

module.exports = { buildUserContext, buildWeeklyPlanContext, buildPortfolioContext };
