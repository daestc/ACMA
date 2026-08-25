const careerService = require('../services/careerService');

// 진로 검색db에서 대분류, 중분류, 소분류, 세분류 가져오기
const getCategories = async (req, res) => {
  try {
    const categories = await careerService.getCategories();
    res.json(categories);
    } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// 진로 검색db에서 대분류, 중분류, 소분류, 세분류에 따른 진로 정보 가져오기
const searchCareers = async (req, res) => {
  try {
    const { depth1_name, depth2_name, depth3_name, depth4_name } = req.query;
    const selectedDepths = { depth1_name, depth2_name, depth3_name, depth4_name };
    const hasAnyFilter = Object.values(selectedDepths).some(Boolean);
    if (!hasAnyFilter) {
      return res.json([]);
    }
    const categories = await careerService.getCategories();
    const matchedCategories = categories.filter(cat => {
      return (!depth1_name || cat.depth1_name === depth1_name)
        && (!depth2_name || cat.depth2_name === depth2_name)
        && (!depth3_name || cat.depth3_name === depth3_name)
        && (!depth4_name || cat.depth4_name === depth4_name);
    });
    const categoryIds = [...new Set(matchedCategories.map(cat => cat.categoryId).filter(Boolean))];
    if (!categoryIds.length) {
      return res.json([]);
    }
    const careerLists = await Promise.all(
      categoryIds.map(categoryId => careerService.searchCareers(null, categoryId))
    );
    const mergedCareers = [];
    const seenCodes = new Set();
    careerLists.flat().forEach(career => {
      if (!career.jobCode || seenCodes.has(career.jobCode)) return;
      seenCodes.add(career.jobCode);
      mergedCareers.push(career);
    });
    res.json(mergedCareers);
  } catch (error) {
    console.error('Error searching careers:', error);
    res.status(500).json({ error: 'Failed to search careers' });
  }
};
// 전체 직무를 한 번에 모아오는 용도(/career/search-all) — 사용자가 카테고리를
// 고르지 않고도 진입 즉시 전체 직무를 보고 실시간으로 검색/필터할 수 있게 해달라는
// 요청으로 추가했다. searchCareers(선택한 카테고리만)와 달리 존재하는 모든
// categoryId에 대해 외부 Work24 오픈 API를 카테고리 단위로 호출해서 병합한다 — 이
// 외부 API 자체가 카테고리 없이 "전체"를 한 번에 주는 엔드포인트가 없어서(searchCareers
// 참고: categoryId가 필수) 이 방법 말고는 진짜 "전체 직무"를 가져올 수단이 없다.
// 카테고리 수가 많을 수 있어(정확한 개수는 DB에 있는 값이라 코드만으로는 알 수 없음)
// 동시 요청 수를 제한하고, 개별 카테고리 실패는 건너뛰고 계속 진행한다. 매 요청마다
// 카테고리 수만큼 외부 API를 다시 부르면 느리고 부담이 커서, 결과를 서버 메모리에
// 잠깐(10분) 캐시해 재방문 시 즉시 응답하게 했다 — 서버 재시작 전까지만 유지되는
// 캐시라 운영 환경에서는 Redis 등으로 바꾸는 게 맞지만, 지금 규모에선 충분하다.
let allCareersCache = null; // { data, fetchedAt }
const ALL_CAREERS_CACHE_MS = 10 * 60 * 1000;

const searchAllCareers = async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    if (!force && allCareersCache && (Date.now() - allCareersCache.fetchedAt) < ALL_CAREERS_CACHE_MS) {
      return res.json({ items: allCareersCache.data, total: allCareersCache.data.length, cached: true });
    }

    const categories = await careerService.getCategories();
    const categoryIds = [...new Set(categories.map(cat => cat.categoryId).filter(Boolean))];

    const CONCURRENCY = 8;
    const collected = [];
    let cursor = 0;
    let failedCount = 0;

    async function worker() {
      while (cursor < categoryIds.length) {
        const categoryId = categoryIds[cursor++];
        try {
          const items = await careerService.searchCareers(null, categoryId);
          collected.push(...items);
        } catch (err) {
          failedCount++;
          console.error(`전체 직무 로딩 중 categoryId=${categoryId} 실패:`, err.message);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, categoryIds.length) }, worker));

    const seenCodes = new Set();
    const merged = [];
    collected.forEach(career => {
      if (!career.jobCode || seenCodes.has(career.jobCode)) return;
      seenCodes.add(career.jobCode);
      merged.push(career);
    });

    allCareersCache = { data: merged, fetchedAt: Date.now() };
    res.json({ items: merged, total: merged.length, categoryCount: categoryIds.length, failedCount, cached: false });
  } catch (error) {
    console.error('전체 직무 검색 에러:', error);
    res.status(500).json({ error: 'Failed to fetch all careers' });
  }
};

