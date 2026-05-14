const userService = require('../services/userService');

const user = {
  name: '가나다',
  email: 'abc@test.com',
  major: '컴공1',
  todolist: [
    {
      title: '과제-분산객체 프로젝트',
      note: 'ERD 정의',
      doDay: Date.now
    }
  ]

};

// Todo 항목 추가
const addTodo = async (req, res) => {
  try {
    // #후순위 유저 유효성 검사

    const {content, note} = req.body;
    
    // DB에 추가 + 추가한 todo의 _id 가져오기
    const todoId = await userService.addTodo(user.email, content, note);
    
    console.log('todo 추가 완료!')

    // success가 없으면 화면에 표시 X
    res.json({success: true, todoId});
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }

} // addTodo()

// Todo 삭제
const deleteTodo = async (req, res) => {
  try {
    const {deleteTodoList} = req.body;
    // 삭제 항목이 없으면 리턴
    if(deleteTodoList.length === 0) return res.json({success: false});

    await userService.deleteTodo(user.email, deleteTodoList);

    console.log('todo 삭제 완료!!');

    // success가 없으면 화면에 표시 X
    res.json({success: true});
  } catch (error) {
    console.log('todo 삭제 실패!!');
    console.error(error.message);
    res.json({success: false});
  }

} // deleteTodo()

module.exports = {addTodo, deleteTodo};