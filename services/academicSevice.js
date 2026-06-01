const model = require('../models/Academic_records');

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

module.exports = {
  saveSemesterRecord,
  getSemesterRecord,
  editCourse,
  deleteCourse,
};