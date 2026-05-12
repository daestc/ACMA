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

const addTodo = async (req, res) => {
  try {
    const {content, note} = req.body;
    await userService.addTodo(user.email, content, note);
    
    console.log('todo 추가 완료!')

    // success가 없으면 화면에 표시 X
    res.json({success: true});
  } catch (error) {
    console.error(error.message);
    res.json({success: false});
  }

} // addTodo()

module.exports = {addTodo};