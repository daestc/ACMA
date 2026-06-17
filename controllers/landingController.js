const userService = require('../services/userService');
const noticeController = require("../controller/noticeController");
const careerService = require('../services/careerService');


// 홈페이지에 표시할 정보 모음(todoList, 습관 트래커, Dday 알림, 공지사항 등)
const getHomePage = async (req, res) => {
  try {
    const loggedInUser = req.user || req.session?.user;
    if (!loggedInUser) {
      return res.redirect('/login'); 
    }

    //  자격증 리스트 긁어오기
    const myCerts = await careerService.getMyCertifications(loggedInUser.email).catch((err) => {
      console.error(' 자격증 함수 에러:', err.message);
      return []; 
    });

    //  종목 코드 가져오기
    const myTargetCertJmcds = myCerts
        .filter(cert => cert.status === 'target' && cert.certificationId && cert.certificationId.jmcd)
        .map(cert => String(cert.certificationId.jmcd).trim());
    
  
    const showNotice = await noticeController.fetchHomeNotices();

    // 내 자격증 + 학사일정/장학금 공통 공지
    const userCustomNotices = showNotice.filter(notice => {
        if (notice.category === 'certification') {
            return notice.jmcd && myTargetCertJmcds.includes(String(notice.jmcd).trim());
        }
        return true; 
    });

    const user = req.user;
    const todoList = await userService.getTodaytodoList(user.email);
    const {habitList, completedCount} = await userService.getHabitList(user.email);

    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount,
      notices: userCustomNotices, 
      topNotices: userCustomNotices.slice(0, 6), //상위 6개
      urgentNotice: userCustomNotices.filter(n => n.isUrgent === true), 
      myCertNotices: userCustomNotices.filter(n => n.category === 'certification'), 
      pageTitle: '홈'
    });

  } catch (error) {
    console.log('홈페이지 로딩 실패');
    console.error(error);
    res.status(500).send("서버 에러 발생");
  }
};

module.exports = { getHomePage };