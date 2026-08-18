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

async function getStaffGraduationForStudent(university, major) {
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
  const requirements = mergeGraduationRequirements(
    graduationDoc.requirements,
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
  };
}

// 대학 마스터 → 전공 추가요건 → 개인 override(UniversityProfile) 순으로 병합한 최종 졸업요건
async function resolveRequirements(userId) {
  const [user, profile] = await Promise.all([
    User.findById(userId).select('university major').lean(),
    UniversityProfile.findOne({ userId }).lean(),
  ]);

  const university = user?.university || null;
  const major = normalizeMajor(profile?.major || user?.major);

  const base = await getStaffGraduationForStudent(university, major);
  if (!base.available) return base;

  return {
    ...base,
    requirements: mergeGraduationRequirements(
      base.requirements,
      null,
      profile?.GraduationRequirements,
    ),
  };
}

module.exports = {
  DEFAULT_REQUIREMENTS,
  mergeGraduationRequirements,
  getUniversityGraduationDoc,
  findMajorRequirements,
  getMajorList,
  getMajorAdditionalRequirements,
  saveMajorAdditionalRequirements,
  getStaffGraduationForStudent,
  resolveRequirements,
};
