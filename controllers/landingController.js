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
  try {
    // #후순위 user.email -> userId
  
    // todoList 가져오기
    const todoList = await userService.getTodaytodoList(user.email);
    // habitList, completedCount 가져오기
    const {habitList, completedCount} = await userService.getHabitList(user.email);
  
    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount
    });
    
  } catch (error) {
    console.log('홈페이지 로딩 실패');
    console.error(error.massage);
  }
};

module.exports = {getHomePage};