// 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
const getCareerDetails = async (req, res) => {
  try {
    const { jobCode } = req.params;
    const { seq='1' } = req.query; // seq는 선택적으로 받을 수 있음
    if (!jobCode) {
      return res.status(400).json({ error: 'Job code is required' });
    }

    const data = await careerService.getCareerDetails(jobCode, seq);
    if (!data) {
      return res.status(404).json({ error: 'Career details not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching career details:', error);
    res.status(500).json({ error: 'Failed to fetch career details' });
  }
};

// 저장 버튼용 - DB 저장
const saveCareerDetails = async (req, res) => {
  try {
    if (!req.session.user || (!req.session.user._id && !req.session.user.email)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { status } = req.body;
    const data = await careerService.saveCareerDetails(req.params.jobCode, req.session.user, status);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error saving career details:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to save career details' });
  }
};
// 현재 선택한 직무 정보 가져오기
const getMyCareer=async(req,res)=>{
  try {
    if (!req.session.user || (!req.session.user._id && !req.session.user.email)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const data = await careerService.getMyCareer(req.session.user);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching my career:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to fetch my career' });
  }
}

// 자격증 검색 db에서 대분류, 중분류, 자격증 정보 가져오기
const getCertCategories = async (req, res) => {
  try {
    const categories = await careerService.getCertCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching certification categories:', error);
    res.status(500).json({ error: 'Failed to fetch certification categories' });
  }
};
// 분류에 따른 자격증 목록 가져오기
const searchCertifications = async (req, res) => {
  try {
    const { field1, field2, seriesName, keyword } = req.query;
    const certs = await careerService.searchCertifications(field1, field2, seriesName, keyword);
    res.json(certs);
  } catch (error) {
    console.error('Error searching certifications:', error);
    res.status(500).json({ error: 'Failed to search certifications' });
  }
};
// 자격증 선택 저장
const saveCertification = async (req, res) => {
  try {
    const { jmcd, name, status } = req.body;
    if (!jmcd || !name) {
      return res.status(400).json({ error: 'jmcd and name are required' });
    }
    
    // 사용자 인증 확인
    if (!req.session.user || (!req.session.user._id && !req.session.user.email)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.session.user._id || req.session.user.email;
    const userCert = await careerService.saveCertification(jmcd, userId, status);
    if (!userCert) {
      return res.status(404).json({ error: 'Certification not found' });
    }
    res.json({ success: true, message: '자격증이 저장되었습니다.', data: userCert });
  } catch (error) {
    console.error('Error saving certification:', error);
    res.status(500).json({ error: 'Failed to save certification' });
  }
};
// 자격증 별 합격률 DB에서 합격률 정보 가져오기
const getPassRate = async (req, res) => {
  try {
    const { jmcd } = req.params;
    if (!jmcd) {
      return res.status(400).json({ error: 'jmcd is required' });
    }
    const passRates = await careerService.getPassRate(jmcd);
    res.json(passRates || []);
  } catch (error) {
    console.error('Error fetching pass rate:', error);
    res.status(500).json({ error: 'Failed to fetch pass rate' });
  }
};
// 현재 선택한 자격증 목록 가져오기
const getMyCertifications = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.email;
    const certs = await careerService.getMyCertifications(userId);
    res.json(certs);
  } catch (error) {
    console.error('Error fetching user certifications:', error);
    res.status(500).json({ error: 'Failed to fetch user certifications' });
  }
};

// 선택한 자격증 삭제하기
const removeCertification = async (req, res) => {
  try {
    const { userCertId } = req.params;
    if (!userCertId) {
      return res.status(400).json({ error: 'userCertId is required' });
    }

    const userId = req.session.user._id || req.session.user.email;
    const result = await careerService.deleteCertification(userCertId, userId);
    
    res.json({ success: true, message: '자격증이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error removing certification:', error);
    if (error.message === 'User not found') {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (error.message === 'User certification not found') {
      return res.status(404).json({ error: 'User certification not found' });
    }
    res.status(500).json({ error: 'Failed to remove certification' });
  }
};

// 현재 선택한 직무 목록 가져오기
const getMyJobs = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.email;
    const jobs = await careerService.getMyJobs(userId);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch user jobs' });
  }
};

// 선택한 직무 삭제하기
const removeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const userId = req.session.user._id || req.session.user.email;
    const result = await careerService.deleteJob(jobId, userId);
    
    res.json({ success: true, message: '직무가 삭제되었습니다.' });
  } catch (error) {
    console.error('Error removing job:', error);
    if (error.message === 'User not found') {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (error.message === 'User job not found') {
      return res.status(404).json({ error: 'User job not found' });
    }
    res.status(500).json({ error: 'Failed to remove job' });
  }
};

//선택한 목표 직무와 모든 자격증 프로필 상단에 표시하기
const getMyCareerAndCertifications = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.email;
    const { targetJob, certs } = await careerService.getMyCareerAndCertifications(userId);
    res.json({
      success: true,
      career: targetJob,
      certifications: certs,
    });
  } catch (error) {
    console.error('Error fetching career and certifications:', error);
    res.status(500).json({ error: 'Failed to fetch career and certifications' });
  }
};

module.exports = {
  getCategories,
  searchCareers,
  searchAllCareers,
  getCareerDetails,
  saveCareerDetails,
  getMyCareer,
  getCertCategories,
  searchCertifications,
  saveCertification,
  getPassRate,
  getMyCertifications,
  removeCertification,
  getMyJobs,
  removeJob,
  getMyCareerAndCertifications
};