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

    const { studentId, university, major, enrollmentStatus, grade } = req.body;
    const { universityChanged, clearedLectureCount } = await userService.updateProfile(
      user.email,
      { studentId, university, major, enrollmentStatus, grade },
    );

    req.session.user = {
      ...req.session.user,
      studentId,
      university: university?.trim() || '',
      major,
      enrollmentStatus,
      grade: grade !== undefined && grade !== null && String(grade).trim() !== '' ? Number(grade) : req.session.user.grade,
    };

    res.json({ success: true, universityChanged, clearedLectureCount });
  } catch (error) {
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
