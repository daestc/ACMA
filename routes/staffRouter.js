const express = require('express');
const { requireStaff } = require('../middleware/auth');
const { uploadLectureCsv } = require('../config/upload');
const lectureController = require('../controllers/lectureAdminController');
const staffController = require('../controllers/staffController');
const suggestionController = require('../controllers/suggestionController');

const router = express.Router();

router.use(requireStaff);

router.get('/home', staffController.getHomePage);// 대학관계자 홈 페이지
router.get('/home/data', staffController.getHomeData);// 홈 대시보드 (JSON, React용)

router.get('/lectures', lectureController.getLecturePage);// 강의 관리 페이지
router.get('/lectures/list', lectureController.getLectureData);// 강의 목록 (JSON, React용)
router.post('/lectures', lectureController.postLecture);// 강의 등록 (기존 EJS 폼)
// React 폼 전용 별칭 경로. GET '/lectures'가 이제 React SPA 라우트라서, vite.config.js에서
// '/lectures' 경로를 통째로 프록시할 수 없다(그러면 새로고침 시 GET도 백엔드 EJS 렌더로
// 가로채여 버림) — 그래서 POST만 다른 경로로 노출해서 그 경로만 프록시한다. 컨트롤러
// 로직은 완전히 동일(postLecture 재사용), 그냥 진입 경로만 하나 더 열어주는 것.
router.post('/lectures/create', lectureController.postLecture);// 강의 등록 (React 폼)
router.post('/lectures/csv', ...uploadLectureCsv, lectureController.postLectureCsv);// 강의 엑셀 업로드
router.delete('/lectures/:id', lectureController.deleteLecture);// 강의 삭제

router.get('/schedules', staffController.getSchedulePage);// 일정 관리 페이지
router.get('/schedules/list', staffController.getScheduleData);// 일정 목록 (JSON, React용)
router.post('/schedules', staffController.postSchedule);// 일정 등록 (기존 EJS 폼)
router.post('/schedules/create', staffController.postSchedule);// 일정 등록 (React 폼) — 위 lectures/create와 동일한 이유
router.delete('/schedules/:id', staffController.deleteSchedule);// 일정 삭제

router.get('/graduation', staffController.getGraduationPage);// 졸업요건 관리 페이지
router.get('/graduation/data', staffController.getGraduationData);// 졸업요건 설정 데이터 (JSON, React용)
router.post('/graduation', staffController.saveGraduation);// 졸업요건 저장 (기존 EJS 폼)
router.post('/graduation/save', staffController.saveGraduation);// 졸업요건 저장 (React 폼) — 위와 동일한 이유
router.get('/graduation/majors', staffController.getMajorList);// 전공 목록 조회
router.get('/graduation/majors/:major', staffController.getMajorGraduation);// 전공 졸업요건 조회
router.post('/graduation/majors', staffController.saveMajorGraduation);// 전공 졸업요건 저장

router.get('/suggestions', suggestionController.getStaffPage);// 학생 건의 관리
// '/suggestions/list'는 리터럴 경로라서 아래 '/suggestions/:id' 파라미터 라우트보다
// 먼저 등록해야 한다 — 안 그러면 Express가 "list"를 id로 오인해서 매칭해버림.
router.get('/suggestions/list', suggestionController.getStaffSuggestionsData);// 건의 목록 (JSON, React용)
router.get('/suggestions/:id', suggestionController.getStaffSuggestionDetail);// 건의 상세
router.post('/suggestions/:id/reply', suggestionController.replySuggestion);// 건의 답변

router.get('/students', staffController.getStudentsPage);// 학생 관리 페이지
// 마찬가지로 '/students/list'는 '/students/:id'보다 먼저 등록해야 한다.
router.get('/students/list', staffController.getStudentsData);// 학생 목록 (JSON, React용)
router.get('/students/:id', staffController.getStudentDetail);// 학생 상세 조회 (JSON)
router.patch('/students/:id/status', staffController.suspendStudent);// 계정 상태 변경
router.delete('/students/:id', staffController.deleteStudent);// 계정 삭제
router.post('/students/:id/reset-password', staffController.resetStudentPassword);// 비밀번호 초기화

module.exports = router;
