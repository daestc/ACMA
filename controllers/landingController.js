const userService = require('../services/userService');

const user = {
  name: '가나다',
  email: 'abc@naver.com',
  major: '컴공1',
  grade: 4,
  todolist: [
    {
      title: '과제-분산객체 프로젝트',
      note: 'ERD 정의',
      doDay: Date.now
    }
  ]

};

// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림 등)
const getHomePage = async (req, res) => {
  const todolist = await userService.getTodayTodolist(user.email);
  res.render('pages/home', {
    user,
    // #더미. 나중에 todolist로 변경
    todolist: user.todolist
  });
};

module.exports = {getHomePage};