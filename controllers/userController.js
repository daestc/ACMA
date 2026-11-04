const userService = require('../services/userService');

// Todo 항목 추가
const addTodo = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { content, note } = req.body;
    const todoId = await userService.addTodo(user.email, content, note);
    res.json({ success: true, todoId });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '할 일 추가에 실패했습니다.' });
  }
};

// Todo 삭제
const deleteTodo = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { deletetodoList } = req.body;
    if (!deletetodoList || deletetodoList.length === 0) {
      return res.status(400).json({ success: false, message: '삭제할 항목이 없습니다.' });
    }
    await userService.deleteTodo(user.email, deletetodoList);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '할 일 삭제에 실패했습니다.' });
  }
};

// habit 항목 추가
const addHabit = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { title, category } = req.body;
    const habitId = await userService.addHabit(user.email, title, category);
    res.json({ success: true, habitId });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '습관 추가에 실패했습니다.' });
  }
};

// Habit 수정
const editHabit = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { habitId, title, category } = req.body;
    await userService.editHabit(user.email, habitId, title, category);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '습관 수정에 실패했습니다.' });
  }
};

// Habit 삭제
const deleteHabit = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { habitId } = req.body;
    await userService.deleteHabit(user.email, habitId);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '습관 삭제에 실패했습니다.' });
  }
};

// isCompleted 변동 사항 저장
const saveIsCompleted = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const changes = req.body.changes;
    await userService.saveIsCompleted(user.email, changes);
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '저장에 실패했습니다.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    if (user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: '대학관계자는 학사정보를 수정할 수 없습니다.',
      });
    }

    const { studentId, university, major, doubleMajor, enrollmentStatus, grade } = req.body;

    // 입학년도: 보내지 않으면 그대로 두고, 빈 값이면 지우고, 값이 있으면 4자리 연도만 허용한다.
    let admissionYear;
    if (req.body.admissionYear !== undefined) {
      const raw = String(req.body.admissionYear ?? '').trim();
      admissionYear = raw === '' ? null : Number(raw);
      const currentYear = new Date().getFullYear();
      if (admissionYear !== null && (!Number.isInteger(admissionYear) || admissionYear < 1990 || admissionYear > currentYear + 1)) {
        return res.status(400).json({ success: false, message: `입학년도는 1990~${currentYear + 1} 사이의 4자리 연도로 입력해주세요.` });
      }
    }

    const { universityChanged, clearedLectureCount } = await userService.updateProfile(
      user.email,
      { studentId, university, major, doubleMajor, enrollmentStatus, grade, admissionYear },
    );

    req.session.user = {
      ...req.session.user,
      studentId,
      ...(admissionYear !== undefined ? { admissionYear } : {}),
      university: university?.trim() || '',
      major,
      enrollmentStatus,
      grade: grade !== undefined && grade !== null && String(grade).trim() !== '' ? Number(grade) : req.session.user.grade,
    };

    res.json({ success: true, universityChanged, clearedLectureCount });
  } catch (error) {
    if (error.code === 'SAME_MAJOR') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error.message);
    res.status(500).json({ success: false, message: '프로필 업데이트에 실패했습니다.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const profile = await userService.getProfile(user.email);
    res.json({ success: true, user: profile });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '프로필 조회에 실패했습니다.' });
  }
};

// 수상경력 정보 가져오기
const getMyAwards = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const awards = await userService.getMyAwards(user.email);
    res.json({ success: true, awards });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: '수상경력 조회에 실패했습니다.' });
  }
};

module.exports = { addTodo, deleteTodo, addHabit, editHabit, deleteHabit, saveIsCompleted, updateProfile, getProfile, getMyAwards };
