const {JobSearch} = require('../models/Certifications_jobs');
const {Job} = require('../models/Certifications_jobs');
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

// api 에서 선택한 대분류, 중분류, 소분류에서 검색한 모든 세분류의 직무 이름 가져오기
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
        jobSeq:  item.dJobCdSeq || '1',
        jobName: item.dJobNm || '',
        jobCategory: searchCode
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

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/xml, text/xml, */*;q=0.01',
  'Referer': 'https://www.work24.go.kr/',
  'Origin': 'https://www.work24.go.kr'
};

// 1차 API: jobSum (능력, 지식, 성격, 연봉, 학과 등)
async function fetchPrimaryJobAPI(jobCode) {
  const serviceKey = process.env.service_key;
  if (!serviceKey) throw new Error('service_key is not configured');

  const url = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212D05.do?authKey=${serviceKey}&returnType=XML&target=JOBDTL&jobGb=1&jobCd=${encodeURIComponent(jobCode)}&dtlGb=1`;

  const response = await fetch(url, { headers: COMMON_HEADERS });
  const responseText = await response.text();

  if (!response.ok) {
    console.warn('Primary API non-OK:', response.status, responseText.substring(0, 500));
    return null;
  }

  const parsed = await parseStringPromise(responseText, { explicitArray: false, trim: true });
  return parsed?.jobSum || null;
}

// 2차 API: dJobsSum (직무 개요, 주요 업무, 풍부한 자격증 목록)
async function fetchSecondaryJobAPI(jobCode, jobSeq = '1') {
  const serviceKey = process.env.service_key;
  if (!serviceKey) throw new Error('service_key is not configured');

  const url = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212D50.do?authKey=${serviceKey}&returnType=XML&target=dJobDTL&dJobCd=${encodeURIComponent(jobCode)}&dJobCdSeq=${encodeURIComponent(jobSeq)}`;

  const response = await fetch(url, { headers: COMMON_HEADERS });
  const responseText = await response.text();

  if (!response.ok) {
    console.warn('Secondary API non-OK:', response.status, responseText.substring(0, 500));
    return null;
  }

  const parsed = await parseStringPromise(responseText, { explicitArray: false, trim: true });
  return parsed?.dJobsSum || null;
}
// 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
async function getCareerDetails(jobCode, jobSeq = '1') {
  try {
    // 두 API 병렬 호출
    const [primary, secondary] = await Promise.all([
      fetchPrimaryJobAPI(jobCode),
      fetchSecondaryJobAPI(jobCode, jobSeq),
    ]);

    if (!primary && !secondary) {
      console.warn('No job detail found for jobCode:', jobCode);
      return null;
    }

    return {
      title:              primary?.jobSmclNm || secondary?.dJobNm || '',
      description:        primary?.jobSum || secondary?.workSum || '',
      
      // 주요 업무 (2차 API의 doWork)
      responsibilities:   secondary?.doWork
                            ?.split('. ').map(s => s.trim()).filter(Boolean) || [],
      
      waysToAcquire:      primary?.way?.split('. ').map(s => s.trim()).filter(Boolean) || [],
      abilities:          parseSlashList(primary?.jobAbil),
      knowledge:          parseSlashList(primary?.knowldg),
      characteristics:    parseSlashList(primary?.jobChr),
      relatedOccupations: toArray(primary?.relJobList).map(j => j.jobNm),
      relatedDepartments: toArray(primary?.relMajorList).map(m => m.majorNm),
      averageSalary:      parseSalary(primary?.sal),
      
      // 자격증: 2차 API가 더 풍부, 없으면 1차 사용
      relatedCertifications: parseCertLic(secondary?.optionJobInfo?.certLic) 
                          || toArray(primary?.relCertList).map(c => c.certNm).filter(Boolean),
      
      // 2차 API 추가 정보
      educationLevel:     secondary?.optionJobInfo?.eduLevel || '',
      requiredExperience: secondary?.optionJobInfo?.skillYear || '',
      workEnvironment:    secondary?.optionJobInfo?.workPlace || '',
    };

  } catch (error) {
    console.error('Error fetching career details:', error);
    throw new Error('Failed to fetch career details');
  }
}

// "광산보안기사·산업기사, 광해방지기술사·기사, ..." → ['광산보안기사·산업기사', '광해방지기술사·기사', ...]
function parseCertLic(str) {
  if (!str) return null;
  const arr = str.split(',').map(s => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

// DB 저장 (또는 캐시 조회)
async function saveCareerDetails(jobCode) {
  const cached = await Job.findOne({ jobCode });
  if (cached) return cached;

  const data = await getCareerDetails(jobCode);
  if (!data) return null;

  return await Job.create({ ...data, jobCode });
}
module.exports = {
  getCategories,
  searchCareers,
  getCareerDetails,
  saveCareerDetails
};
