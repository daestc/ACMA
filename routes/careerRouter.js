const express = require('express');
const router = express.Router();
const careerController = require('../controllers/careerController');

// 로그인 여부 체크 미들웨어 (임시 — JWT/세션 연동 시 교체)
function requireLogin(req, res, next) {
  // TODO: JWT 검증 후 req.user 세팅
  // 현재는 더미 유저로 통과
  req.user = {
    name: '김민준',
    major: '컴퓨터공학과',
    grade: 3,
    email: 'minkim@korea.ac.kr',
  };
  next();
}

// 진로정보 페이지 
router.get('/', requireLogin, (req, res) => {
  res.render('pages/career', {
    title:       '진로정보',
    currentPage: 'career',
    pageTitle:   '💼 진로정보',
    user:        req.user,
  });
});
// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
router.get('/categories', careerController.getCategories);
// 진로 검색db에서 대분류, 중분류, 소분류에 따른 직무 이름 가져오기
router.get('/search', careerController.searchCareers);
// 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
router.get('/detail/:jobCode', careerController.getCareerDetails);
// 직무 선택하여 db에 저장하기 
router.post('/save/:jobCode', careerController.saveCareerDetails);
// 자격증 검색 db에서 대분류, 중분류, 시리즈이름 가져오기
router.get('/cert-categories', careerController.getCertCategories);
// 분류에 따른 자격증 목록 가져오기
router.get('/search-cert', careerController.searchCertifications);
// 자격증 선택 저장
router.post('/save-cert', careerController.saveCertification);


module.exports = router;