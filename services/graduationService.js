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
  doubleMajorPrimaryCredits: null,
  doubleMajorCredits: null,
};

function normalizeMajor(major) {
  return major?.trim() || null;
}

const MIN_ADMISSION_YEAR = 1990;

// 학번에서 입학연도를 판정한다. 형식이 학교마다 달라 저장을 막지 않고, 판정 결과를 화면에 보여
// 학생이 틀리면 학번을 고치게 한다. 저장하지 않고 조회할 때마다 계산한다(학번을 고치면 어긋나므로).
// 숫자만 남겨 앞 4자리가 1990~올해면 그 해, 아니고 2~7자리면 2000+앞 2자리(올해 이하), 그 외 null.
function admissionYearFromStudentId(studentId, now = new Date()) {
  const digits = String(studentId || '').replace(/\D/g, '');
  const thisYear = now.getFullYear();
  if (digits.length >= 4) {
    const year = Number(digits.slice(0, 4));
    if (year >= MIN_ADMISSION_YEAR && year <= thisYear) return year;
  }
  if (digits.length >= 2 && digits.length <= 7) {
    const year = 2000 + Number(digits.slice(0, 2));
    if (year <= thisYear) return year;
  }
  return null;
}

// 입학연도 이하인 fromYear 중 가장 큰 항목. 없거나 연도를 모르면 null(기본 요건).
function pickYearEntry(entries, year) {
  if (year == null) return null;
  return (entries || [])
    .filter((entry) => entry.fromYear <= year)
    .reduce((best, entry) => (!best || entry.fromYear > best.fromYear ? entry : best), null);
}

function mergeGraduationRequirements(schoolRequirements = {}, majorAdditional = {}, studentRequirements = {}) {
  const school = { ...DEFAULT_REQUIREMENTS, ...schoolRequirements };
  const major = majorAdditional || {};
  const student = studentRequirements || {};

  const pick = (studentValue, majorValue, schoolValue) => {
    if (studentValue !== undefined && studentValue !== null) return studentValue;
    if (majorValue !== undefined && majorValue !== null) return majorValue;
    return schoolValue;
  };

  const pickArray = (studentValue, majorValue, schoolValue) => {
    if (Array.isArray(studentValue) && studentValue.length > 0) return studentValue;
    if (Array.isArray(majorValue) && majorValue.length > 0) return majorValue;
    return Array.isArray(schoolValue) ? schoolValue : [];
  };

  return {
    requiredTotalCredits: pick(student.requiredTotalCredits, null, school.requiredTotalCredits),
    requiredMajorCredits: pick(student.requiredMajorCredits, null, school.requiredMajorCredits),
    requiredMajorElective: pick(student.requiredMajorElective, null, school.requiredMajorElective),
    requiredGeneralCredits: pick(student.requiredGeneralCredits, null, school.requiredGeneralCredits),
    requiredGeneralElective: pick(student.requiredGeneralElective, null, school.requiredGeneralElective),
    requiresGraduationWork: pick(student.requiresGraduationWork, major.requiresGraduationWork, school.requiresGraduationWork),
    requiredCertifications: pickArray(student.requiredCertifications, major.requiredCertifications, school.requiredCertifications),
    requiredLanguageScore: pick(student.requiredLanguageScore, major.requiredLanguageScore, school.requiredLanguageScore),
    requiredInternship: pick(student.requiredInternship, major.requiredInternship, school.requiredInternship),
    requiredCapstonDesign: pick(student.requiredCapstonDesign, major.requiredCapstonDesign, school.requiredCapstonDesign),
    requiredNCProgram: pick(student.requiredNCProgram, major.requiredNCProgram, school.requiredNCProgram),
    requiredVolunteer: pick(student.requiredVolunteer, major.requiredVolunteer, school.requiredVolunteer),
    // 학점 항목이라 학과 단계를 건너뛴다. 여기서 빠뜨리면 병합할 때 사라진다.
    doubleMajorPrimaryCredits: pick(student.doubleMajorPrimaryCredits, null, school.doubleMajorPrimaryCredits),
    doubleMajorCredits: pick(student.doubleMajorCredits, null, school.doubleMajorCredits),
  };
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

async function getStaffGraduationForStudent(university, major, admissionYear = null) {
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
  // 학과 추가 요건은 연도를 나누지 않고, 고른 연도(또는 기본) 대학 요건 위에 그대로 덮는다.
  const yearEntry = pickYearEntry(graduationDoc.requirementsByYear, admissionYear);
  const requirements = mergeGraduationRequirements(
    yearEntry ? yearEntry.requirements : graduationDoc.requirements,
    majorEntry?.additionalRequirements,
    {},
  );

  return {
    available: true,
    reason: null,
    message: null,
    university: univ,
    major: majorNorm,
    requirements,
    hasMajorSpecific: Boolean(majorEntry),
    admissionYear,
    appliedFromYear: yearEntry ? yearEntry.fromYear : null,
  };
}

// 학생의 최종 졸업요건 = 학과 추가 요건 > 대학 요건 > 기본값.
// UniversityProfile.GraduationRequirements는 읽지 않는다 — 학생이 저장하는 경로가 없어(403) 스키마
// 기본값(130/42/40/20/28, 졸업작품 true)만 들어 있는데, 마이페이지에서 학년을 저장하면 그 값으로
// 문서가 생겨 대학관계자 요건을 전부 덮었다. 필드와 데이터는 남겨 두고 읽기만 멈춘다.
// 전공은 마이페이지에서 매번 갱신되는 User.major를 먼저 본다.
async function resolveRequirements(userId) {
  const [user, profile] = await Promise.all([
    User.findById(userId).select('university major studentId').lean(),
    UniversityProfile.findOne({ userId }).select('major').lean(),
  ]);

  const university = user?.university || null;
  const major = normalizeMajor(user?.major || profile?.major);

  return getStaffGraduationForStudent(university, major, admissionYearFromStudentId(user?.studentId));
}

module.exports = {
  DEFAULT_REQUIREMENTS,
  mergeGraduationRequirements,
  admissionYearFromStudentId,
  pickYearEntry,
  getUniversityGraduationDoc,
  findMajorRequirements,
  getMajorList,
  getMajorAdditionalRequirements,
  saveMajorAdditionalRequirements,
  getStaffGraduationForStudent,
  resolveRequirements,
};
