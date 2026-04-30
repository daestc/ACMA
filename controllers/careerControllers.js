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
    const { major, grade, category } = req.query;
    const careers = await careerService.searchCareers(major, grade, category);
    res.json(careers);
  } catch (error) {
    console.error('Error searching careers:', error);
    res.status(500).json({ error: 'Failed to search careers' });
  }
};



module.exports={getCategories, searchCareers};