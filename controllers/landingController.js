const userService = require('../services/userService');

// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림 등)
const getHomePage = async (req, res) => {
  try {
    const user = req.user;

    const todoList = await userService.getTodaytodoList(user.email);
    const {habitList, completedCount} = await userService.getHabitList(user.email);

    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).send('홈페이지 로딩 실패');
  }
};

module.exports = {getHomePage};