const userService = require('../services/userService');


// Todo 항목 추가
const addTodo = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사
    const user = req.session.user;
    if (!user) return res.json({success: false});
    const {content, note} = req.body;
    
    // DB에 추가 + 추가한 todo의 _id 가져오기
    const todoId = await userService.addTodo(user.email, content, note);
    
    console.log('todo 추가 완료!')

    // success가 없으면 추가 취소
    res.json({success: true, todoId});
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }

} // addTodo()

// Todo 삭제
const deleteTodo = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.json({success: false});
    const {deletetodoList} = req.body;
    // 삭제 항목이 없으면 리턴
    if(deletetodoList.length === 0) return res.json({success: false});

    await userService.deleteTodo(user.email, deletetodoList);

    console.log('todo 삭제 완료!!');

    // success가 없으면 삭제 취소
    res.json({success: true});
  } catch (error) {
    console.log('todo 삭제 실패!!');
    console.error(error.message);
    res.json({success: false});
  }

} // deleteTodo()

// habit 항목 추가
const addHabit = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사
    const user = req.session.user;
    if (!user) return res.json({success: false});

    const {title, category} = req.body;
    
    // DB에 추가 + 추가한 habit의 _id 가져오기
    const habitId = await userService.addHabit(user.email, title, category);
    
    console.log('habit 추가 완료!')

    // success가 없으면 추가 취소
    res.json({success: true, habitId});
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }

} // addHabit()

// Habit 수정
const editHabit = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사
    const user = req.session.user;
    if (!user) return res.json({success: false});

    const {habitId, title, category} = req.body;
    
    // DB에 추가 + 추가한 habit의 _id 가져오기
    await userService.editHabit(user.email, habitId, title, category);

    console.log('habit 수정 완료!')

    // success가 없으면 수정 취소
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }
} // editHabit()

// Habit 삭제
const deleteHabit = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사
    const user = req.session.user;
    if (!user) return res.json({success: false});
    const {habitId} = req.body;
    
    // DB에 추가 + 추가한 habit의 _id 가져오기
    await userService.deleteHabit(user.email, habitId);

    console.log('habit 삭제 완료!')

    // success가 없으면 삭제 취소
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }
} // deleteHabit()

// isCompleted 변동 사항 저장
const saveIsCompleted = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사
    const user = req.session.user;
    if (!user) return res.json({success: false});
    const changes = req.body.changes;
    
    // DB에 추가 + 추가한 habit의 _id 가져오기
    await userService.saveIsCompleted(user.email, changes);

    console.log('isCompleted 저장 완료!')

  } catch (error) {
    console.error(error.message);
  }
}

const updateProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.json({ success: false });

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

    console.log('프로필 업데이트 완료!');

    res.json({
      success: true,
      universityChanged,
      clearedLectureCount,
    });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.json({ success: false });

    const profile = await userService.getProfile(user.email);
    res.json({ success: true, user: profile });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false });
  }
};
// 수상경력 정보 가져오기
const getMyAwards = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.json({ success: false });
    const awards = await userService.getMyAwards(user.email);
    res.json({ success: true, awards });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false });
  }
};

module.exports = {addTodo, deleteTodo, addHabit, editHabit, deleteHabit, saveIsCompleted, updateProfile, getProfile, getMyAwards};