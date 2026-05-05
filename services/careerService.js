const {JobSearch} = require('../models/Certifications_jobs');

// 진로 검색db에서 대분류, 중분류, 소분류 가져오기
async function getCategories() {
  try {
    const categories = await JobSearch.find().select('depth1_name depth2_name depth3_name depth4_name categoryId').lean();
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }
}

// api 에서 선택한 대분류, 중분류, 소분류에서 검색한 모든 세분류의 진로 정보 가져오기
async function searchCareers(depth4, categoryId) {
  try {
    if (!categoryId) return [];

    const searchCode = categoryId; // categoryId는 외부 API의 고유 ID로 사용
    const serviceKey = process.env.service_key;

    if (!serviceKey) {
      throw new Error('service_key is not configured');
    }

    const careerAPI = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212L50.do?authKey=${encodeURIComponent(serviceKey)}&returnType=XML&target=dJobCD&startPage=1&display=10&srchType=J&stdJobCl=${encodeURIComponent(searchCode)}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/xml, text/xml, */*;q=0.01',
      'Referer': 'https://www.work24.go.kr/',
      'Origin': 'https://www.work24.go.kr'
    };

    const response = await fetch(careerAPI, { headers });
    const responseText = await response.text();

    if (!response.ok) {
      console.warn('External API responded with non-OK status:', response.status);
      console.warn('External API response snippet:', responseText.substring(0, 500));
      return [];
    }

    const { parseStringPromise } = require('xml2js');
    const parsed = await parseStringPromise(responseText, { explicitArray: false, trim: true });

    const collectJobs = (node, acc = []) => {
      if (!node || typeof node !== 'object') return acc;

      if (Array.isArray(node)) {
        node.forEach(item => collectJobs(item, acc));
        return acc;
      }

      if (node.jobCd || node.jobNm || node.jobNmKor || node.dJobNm) {
        acc.push(node);
        return acc;
      }

      Object.values(node).forEach(value => collectJobs(value, acc));
      return acc;
    };

    const jobItems = collectJobs(parsed);
    const uniqueJobs = new Map();

    jobItems.forEach(item => {
      const jobCode = item.jobCd || item.dJobCd || '';
      if (!jobCode || uniqueJobs.has(jobCode)) return;

      uniqueJobs.set(jobCode, {
        jobCode,
        jobName: item.jobNm || item.jobNmKor || item.dJobNm || '',
        jobCategory: searchCode,
        jobDescription: item.jobCont || item.jobDesc || item.dJobDtl || ''
      });
    });

    return Array.from(uniqueJobs.values());
  } catch (error) {
    console.error('Error searching careers:', error);
    throw new Error('Failed to search careers');
  }
}

module.exports = {
  getCategories,
  searchCareers
};