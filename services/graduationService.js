const User = require('../models/User');
const UniversityGraduation = require('../models/UniversityGraduation');
const UniversityProfile = require('../models/University_profile');

const DEFAULT_REQUIREMENTS = {
  requiredTotalCredits: 130,
  requiredMajorCredits: 42,
  requiredMajorElective: 40,
  requiredGeneralCredits: 20,
  requiredGeneralElective: 28,
  requiresGraduationWork: true,
  requiredCertifications: [],
  requiredLanguageScore: null,
  requiredInternship: null,
  requiredCapstonDesign: null,
  requiredNCProgram: null,
  requiredVolunteer: null,
};

function normalizeMajor(major) {
  return major?.trim() || null;
}

// 학점 항목: 입학년도별 덮어쓰기가 대상. 학과 추가요건·학점 외 항목은 입학년도와 무관하다.
const CREDIT_FIELDS = [
  'requiredTotalCredits',
  'requiredMajorCredits',
  'requiredMajorElective',
  'requiredGeneralCredits',
  'requiredGeneralElective',
];

const MIN_ADMISSION_YEAR = 1990;
const MAX_ADMISSION_YEAR = 2100;

function isValidYear(year) {
  return Number.isInteger(year) && year >= MIN_ADMISSION_YEAR && year <= MAX_ADMISSION_YEAR;
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

// 학교 기본값 → (입학년도별 학점 덮어쓰기) → 학과 추가요건 순으로 병합한다.
// 학생 개인 값은 더 이상 쓰지 않는다: 학생은 졸업요건을 수정할 수 없고, 프로필에 자동 저장된
// 시스템 기본값이 학교 등록값을 가리는 문제가 있었다.
function mergeGraduationRequirements(schoolRequirements = {}, majorAdditional = {}, cohortRequirements = {}) {
  const school = { ...DEFAULT_REQUIREMENTS, ...schoolRequirements };
  const major = majorAdditional || {};
  const cohort = cohortRequirements || {};

  const pick = (majorValue, schoolValue) => (majorValue !== undefined && majorValue !== null ? majorValue : schoolValue);
  const pickArray = (majorValue, schoolValue) => {
    if (Array.isArray(majorValue) && majorValue.length > 0) return majorValue;
    return Array.isArray(schoolValue) ? schoolValue : [];
  };
  const credit = (key) => (cohort[key] !== undefined && cohort[key] !== null ? cohort[key] : school[key]);

  return {
    requiredTotalCredits: credit('requiredTotalCredits'),
    requiredMajorCredits: credit('requiredMajorCredits'),
    requiredMajorElective: credit('requiredMajorElective'),
    requiredGeneralCredits: credit('requiredGeneralCredits'),
    requiredGeneralElective: credit('requiredGeneralElective'),
    requiresGraduationWork: pick(major.requiresGraduationWork, school.requiresGraduationWork),
    requiredCertifications: pickArray(major.requiredCertifications, school.requiredCertifications),
    requiredLanguageScore: pick(major.requiredLanguageScore, school.requiredLanguageScore),
    requiredInternship: pick(major.requiredInternship, school.requiredInternship),
    requiredCapstonDesign: pick(major.requiredCapstonDesign, school.requiredCapstonDesign),
    requiredNCProgram: pick(major.requiredNCProgram, school.requiredNCProgram),
    requiredVolunteer: pick(major.requiredVolunteer, school.requiredVolunteer),
  };
}

// 학생 입학년도 이하의 fromYear 중 가장 큰 것(= 그 학생에게 적용되는 가장 최근 개정)
function findCohortRequirements(doc, admissionYear) {
  const year = Number(admissionYear);
  if (!doc || !isValidYear(year)) return null;
  return (doc.cohortRequirements || [])
    .filter((item) => item.fromYear <= year)
    .sort((a, b) => b.fromYear - a.fromYear)[0] || null;
}

async function getUniversityGraduationDoc(university) {
  const univ = university?.trim();
  if (!univ) return null;
  return UniversityGraduation.findOne({ university: univ }).lean();
}

function findMajorRequirements(doc, major) {
  const normalized = normalizeMajor(major);
  if (!doc || !normalized) return null;
  return doc.majorRequirements?.find((item) => item.major === normalized) || null;
}

async function getMajorList(university) {
  const univ = university?.trim();
  if (!univ) return [];

  const [userMajors, graduationDoc] = await Promise.all([
    User.distinct('major', { university: univ, role: 'student', major: { $nin: [null, ''] } }),
    getUniversityGraduationDoc(univ),
  ]);

  const seen = new Set();
  const majors = [];

  [...(graduationDoc?.majorRequirements || []).map((item) => item.major), ...userMajors]
    .map(normalizeMajor)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .forEach((major) => {
      if (seen.has(major)) return;
      seen.add(major);
      majors.push(major);
    });

  return majors;
}

async function getMajorAdditionalRequirements(university, major) {
  const normalized = normalizeMajor(major);
  if (!normalized) {
    const err = new Error('학과를 선택해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }

  const doc = await getUniversityGraduationDoc(university);
  const found = findMajorRequirements(doc, normalized);
  return found?.additionalRequirements || null;
}

async function saveMajorAdditionalRequirements(university, major, additionalRequirements, updatedBy) {
  const univ = university?.trim();
  const normalized = normalizeMajor(major);

  if (!univ) {
    const err = new Error('소속 대학 정보가 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }
  if (!normalized) {
    const err = new Error('학과를 선택해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }

  const doc = await UniversityGraduation.findOneAndUpdate(
    { university: univ },
    {
      $setOnInsert: { university: univ, requirements: DEFAULT_REQUIREMENTS },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const nextEntry = {
    major: normalized,
    additionalRequirements,
    updatedBy,
  };

  const existingIndex = doc.majorRequirements.findIndex((item) => item.major === normalized);
  if (existingIndex >= 0) {
    const existing = doc.majorRequirements[existingIndex];
    doc.majorRequirements[existingIndex] = {
      ...(existing.toObject ? existing.toObject() : existing),
      ...nextEntry,
    };
  } else {
    doc.majorRequirements.push(nextEntry);
  }

  await doc.save();
  return findMajorRequirements(doc.toObject(), normalized);
}

// 대학관계자: 입학년도별 학점 덮어쓰기 저장(같은 fromYear가 있으면 교체)
async function saveCohortRequirements(university, fromYear, creditValues, updatedBy) {
  const univ = university?.trim();
  if (!univ) {
    const err = new Error('소속 대학 정보가 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }

  const year = Number(fromYear);
  if (!isValidYear(year)) {
    throw validationError(`입학년도는 ${MIN_ADMISSION_YEAR}~${MAX_ADMISSION_YEAR} 사이의 4자리 연도로 입력해주세요.`);
  }

  const requirements = {};
  CREDIT_FIELDS.forEach((key) => {
    const raw = creditValues?.[key];
    if (raw === undefined || raw === null || raw === '') return;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw validationError('학점은 0 이상의 정수로 입력해주세요.');
    }
    requirements[key] = value;
  });
  if (Object.keys(requirements).length === 0) {
    throw validationError('달라지는 학점 항목을 하나 이상 입력해주세요.');
  }

  const doc = await UniversityGraduation.findOneAndUpdate(
    { university: univ },
    { $setOnInsert: { university: univ, requirements: DEFAULT_REQUIREMENTS } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const nextEntry = { fromYear: year, requirements, updatedBy };
  const existingIndex = doc.cohortRequirements.findIndex((item) => item.fromYear === year);
  if (existingIndex >= 0) {
    doc.cohortRequirements[existingIndex] = nextEntry;
  } else {
    doc.cohortRequirements.push(nextEntry);
  }

  await doc.save();
  return doc.toObject().cohortRequirements.sort((a, b) => a.fromYear - b.fromYear);
}

async function deleteCohortRequirements(university, fromYear) {
  const univ = university?.trim();
  const year = Number(fromYear);
  if (!univ || !isValidYear(year)) throw validationError('삭제할 입학년도를 확인해주세요.');

  const doc = await UniversityGraduation.findOne({ university: univ });
  if (!doc) return [];

  doc.cohortRequirements = doc.cohortRequirements.filter((item) => item.fromYear !== year);
  await doc.save();
  return doc.toObject().cohortRequirements.sort((a, b) => a.fromYear - b.fromYear);
}

async function getStaffGraduationForStudent(university, major, admissionYear) {
  const univ = university?.trim() || null;
  const majorNorm = normalizeMajor(major);

  if (!univ) {
    return {
      available: false,
      reason: 'NO_UNIVERSITY',
      message: '소속 대학 정보가 없어 졸업요건을 확인할 수 없습니다.',
    };
  }

  if (!majorNorm) {
    return {
      available: false,
      reason: 'NO_MAJOR',
      message: '전공 정보가 없어 졸업요건을 확인할 수 없습니다.',
    };
  }

  const approvedStaffExists = await User.exists({
    role: 'staff',
    staffStatus: 'approved',
    university: univ,
  });

  if (!approvedStaffExists) {
    return {
      available: false,
      reason: 'NO_STAFF',
      message: '해당 학교의 관계자 정보가 없어 졸업요건을 확인할 수 없습니다.',
    };
  }

  const graduationDoc = await getUniversityGraduationDoc(univ);
  if (!graduationDoc) {
    return {
      available: false,
      reason: 'NO_DATA',
      message: '대학관계자가 아직 졸업요건을 등록하지 않았습니다.',
    };
  }

  const majorEntry = findMajorRequirements(graduationDoc, majorNorm);
  const year = Number(admissionYear);
  const cohortEntry = findCohortRequirements(graduationDoc, year);
  const requirements = mergeGraduationRequirements(
    graduationDoc.requirements,
    majorEntry?.additionalRequirements,
    cohortEntry?.requirements,
  );

  return {
    available: true,
    reason: null,
    message: null,
    university: univ,
    major: majorNorm,
    requirements,
    hasMajorSpecific: Boolean(majorEntry),
    // 화면에 "어떤 기준으로 계산했는지" 보여 주기 위한 근거 정보
    basis: {
      university: univ,
      major: majorNorm,
      admissionYear: isValidYear(year) ? year : null,
      cohortFromYear: cohortEntry?.fromYear ?? null,
      schoolHasCohorts: (graduationDoc.cohortRequirements || []).length > 0,
      hasMajorSpecific: Boolean(majorEntry),
      updatedAt: graduationDoc.updatedAt || null,
    },
  };
}

// 학교 기본값 → 입학년도별 학점 → 학과 추가요건 순으로 병합한 최종 졸업요건.
// 전공은 항상 회원 정보(User.major) 기준이다. 학사 프로필의 전공은 처음 만들 때만 기록되어
// 전공을 바꿔도 갱신되지 않으므로, 회원 전공이 비어 있을 때만 대체값으로 쓴다.
async function resolveRequirements(userId) {
  const [user, profile] = await Promise.all([
    User.findById(userId).select('university major admissionYear').lean(),
    UniversityProfile.findOne({ userId }).select('major').lean(),
  ]);

  const university = user?.university || null;
  const major = normalizeMajor(user?.major || profile?.major);

  return getStaffGraduationForStudent(university, major, user?.admissionYear);
}

module.exports = {
  DEFAULT_REQUIREMENTS,
  mergeGraduationRequirements,
  getUniversityGraduationDoc,
  findMajorRequirements,
  findCohortRequirements,
  saveCohortRequirements,
  deleteCohortRequirements,
  getMajorList,
  getMajorAdditionalRequirements,
  saveMajorAdditionalRequirements,
  getStaffGraduationForStudent,
  resolveRequirements,
};
