const academicService = require('../services/academicSevice');
const User = require('../models/User');

function normalizeArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseSemesterCode(rawSemester) {
  const semesterText = String(rawSemester || '').trim();
  const match = semesterText.match(/(\d{4})\s*[-/]?\s*([12])/);
  if (!match) {
    return null;
  }

  return {
    semester: `${match[1]}-${match[2]}`,
    year: Number(match[1]),
    semesterNumber: Number(match[2]),
  };
}

//gpa 계산기 강의 추가
const addCourse = async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const user = await User.findOne({ email: req.user.email }).select('_id email').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const semesterInfo = parseSemesterCode(req.body.semester);
    if (!semesterInfo) {
      return res.status(400).json({ success: false, message: 'Invalid semester' });
    }

    const subjectNames = normalizeArray(req.body.subjectName).map(value => String(value || '').trim());
    const creditsList = normalizeArray(req.body.credits);
    const grades = normalizeArray(req.body.grade);
    const subjectTypes = normalizeArray(req.body.subjectType);

    const subjects = subjectNames
      .map((subjectName, index) => ({
        subjectName,
        subjectCode: null,
        subjectType: String(subjectTypes[index] || subjectTypes[0] || 'free'),
        credits: Number.parseInt(creditsList[index], 10) || 0,
        grade: String(grades[index] || '').trim() || null,
        isRetake: false,
        gradePoint: null,
        isPassed: null,
        memo: null,
      }))
      .filter(subject => subject.subjectName);

    if (!subjects.length) {
      return res.status(400).json({ success: false, message: 'At least one subject is required' });
    }

    await academicService.saveSemesterRecord({
      userId: user._id,
      ...semesterInfo,
      status: 'in_progress',
      subjects,
    });

    return res.json({ success: true, redirectUrl: '/academic' });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: 'Failed to save academic data' });
  }
}
//gpa 계산기 강의 수정
const editCourse = async (req, res) => {
  try {
    const { courseId, courseName, courseCode, credits } = req.body;
    const userEmail = req.user.email; // 로그인한 유저의 이메일

    await academicService.editCourse(userEmail, courseId, courseName, courseCode, credits);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false });
  }
}
//gpa 계산기 강의 삭제
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userEmail = req.user.email; // 로그인한 유저의 이메일

    await academicService.deleteCourse(userEmail, courseId);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false });
  }
}

// 특정 학기 레코드 조회
const getSemesterRecord = async (req, res) => {
  try {
    if (!req.user || !req.user.email) return res.status(401).json({ success: false });
    const semesterParam = req.params.semester; // expected like '2026-1'
    const user = await User.findOne({ email: req.user.email }).select('_id').lean();
    if (!user) return res.status(404).json({ success: false });

    const record = await academicService.getSemesterRecord(user._id, semesterParam);
    if (!record) return res.json({ success: true, record: null });
    return res.json({ success: true, record });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
}
// 모든 학기 gpa 값 조회
const getSemesterGPA = async (req, res) => {
  try {
    if (!req.user || !req.user.email) return res.status(401).json({ success: false });
    const user = await User.findOne({ email: req.user.email }).select('_id').lean();
    if (!user) return res.status(404).json({ success: false });

    const records = await academicService.getAllSemesterGPA(user._id);
    return res.json({ success: true, records });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
}

// 졸업요건 프로필 조회
const getGraduationRequirements = async (req, res) => {
  try {
    if (!req.user || !req.user.email) return res.status(401).json({ success: false });

    const user = await User.findOne({ email: req.user.email }).select('_id major grade email name').lean();
    if (!user) return res.status(404).json({ success: false });

    const profile = await academicService.getUniversityProfile(user._id);
    return res.json({ success: true, profile });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
};

// 졸업요건 프로필 저장
const saveGraduationRequirements = async (req, res) => {
  try {
    if (!req.user || !req.user.email) return res.status(401).json({ success: false, message: 'User not authenticated' });

    const user = await User.findOne({ email: req.user.email }).select('_id major grade email name').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const graduationRequirements = req.body?.GraduationRequirements || {};
    const profile = await academicService.saveUniversityProfile(user._id, {
      major: req.body?.major || user.major,
      studentId: req.body?.studentId || null,
      grade: req.body?.grade ?? user.grade ?? 1,
      enrollmentStatus: req.body?.enrollmentStatus || 'enrolled',
      doubleMajor: req.body?.doubleMajor || null,
      GraduationRequirements: {
        requiredTotalCredits: Number(graduationRequirements.requiredTotalCredits) || 130,
        requiredMajorCredits: Number(graduationRequirements.requiredMajorCredits) || 42,
        requiredMajorElective: Number(graduationRequirements.requiredMajorElective) || 40,
        requiredGeneralCredits: Number(graduationRequirements.requiredGeneralCredits) || 20,
        requiredGeneralElective: Number(graduationRequirements.requiredGeneralElective) || 28,
        requiresGraduationWork: Boolean(graduationRequirements.requiresGraduationWork),
        requiredCertifications: Array.isArray(graduationRequirements.requiredCertifications)
          ? graduationRequirements.requiredCertifications.map(value => String(value).trim()).filter(Boolean)
          : [],
        requiredLanguageScore: graduationRequirements.requiredLanguageScore || null,
        requiredInternship: graduationRequirements.requiredInternship === ''
          ? null
          : graduationRequirements.requiredInternship === true || graduationRequirements.requiredInternship === 'true',
        requiredCapstonDesign: graduationRequirements.requiredCapstonDesign === ''
          ? null
          : graduationRequirements.requiredCapstonDesign === true || graduationRequirements.requiredCapstonDesign === 'true',
        requiredNCProgram: graduationRequirements.requiredNCProgram === ''
          ? null
          : graduationRequirements.requiredNCProgram === true || graduationRequirements.requiredNCProgram === 'true',
        requiredVolunteer: graduationRequirements.requiredVolunteer === ''
          ? null
          : Number(graduationRequirements.requiredVolunteer) || null,
      },
    });

    return res.json({ success: true, profile });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to save graduation requirements' });
  }
};


module.exports = {
  addCourse,
  editCourse,
  deleteCourse,
  getSemesterRecord,
  getSemesterGPA,
  getGraduationRequirements,
  saveGraduationRequirements,
};