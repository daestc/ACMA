const express = require('express');
const router = express.Router();
const careerController = require('../controllers/careerController');
const { requireLogin } = require('../middleware/auth');

// 진로정보 페이지 
router.get('/', requireLogin, (req, res) => {
  res.render('pages/career', {
    title:       '진로정보',
    currentPage: 'career',
    pageTitle:   '💼 진로정보',
    user:        req.user,
  });
});
// 채용정보 페이지 (화면 확인용, 백엔드 미연동)
router.get('/recruit', requireLogin, (req, res) => {
  res.render('pages/recruit', {
    title:       '채용정보',
    currentPage: 'recruit',
    pageTitle:   '📋 채용정보',
    user:        req.user,
  });
});

// 직무 관련 라우터
// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
router.get('/categories', careerController.getCategories);
// 진로 검색db에서 대분류, 중분류, 소분류에 따른 직무 이름 가져오기
router.get('/search', careerController.searchCareers);
// 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
router.get('/detail/:jobCode', careerController.getCareerDetails);
// 직무 선택하여 db에 저장하기 
router.post('/save/:jobCode', requireLogin, careerController.saveCareerDetails);
// 현재 선택한 직무 정보 가져오기
router.get('/my-career', requireLogin, careerController.getMyCareer);
// 현재 선택한 직무 목록 가져오기
router.get('/my-jobs', requireLogin, careerController.getMyJobs);
// 직무 삭제하기
router.delete('/remove-job/:jobId', requireLogin, careerController.removeJob);

// 자격증 관련 라우터
// 자격증 검색 db에서 대분류, 중분류, 시리즈이름 가져오기
router.get('/cert-categories', careerController.getCertCategories);
// 분류에 따른 자격증 목록 가져오기
router.get('/search-cert', careerController.searchCertifications);
// 자격증 선택 저장
router.post('/save-cert',requireLogin ,careerController.saveCertification);
// 자격증 합격률 가져오기
router.get('/pass-rate/:jmcd', careerController.getPassRate);
// 현재 선택한 자격증 목록 가져오기
router.get('/my-certs', requireLogin, careerController.getMyCertifications);
// 자격증 삭제하기
router.delete('/remove-cert/:userCertId', requireLogin, careerController.removeCertification);

// 현재 선택한 목표 직무와 목표 자격증 프로필 상단에 표시하기
router.get('/my-career-and-certs', requireLogin, careerController.getMyCareerAndCertifications);

module.exports = router;