const {JobSearch} = require('../models/Certifications_jobs');
const { parseStringPromise } = require('xml2js');

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

    const searchCode = encodeURIComponent(categoryId); // categoryId는 외부 API의 고유 ID로 사용
    const serviceKey = process.env.service_key;

    if (!serviceKey) {
      throw new Error('service_key is not configured');
    }

    const careerAPI = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212L50.do?authKey=${serviceKey}&returnType=XML&target=dJobCD&startPage=1&display=50&srchType=J&stdJobCl=${searchCode}`;

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

// "전산(99)/창의력(98)/..." → ['전산', '창의력', ...]
function parseSlashList(str) {
  return str?.split('/')
    .map(s => s.replace(/\(\d+\)/, '').trim())
    .filter(Boolean) || [];
}

// relMajorList, relJobList: 1개면 객체, 여러 개면 배열
function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// sal 문자열 파싱
// "조사년도:2023년, 임금 하위(25%) 5750만원, 평균(50%) 8150만원, 상위(25%) 12000만원"
function parseSalary(salStr) {
  const lower = salStr?.match(/하위\(25%\)\s*([\d]+)만원/)?.[1];
  const median = salStr?.match(/평균\(50%\)\s*([\d]+)만원/)?.[1];
  const upper = salStr?.match(/상위\(25%\)\s*([\d]+)만원/)?.[1];
  return {
    lower25:  lower  ? Number(lower)  * 10000 : 0,
    median50: median ? Number(median) * 10000 : 0,
    upper25:  upper  ? Number(upper)  * 10000 : 0,
  };
}
// 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
async function getCareerDetails(jobCode) {
  try {
    const jobcode=encodeURIComponent(jobCode);
    const serviceKey = process.env.service_key;

    if (!serviceKey) {
      throw new Error('service_key is not configured');
    }
    // API 설정 (직업코드로 상세 정보 조회)
    const careerDetailAPI = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212D05.do?authKey=${serviceKey}&returnType=XML&target=JOBDTL&jobGb=1&jobCd=${jobcode}&dtlGb=1`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/xml, text/xml, */*;q=0.01',
      'Referer': 'https://www.work24.go.kr/',
      'Origin': 'https://www.work24.go.kr'
    };
    // API 호출
    const response = await fetch(careerDetailAPI, { headers });
    // API 응답 처리
    const responseText = await response.text();
    if (!response.ok) {
      console.warn('External API non-OK:', response.status, responseText.substring(0, 500));
      return null;
    }
    // XML 파싱 및 직무 상세 정보 추출
    const parsed = await parseStringPromise(responseText, { explicitArray: false, trim: true });
    const job = parsed?.jobSum;
    if (!job) {
      console.warn('No job detail found for jobCode:', jobCode);
      return null;
    }
    return {
      title:              job.jobSmclNm || '',
      description:        job.jobSum || '',
      waysToAcquire:      job.way?.split('. ').map(s => s.trim()).filter(Boolean) || [],
      abilities:          parseSlashList(job.jobAbil),
      knowledge:          parseSlashList(job.knowldg),
      characteristics:    parseSlashList(job.jobChr),
      relatedOccupations: toArray(job.relJobList).map(j => j.jobNm),
      relatedDepartments: toArray(job.relMajorList).map(m => m.majorNm),
      averageSalary:      parseSalary(job.sal),
      relatedCertifications: toArray(job.relCertList).map(c => c.certNm).filter(Boolean)
    };

  } catch (error) {
    console.error('Error fetching career details:', error);
    throw new Error('Failed to fetch career details');
  }
}

module.exports = {
  getCategories,
  searchCareers,
  getCareerDetails
};
