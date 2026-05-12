const userService = require('../services/userService');

const user = {
  name: '가나다',
  email: 'abc@test.com',
  major: '컴공',
  grade: 4,

};

// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림 등)
const getHomePage = async (req, res) => {
  const todolist = await userService.getTodayTodolist(user.email); 
  res.render('pages/home', {
    user,
    // #더미. 나중에 todolist로 변경
    todolist
  });
};

module.exports = {getHomePage};