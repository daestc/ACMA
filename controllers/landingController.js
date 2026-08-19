const userService = require('../services/userService');
const noticeController = require("../controller/noticeController");
const careerService = require('../services/careerService');
const UniversitySchedule = require('../models/UniversitySchedule'); 

function getDDayLabel(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `종료`;
}

const getHomePage = async (req, res) => {
  try {
    if (req.user?.role === 'staff') {
      return res.redirect('/staff/home');
    }
    if (req.user?.role === 'admin') {
      return res.redirect('/admin/staff');
    }

    const loggedInUser = req.user || req.session?.user;
    if (!loggedInUser) {
      return res.redirect('/login'); 
    }

    const myCerts = await careerService.getMyCertifications(loggedInUser.email).catch((err) => {
      console.error(' 자격증 함수 에러:', err.message);
      return []; 
    });

    const myTargetCertJmcds = myCerts
        .filter(cert => cert.status === 'target' && cert.certificationId && cert.certificationId.jmcd)
        .map(cert => String(cert.certificationId.jmcd).trim());
    
    const showNotice = await noticeController.fetchHomeNotices();

    const userCustomNotices = showNotice.filter(notice => {
        if (notice.category === 'certification') {
            return notice.jmcd && myTargetCertJmcds.includes(String(notice.jmcd).trim());
        }
        return true; 
    });

    const user = req.user;
    const todoList = await userService.getTodaytodoList(user.email);
    const {habitList, completedCount} = await userService.getHabitList(user.email);
    const myCertNotices = userCustomNotices.filter(n => n.category === 'certification');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const examSchedules = [];
    const generalSchedules = [];

    if (user.university) {
        const rawSchedules = await UniversitySchedule.find({
            university: user.university,
            $or: [
                { endDate: { $gte: today } },
                { endDate: null, startDate: { $gte: today } },
                { startDate: { $lte: today }, endDate: { $gte: today } }
            ]
        })
        .sort({ startDate: 1 })
        .lean();

        // 제목에 '고사'나 '시험'이 들어가면 examSchedules, 아니면 generalSchedules로 분류
        rawSchedules.forEach(schedule => {
            const targetDate = schedule.endDate || schedule.startDate;
            const mappedSchedule = {
                ...schedule,
                dDayLabel: getDDayLabel(targetDate)
            };

            if (mappedSchedule.title.includes('고사') || mappedSchedule.title.includes('시험')) {
                examSchedules.push(mappedSchedule);
            } else {
                generalSchedules.push(mappedSchedule);
            }
        });
    }
    
    res.render('pages/home', {
      user,
      todoList,
      habitList,
      completedCount,
      notices: userCustomNotices, 
      topNotices: userCustomNotices.slice(0, 6),
      urgentNotice: userCustomNotices.filter(n => n.isUrgent === true), 
      myCertNotices, 
      ddayCerts: myCertNotices,
      examSchedules,    
      generalSchedules, 
      pageTitle: '홈'
    });

  } catch (error) {
    console.log('홈페이지 로딩 실패');
    console.error(error);
    res.status(500).send("서버 에러 발생");
  }
};

module.exports = { getHomePage };