const {JobSearch} = require('../models/Certifications_jobs');

// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
async function getCategories() {
  try {
    const categories = await JobSearch.find().select('depth1_name depth2_name depth3_name -_id').lean();
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }
}

// 진로 검색db에서 대분류, 중분류, 소분류에 따른 진로 정보 가져오기
async function searchCareers(major, grade, category) {
  try {
    const query = {};
    if (major) query.major = major;
    if (grade) query.grade = grade;
    if (category) query.category = category;
    const careers = await JobSearch.find(query).lean(); //lean()으로 순수 JS 객체로 반환하여 성능 향상
    return careers;
  } catch (error) {
    console.error('Error searching careers:', error);
    throw new Error('Failed to search careers');
  }
}

module.exports = {
  getCategories,
  searchCareers
};