const userService = require('../services/userService');
const Notice = require("../models/Notice");


// #더미. 나중에 session에서 가져옴
const user = {
  name: '가나다',
  email: 'abc@test.com',
  major: '컴공',
  grade: 4,

};

//홈페이지에 보여줄 공지사항 데이터 긁어오기
async function fetchAllData(){
  try {
    // 마감일(endDate) 임박순으로 정렬해서 게시된 공지사항 가져오기
    return await Notice.find({ isPublished: true }).sort({ endDate: 1 });
  } catch (err) {
    console.error("fetchAllData 에러:", err.message);
    return [];
  }
}

// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림, ㄱ공지사항 등)
const getHomePage = async (req, res) => {
  try {
    //공지사항 데이터 조회
    const showNotice = await fetchAllData();

    // #후순위 user.email -> userId
  
    // todoList 가져오기
    const todoList = await userService.getTodaytodoList(user.email);
    // habitList, completedCount 가져오기
    const {habitList, completedCount} = await userService.getHabitList(user.email);
  
    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount,
      notices: showNotice,
      topNotices: showNotice.slice(0,6), //d-day 기준 상위 6개
      urgentNotice: showNotice.filter(n => n.isUrgent === true),
      pageTitle: '홈'
    });
    
  } catch (error) {
    console.log('홈페이지 로딩 실패');
    console.error(error);
  }
};

module.exports = {getHomePage};