const userService = require('../services/userService');

const user = {
  name: '가나다',
  email: 'abc@test.com',
  major: '컴공1'
};

// Todo 항목 추가
const addTodo = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사

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
    const changes = req.body.changes;
    
    // DB에 추가 + 추가한 habit의 _id 가져오기
    await userService.saveIsCompleted(user.email, changes);

    console.log('isCompleted 저장 완료!')

  } catch (error) {
    console.error(error.message);
  }
}

module.exports = {addTodo, deleteTodo, addHabit, editHabit, deleteHabit, saveIsCompleted};