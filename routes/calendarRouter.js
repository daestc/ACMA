const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  // TODO: JWT 검증 후 req.user 세팅
  // 현재는 더미 유저로 통과
  req.user = {
    id:   '000000000000000000000001',         //id 추가
    name: '김민준',
    major: '컴퓨터공학과',
    grade: 3,
    email: 'minkim@korea.ac.kr',
  };
  next();
}

// 캘린더 페이지
router.get('/', requireLogin, (req, res) => {
  res.render('pages/calendar', {
    title:       '캘린더',
    currentPage: 'calendar',
    pageTitle:   '📅 캘린더',
    user:        req.user,
  });
});

//일정
router.get('/events',requireLogin, calendarController.getEventsList)//사용자의 일정 정보를 서비스에 요청
router.post('/events/', requireLogin, calendarController.createEvent); //사용자가 입력한 일정저장을 서비스에 요청
router.put('/events/:eventId',requireLogin, calendarController.updatedEvent);//일정 수정
router.delete('/events/:eventId', requireLogin, calendarController.deletedEvent);

//시간표
router.get('/timetables', requireLogin, calendarController.getTimetableList); //시간표 가져오기
router.post('/timetables',requireLogin, calendarController.createTimetable); //시간표 생성
router.put('/timetables/:timetableId', requireLogin, calendarController.updatedTimetable); //시간표 수정
router.delete('/timetables/:timetableId', requireLogin, calendarController.deletedTimetable); //시간표 삭제

module.exports = router;