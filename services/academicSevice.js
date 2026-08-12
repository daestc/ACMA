const model = require('../models/Academic_records');
const UniversityProfile = require('../models/University_profile');
const { resolveRequirements } = require('./graduationService');

const PASSING_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'P'];
const GRADE_POINTS = {
  'A+': 4.5, 'A': 4.0,
  'B+': 3.5, 'B': 3.0,
  'C+': 2.5, 'C': 2.0,
  'D+': 1.5, 'D': 1.0,
  'F': 0,
};
const CREDIT_CATEGORY_MAP = {
  major_required: 'majorRequired',
  major_elective: 'majorElective',
  general_required: 'generalRequired',
  general_elective: 'generalElective',
  free: 'free',
};

function calculateSemesterSummary(subjects) {
  return subjects.reduce((summary, subject) => {
    const credits = Number(subject.credits) || 0;
    const grade = subject.grade;

    // P/NP는 GPA 계산(분모/분자) 대상이 아님. P는 취득학점에는 포함.
    if (grade === 'P' || grade === 'NP') {
      if (grade === 'P') summary.earnedCredits += credits;
      return summary;
    }

    const gradePoint = GRADE_POINTS[grade] ?? null;

    summary.attemptedCredits += credits;
    if (gradePoint !== null) {
      summary.semesterPoints += gradePoint * credits;
      if (grade !== 'F') {
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
// 학기별 GPA 계산기 저장 (강의 개별 추가 대응)
async function saveSemesterRecord(data, options = {}) {
  const { userId, semester, year, semesterNumber, status = 'in_progress', subjects = [] } = data;
  const session = options.session; // 트랜잭션 세션 지원

  // 1. 기존 학기 데이터가 있는지 조회
  let record = await model.AcademicRecord.findOne({ userId, semester }).session(session);

  if (!record) {
    // 2-A. 레코드가 없으면 새로 생성 (첫 강의 추가 시)
    const semesterSummary = calculateSemesterSummary(subjects);
    
    record = new model.AcademicRecord({
      userId,
      semester,
      year,
      semesterNumber,
      status,
      subjects, // 전달받은 첫 강의 배열
      semesterSummary: {
        attemptedCredits: semesterSummary.attemptedCredits,
        earnedCredits: semesterSummary.earnedCredits,
        semesterGPA: semesterSummary.attemptedCredits
          ? Number((semesterSummary.semesterPoints / semesterSummary.attemptedCredits).toFixed(2))
          : null,
      }
    });
  } else {
    // 2-B. 레코드가 이미 존재하면 기존 과목 배열에 새 과목 추가
    for (const newSubject of subjects) {
      // 💡 중복 추가 방지: 이미 같은 이름의 과목이 배열에 있는지 검사
      const isDuplicate = record.subjects.some(sub => sub.subjectName === newSubject.subjectName);
      
      if (!isDuplicate) {
        record.subjects.push(newSubject);
      }
    }

    // 상태 업데이트 (필요시)
    record.status = status;

    // 3. "합쳐진 전체 과목 배열"을 기준으로 GPA 요약 정보 재계산
    const semesterSummary = calculateSemesterSummary(record.subjects);
    
    record.semesterSummary = {
      attemptedCredits: semesterSummary.attemptedCredits,
      earnedCredits: semesterSummary.earnedCredits,
      semesterGPA: semesterSummary.attemptedCredits
        ? Number((semesterSummary.semesterPoints / semesterSummary.attemptedCredits).toFixed(2))
        : null,
    };
  }

  // 4. 최종 저장
  await record.save({ session });
  return record;
}
// 여러 과목의 성적을 한 번에 일괄 업데이트하는 함수 (배열 처리)
async function updateBulkGrades({ userId, semester, updates }, options = {}) {
  const session = options.session;

  // 1. 해당 학기 데이터 조회
  const record = await model.AcademicRecord.findOne({ userId, semester }).session(session);

  if (!record) {
    throw new Error('해당 학기 정보를 찾을 수 없습니다.');
  }

  // 2. 프론트엔드에서 넘어온 배열(updates)을 순회하며 기존 성적 변경
  updates.forEach(updateData => {
    const subject = record.subjects.find(sub => sub.subjectName === updateData.subjectName);
    
    if (subject) {
      // 과목을 찾았다면 사용자가 선택한 이수구분과 성적으로 덮어씀
      if (updateData.subjectType) subject.subjectType = updateData.subjectType;
      if (updateData.grade) subject.grade = updateData.grade;
    }
  });

  // 3. 성적들이 싹 바뀌었으므로, 합산된 전체 GPA 및 취득 학점 재계산
  const semesterSummary = calculateSemesterSummary(record.subjects);
  
  record.semesterSummary = {
    attemptedCredits: semesterSummary.attemptedCredits,
    earnedCredits: semesterSummary.earnedCredits,
    semesterGPA: semesterSummary.attemptedCredits
      ? Number((semesterSummary.semesterPoints / semesterSummary.attemptedCredits).toFixed(2))
      : null,
  };

  // 4. 변경된 내역 DB에 최종 저장
  await record.save({ session });
  
  return record;
}
// 학기 마감 — 학생이 직접 누르는 경우에만 'completed'로 전환한다(자동전환 없음).
// 마감 후에도 updateBulkGrades로 성적 수정은 계속 가능 — 편집 잠금은 아니다.
async function closeSemester(userId, semester) {
  const record = await model.AcademicRecord.findOne({ userId, semester });
  if (!record) throw new Error('해당 학기 데이터가 없습니다.');

  record.status = 'completed';
  await record.save();
  await calcRemainingCredits(userId); // completedSemesters 등 캐시 즉시 갱신

  return record;
}

// 마감 취소 — 실수로 마감했을 때 되돌리는 용도
async function reopenSemester(userId, semester) {
  const record = await model.AcademicRecord.findOne({ userId, semester });
  if (!record) throw new Error('해당 학기 데이터가 없습니다.');

  record.status = 'in_progress';
  await record.save();
  await calcRemainingCredits(userId);

  return record;
}

// 학기 레코드에서 특정 과목을 제거하고 GPA를 재계산하는 함수
async function removeSubjectFromRecord({ userId, semester, subjectName }, options = {}) {
  const session = options.session;

  // 1. 해당 학기 데이터 조회
  const record = await model.AcademicRecord.findOne({ userId, semester }).session(session);

  // 학기 데이터가 아예 없으면 지울 것도 없으므로 그냥 종료
  if (!record) return; 

  // 2. 과목 배열에서 '지우려는 과목'만 빼고 다시 필터링해서 덮어쓰기
  const initialLength = record.subjects.length;
  record.subjects = record.subjects.filter(sub => sub.subjectName !== subjectName);

  // 만약 배열 길이가 같다면 (해당 과목이 원래 없었다면) 저장 없이 종료
  if (record.subjects.length === initialLength) return;

  // 3. 과목이 하나 빠졌으므로, 남은 과목들로 합산된 전체 GPA 및 취득 학점 재계산
  const semesterSummary = calculateSemesterSummary(record.subjects);
  
  record.semesterSummary = {
    attemptedCredits: semesterSummary.attemptedCredits,
    earnedCredits: semesterSummary.earnedCredits,
    semesterGPA: semesterSummary.attemptedCredits
      ? Number((semesterSummary.semesterPoints / semesterSummary.attemptedCredits).toFixed(2))
      : null,
  };

  // 4. 변경된 내역 DB에 최종 저장
  await record.save({ session });
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

// 영역별 취득 학점 vs 졸업요건 잔여 학점 계산 (CreditSummary 캐시 갱신 포함)
async function calcRemainingCredits(userId) {
  const records = await model.AcademicRecord.find({ userId }).select('status subjects').lean();

  const earned = { majorRequired: 0, majorElective: 0, generalRequired: 0, generalElective: 0, free: 0, total: 0 };
  let attemptedCreditsTotal = 0;
  let gpaAttemptedCredits = 0;
  let gpaPoints = 0;

  records.forEach(record => {
    (record.subjects || []).forEach(subject => {
      const credits = Number(subject.credits) || 0;
      const grade = subject.grade;
      attemptedCreditsTotal += credits;

      // P/NP는 GPA 분모/분자에서 제외 (calculateSemesterSummary와 동일 규칙)
      if (grade !== 'P' && grade !== 'NP') {
        const gradePoint = GRADE_POINTS[grade] ?? null;
        if (gradePoint !== null) {
          gpaAttemptedCredits += credits;
          gpaPoints += gradePoint * credits;
        }
      }

      if (!PASSING_GRADES.includes(grade)) return;

      const key = CREDIT_CATEGORY_MAP[subject.subjectType] || 'free';
      earned[key] += credits;
      earned.total += credits;
    });
  });

  const completedSemesters = records.filter(r => r.status === 'completed').length;
  const cumulativeGPA = gpaAttemptedCredits ? Number((gpaPoints / gpaAttemptedCredits).toFixed(2)) : null;

  await model.CreditSummary.findOneAndUpdate(
    { userId },
    {
      userId,
      earnedCredits: earned,
      attemptedCreditsTotal,
      completedSemesters,
      cumulativeGPA,
      lastCalculatedAt: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  const graduation = await resolveRequirements(userId);
  if (!graduation.available) {
    return { available: false, reason: graduation.reason, earned, gpa: cumulativeGPA, requirements: null, remaining: null };
  }

  const req = graduation.requirements;
  const remaining = {
    majorRequired: Math.max(0, req.requiredMajorCredits - earned.majorRequired),
    majorElective: Math.max(0, req.requiredMajorElective - earned.majorElective),
    generalRequired: Math.max(0, req.requiredGeneralCredits - earned.generalRequired),
    generalElective: Math.max(0, req.requiredGeneralElective - earned.generalElective),
    total: Math.max(0, req.requiredTotalCredits - earned.total),
  };

  return { available: true, earned, gpa: cumulativeGPA, requirements: req, remaining };
}

module.exports = {
  saveSemesterRecord,
  calcRemainingCredits,
  getSemesterRecord,
  editCourse,
  deleteCourse,
  getAllSemesterGPA,
  getAllSemesterRecords,
  getUniversityProfile,
  saveUniversityProfile,
  updateBulkGrades,
  removeSubjectFromRecord,
  closeSemester,
  reopenSemester,
};