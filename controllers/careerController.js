const careerService = require('../services/careerService');

// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
const getCategories = async (req, res) => {
  try {
    const categories = await careerService.getCategories();
    res.json(categories);
    } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// 진로 검색db에서 대분류, 중분류, 소분류에 따른 진로 정보 가져오기
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
  const data = await careerService.saveCareerDetails(req.params.jobCode);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, data });
};
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

module.exports = {
  getCategories,
  searchCareers,
  getCareerDetails,
  saveCareerDetails,
  getCertCategories
};