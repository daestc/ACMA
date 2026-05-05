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
    const { depth1_name, depth2_name, depth3_name } = req.query;
    const selectedDepths = { depth1_name, depth2_name, depth3_name };

    const hasAnyFilter = Object.values(selectedDepths).some(Boolean);
    if (!hasAnyFilter) {
      return res.json([]);
    }

    const categories = await careerService.getCategories();
    const matchedCategories = categories.filter(cat => {
      return (!depth1_name || cat.depth1_name === depth1_name)
        && (!depth2_name || cat.depth2_name === depth2_name)
        && (!depth3_name || cat.depth3_name === depth3_name);
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



module.exports={getCategories, searchCareers};