const model = require('../models/Academic_records');
const UniversityProfile = require('../models/University_profile');

function calculateSemesterSummary(subjects) {
  const gradePoints = {
    'A+': 4.5, 'A': 4.0,
    'B+': 3.5, 'B': 3.0,
    'C+': 2.5, 'C': 2.0,
    'D+': 1.5, 'D': 1.0,
    'F': 0,
  };

  return subjects.reduce((summary, subject) => {
    const credits = Number(subject.credits) || 0;
    const gradePoint = gradePoints[subject.grade] ?? null;

    summary.attemptedCredits += credits;
    if (gradePoint !== null) {
      summary.semesterPoints += gradePoint * credits;
      if (subject.grade !== 'F') {
        summary.earnedCredits += credits;
      }
    }

    return summary;
  }, {
    attemptedCredits: 0,
    earnedCredits: 0,
    semesterPoints: 0,
  });
}

// 학기별 GPA 계산기 저장
async function saveSemesterRecord({ userId, semester, year, semesterNumber, status = 'in_progress', subjects = [] }) {
  const semesterSummary = calculateSemesterSummary(subjects);

  await model.AcademicRecord.findOneAndUpdate(
    { userId, semester },
    {
      userId,
      semester,
      year,
      semesterNumber,
      status,
      subjects,
      semesterSummary: {
        attemptedCredits: semesterSummary.attemptedCredits,
        earnedCredits: semesterSummary.earnedCredits,
        semesterGPA: semesterSummary.attemptedCredits
          ? Number((semesterSummary.semesterPoints / semesterSummary.attemptedCredits).toFixed(2))
          : null,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
}

const getSemesterRecord = async (userId, semester) => {
  try {
    const record = await model.AcademicRecord.findOne({ userId, semester }).lean();
    return record;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
// GPA 계산기 강의 수정
async function editCourse(userEmail, courseId, courseName, courseCode, credits) {
  await model.findOneAndUpdate(
    { _id: courseId, userEmail },
    { courseName, courseCode, credits }
  );
}
// GPA 계산기 강의 삭제
async function deleteCourse(userEmail, courseId) {
  await model.findOneAndDelete({ _id: courseId, userEmail });
}
async function getAllSemesterGPA(userId) {
  try {
    const records = await model.AcademicRecord.find({ userId })
      .select('semester year semesterNumber status semesterSummary.attemptedCredits semesterSummary.earnedCredits semesterSummary.semesterGPA')
      .sort({ year: 1, semesterNumber: 1 })
      .lean();

    return records.map(r => ({
      semester: r.semester,
      year: r.year,
      semesterNumber: r.semesterNumber,
      status: r.status,
      attemptedCredits: r.semesterSummary?.attemptedCredits ?? 0,
      earnedCredits: r.semesterSummary?.earnedCredits ?? 0,
      semesterGPA: r.semesterSummary?.semesterGPA ?? null,
    }));
  } catch (error) {
    console.error(error);
    throw error;
  }
}
// 모든 학기 레코드 조회 (GPA 계산기용)
async function getAllSemesterRecords(userId) {
  try {
    const records = await model.AcademicRecord.find({ userId })
      .select('semester year semesterNumber status semesterSummary subjects')
      .sort({ year: 1, semesterNumber: 1 })
      .lean();

    return records.map(r => ({
      semester: r.semester,
      year: r.year,
      semesterNumber: r.semesterNumber,
      status: r.status,
      attemptedCredits: r.semesterSummary?.attemptedCredits ?? 0,
      earnedCredits: r.semesterSummary?.earnedCredits ?? 0,
      semesterGPA: r.semesterSummary?.semesterGPA ?? null,
      subjects: r.subjects || [],
    }));
  } catch (error) {
    console.error(error);
    throw error;
  }
}
// 대학 프로필 조회(졸업요건 조회)
async function getUniversityProfile(userId) {
  try {
    return await UniversityProfile.findOne({ userId }).lean();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
// 대학 프로필 저장(졸업 요건)
async function saveUniversityProfile(userId, profileData) {
  try {
    const existingProfile = await UniversityProfile.findOne({ userId }).lean();
    const mergedProfile = {
      ...(existingProfile || {}),
      ...profileData,
    };

    return await UniversityProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        studentId: mergedProfile.studentId ?? null,
        grade: mergedProfile.grade ?? 1,
        enrollmentStatus: mergedProfile.enrollmentStatus || 'enrolled',
        major: mergedProfile.major,
        doubleMajor: mergedProfile.doubleMajor ?? null,
        GraduationRequirements: {
          requiredTotalCredits: mergedProfile.GraduationRequirements?.requiredTotalCredits ?? 130,
          requiredMajorCredits: mergedProfile.GraduationRequirements?.requiredMajorCredits ?? 42,
          requiredMajorElective: mergedProfile.GraduationRequirements?.requiredMajorElective ?? 40,
          requiredGeneralCredits: mergedProfile.GraduationRequirements?.requiredGeneralCredits ?? 20,
          requiredGeneralElective: mergedProfile.GraduationRequirements?.requiredGeneralElective ?? 28,
          requiresGraduationWork: mergedProfile.GraduationRequirements?.requiresGraduationWork ?? true,
          requiredCertifications: mergedProfile.GraduationRequirements?.requiredCertifications ?? [],
          requiredLanguageScore: mergedProfile.GraduationRequirements?.requiredLanguageScore ?? null,
          requiredInternship: mergedProfile.GraduationRequirements?.requiredInternship ?? null,
          requiredCapstonDesign: mergedProfile.GraduationRequirements?.requiredCapstonDesign ?? null,
          requiredNCProgram: mergedProfile.GraduationRequirements?.requiredNCProgram ?? null,
          requiredVolunteer: mergedProfile.GraduationRequirements?.requiredVolunteer ?? null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = {
  saveSemesterRecord,
  getSemesterRecord,
  editCourse,
  deleteCourse,
  getAllSemesterGPA,
  getAllSemesterRecords,
  getUniversityProfile,
  saveUniversityProfile,
};