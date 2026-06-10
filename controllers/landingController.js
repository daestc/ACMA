const userService = require('../services/userService');
const noticeController = require("../controller/noticeController");
const careerService = require('../services/careerService');

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
    
    const loggedInUser = req.user || req.session?.user;
    if (!loggedInUser) {
      return res.redirect('/login'); 
    }

    //자격증 리스트 긁어오기
    const myCerts = await careerService.getMyCertifications(loggedInUser.email).catch((err) => {
      console.error(' 자격증 함수 에러:', err.message);
      return []; 
    });

    //종목 코드 가져오기
    const myTargetCertJmcds = myCerts
        .filter(cert => cert.status === 'target' && cert.certificationId && cert.certificationId.jmcd)
        .map(cert => cert.certificationId.jmcd);
    
    //전체 공지 가공 데이터
    const showNotice = await noticeController.fetchHomeNotices();

    const myCertNotices = showNotice.filter(notice => {
          return notice.category === 'certification' && 
          notice.jmcd &&
          myTargetCertJmcds.includes(notice.jmcd); 
    });


    const user = req.user;

    const todoList = await userService.getTodaytodoList(user.email);
    const {habitList, completedCount} = await userService.getHabitList(user.email);

    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount,
      notices: showNotice,
      topNotices: showNotice.slice(0,6), //d-day 기준 상위 6개
      urgentNotice: showNotice.filter(n => n.isUrgent === true),
      myCertNotices: myCertNotices,
      pageTitle: '홈'
    });

  } catch (error) {
    console.log('홈페이지 로딩 실패');
    console.error(error);
  }
};


module.exports = {getHomePage};