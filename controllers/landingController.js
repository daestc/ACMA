const userService = require('../services/userService');

// #더미. 나중에 session에서 가져옴
const user = {
  name: '가나다',
  email: 'abc@test.com',
  major: '컴공',
  grade: 4,

};

// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림 등)
const getHomePage = async (req, res) => {
  // #후순위 
  const todolist = await userService.getTodayTodolist(user.email); 
  res.render('pages/home', {
    user,
    todolist
  });
};

module.exports = {getHomePage};