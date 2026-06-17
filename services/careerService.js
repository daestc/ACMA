const {JobSearch} = require('../models/Certifications_jobs');
const {Job} = require('../models/Certifications_jobs');
const { parseStringPromise } = require('xml2js');
const { Certification, UserCertification, PassRate } = require('../models/Certifications_jobs');
const User = require('../models/User');
const mongoose = require('mongoose');

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

    const list = parsed?.dJobsList?.dJobList;
    const jobItems = !list ? [] : (Array.isArray(list) ? list : [list]);
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
//현재 선택한 직무정보 가져오기
async function getMyCareer(userId) {
  try {
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      userDoc = await User.findOne({ email: userId }).lean();
    }
    if (!userDoc) {
      console.error('User not found for userId:', userId);
      return null;
    }
    const jobDoc = await Job.findOne({ userId: userDoc._id }).lean();
    return jobDoc || null;
  } catch (error) {
    console.error('Error fetching my career:', error);
    throw new Error('Failed to fetch my career');
  }
};

 //=============지금부터 자격증 관련 ========================

// "광산보안기사·산업기사, 광해방지기술사·기사, ..." → ['광산보안기사·산업기사', '광해방지기술사·기사', ...]
function parseCertLic(str) {
  if (!str) return null;
  const arr = str.split(',').map(s => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

// DB 저장 (또는 캐시 조회)
async function saveCareerDetails(jobCode, userContext, status = 'wish') {
  let userDoc = null;

  if (userContext?._id) {
    userDoc = await User.findById(userContext._id).lean();
  }

  if (!userDoc && userContext?.email) {
    userDoc = await User.findOne({ email: userContext.email }).lean();
  }

  if (!userDoc) {
    throw new Error('User not found');
  }

  const userId = userDoc._id;
  const data = await getCareerDetails(jobCode);
  if (!data) return null;

  if (status === 'target') {
    await Job.updateMany(
      {
        userId,
        status: 'target',
        jobCode: { $ne: jobCode },
      },
      { $set: { status: 'wish' } }
    );
  }

  return await Job.findOneAndUpdate(
    { userId, jobCode },
    {
      $set: {
        status,
      },
      $setOnInsert: {
        ...data,
        jobCode,
        userId,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }
  );
}
// 자격증 검색 db에서 대분류, 중분류, 자격증 정보 가져오기
async function getCertCategories() {
  try {
    const categories = await Certification.find().select('field1 field2 seriesName').lean();
    return categories;
  } catch (error) {
    console.error('Error fetching certification categories:', error);
    throw new Error('Failed to fetch certification categories');
  }
}
async function searchCertifications(field1, field2, seriesName, keyword){
  try {
    const query = {};
    if (field1) query.field1 = field1;
    if (field2) query.field2 = field2;
    if (seriesName) query.seriesName = seriesName;

    if(keyword) {
      query.name = { $regex: keyword, $options: 'i' }; // 이름에 키워드 포함 (대소문자 무시)
    }
    const certs = await Certification.find(query)
      .select('name jmcd field1 field2 seriesName description careerPath way officialUrl relatedJobs')
      .sort({name: 1}) // 이름순 정렬
      .lean();
    return certs;
  } catch (error) {
    console.error('Error searching certifications:', error);
    throw new Error('Failed to search certifications');
  }
}

// 자격증 선택하여 DB에 저장하기 (사용자 자격증 목표 추가)
async function saveCertification(jmcd, userId, status = 'wish') {
  try {
    // 1. jmcd로 자격증 조회
    const cert = await Certification.findOne({ jmcd }).lean();
    if (!cert) {
      console.error('Certification not found for jmcd:', jmcd);
      return null;
    }

    // 2. userId를 MongoDB ObjectId로 변환 (또는 email로 조회)
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      // email로 조회
      userDoc = await User.findOne({ email: userId }).lean();
    }
    
    if (!userDoc) {
      console.error('User not found for userId:', userId);
      return null;
    }

    const userId_ObjectId = userDoc._id;

    // 3. 기존 레코드 조회 (상태 무관 - 같은 자격증이 있으면 status 업데이트)
    const existingUserCert = await UserCertification.findOne({
      userId: userId_ObjectId,
      certificationId: cert._id
    });

    if (existingUserCert) {
      // 기존 레코드의 status만 업데이트
      existingUserCert.status = status;
      await existingUserCert.save();
      
      // 업데이트된 문서 반환 (populate 포함)
      const updatedUserCert = await UserCertification.findById(existingUserCert._id)
        .populate('certificationId', 'name jmcd field1 field2 seriesName')
        .populate('userId', 'name email');
      
      return updatedUserCert;
    }

    // 4. 새로운 UserCertification 생성
    const userCertification = await UserCertification.create({
      userId: userId_ObjectId,
      certificationId: cert._id,
      status: status, // 전달받은 status 사용
      progress: 0,
      memo: '',
      isVisible: true
    });

    // 5. 저장된 문서 반환 (populate을 통해 자격증 정보도 포함)
    const savedUserCert = await UserCertification.findById(userCertification._id)
      .populate('certificationId', 'name jmcd field1 field2 seriesName')
      .populate('userId', 'name email');

    return savedUserCert;
  } catch (error) {
    console.error('Error saving certification:', error);
    throw error;
  }
}
// 자격증 별 합격률 DB에서 합격률 정보 가져오기
async function getPassRate(jmcd) {
  try {
    const normalizedJmcd = String(jmcd || '').trim();
    const cert = await Certification.findOne({ jmcd: normalizedJmcd }).lean();
    if (!cert) {
      console.error('Certification not found for jmcd:', normalizedJmcd);
      return null;
    }
    const passRates = await PassRate.find({ certificationId: cert._id })
      .sort({ examType: 1, year: -1, updatedAt: -1, createdAt: -1 })
      .lean();
    return passRates;
  } catch (error) {
    console.error('Error fetching pass rate:', error);
    throw new Error('Failed to fetch pass rate');
  }
};
// 현재 선택한 자격증 목록 가져오기
async function getMyCertifications(userId) {
  try {
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      userDoc = await User.findOne({ email: userId }).lean();
    }
    if (!userDoc) {
      console.error('User not found for userId:', userId);
      return [];
    }

    const userCerts = await UserCertification.find({ userId: userDoc._id })
      .populate('certificationId', 'name jmcd field1 field2 seriesName description careerPath way officialUrl')
      .lean();

    return userCerts.map(userCert => ({
      _id: userCert._id,
      status: userCert.status,
      date: userCert.date,
      progress: userCert.progress,
      memo: userCert.memo,
      isVisible: userCert.isVisible,
      certificationId: userCert.certificationId
        ? {
            _id: userCert.certificationId._id,
            name: userCert.certificationId.name || '',
            jmcd: userCert.certificationId.jmcd || '',
            field1: userCert.certificationId.field1 || '',
            field2: userCert.certificationId.field2 || '',
            seriesName: userCert.certificationId.seriesName || '',
            description: userCert.certificationId.description || '',
            careerPath: userCert.certificationId.careerPath || '',
            way: userCert.certificationId.way || '',
            officialUrl: userCert.certificationId.officialUrl || '',
          }
        : null,
    }));
  } catch (error) {
    console.error('Error fetching user certifications:', error);
    throw new Error('Failed to fetch user certifications');
  }
};

// 선택한 자격증 삭제하기
async function deleteCertification(userCertId, userId) {
  try {
    // userId 검증
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      userDoc = await User.findOne({ email: userId }).lean();
    }
    
    if (!userDoc) {
      throw new Error('User not found');
    }

    // UserCertification이 현재 사용자의 것인지 확인하고 삭제
    const result = await UserCertification.findOneAndDelete({
      _id: userCertId,
      userId: userDoc._id
    });

    if (!result) {
      throw new Error('User certification not found');
    }

    return { success: true, message: '자격증이 삭제되었습니다.' };
  } catch (error) {
    console.error('Error deleting certification:', error);
    throw error;
  }
};

// 현재 선택한 직무 목록 가져오기
async function getMyJobs(userId) {
  try {
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      userDoc = await User.findOne({ email: userId }).lean();
    }
    if (!userDoc) {
      console.error('User not found for userId:', userId);
      return [];
    }

    const userJobs = await Job.find({ userId: userDoc._id }).lean();
    userJobs.sort((a, b) => {
      const aPriority = a.status === 'target' ? 0 : 1;
      const bPriority = b.status === 'target' ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
    return userJobs;
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    throw new Error('Failed to fetch user jobs');
  }
};

//선택한 목표 직무와 목표 자격증 가져오기
async function getMyCareerAndCertifications(userId) {
  try {
    const [jobs, certs] = await Promise.all([
      getMyJobs(userId),
      getMyCertifications(userId)
    ]);
    const targetJob = jobs.find(job => job.status === 'target') || null;
    const targetCerts = certs.filter(cert => cert.status === 'target');
    return { targetJob, targetCerts };
  } catch (error) {    console.error('Error fetching career and certifications:', error);
    throw new Error('Failed to fetch career and certifications');
  }
};

// 선택한 직무 삭제하기
async function deleteJob(jobId, userId) {
  try {
    // userId 검증
    let userDoc;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).lean();
    } else {
      userDoc = await User.findOne({ email: userId }).lean();
    }
    
    if (!userDoc) {
      throw new Error('User not found');
    }

    // Job이 현재 사용자의 것인지 확인하고 삭제
    const result = await Job.findOneAndDelete({
      _id: jobId,
      userId: userDoc._id
    });

    if (!result) {
      throw new Error('User job not found');
    }

    return { success: true, message: '직무가 삭제되었습니다.' };
  } catch (error) {
    console.error('Error deleting job:', error);
    throw error;
  }
};

module.exports = {
  getCategories, // 진로 검색db에서 대분류, 중분류, 소분류 가져오기
  searchCareers, // api 에서 선택한 대분류, 중분류, 소분류에서 검색한 모든 세분류의 직무 이름 가져오기
  getCareerDetails, // 선택한 직무에서 직업코드를 가져와 상세 직무 정보 가져오기
  saveCareerDetails, // 직무 선택하여 db에 저장하기
  getMyCareer, // 현재 선택한 직무정보 가져오기
  getCertCategories, // 자격증 검색 db에서 대분류, 중분류, 자격증 정보 가져오기
  searchCertifications, // 분류에 따른 자격증 목록 가져오기
  saveCertification, // 자격증 선택하여 db에 저장하기
  getPassRate, // 자격증 별 합격률 DB에서 합격률 정보 가져오기
  getMyCertifications, // 현재 선택한 자격증 목록 가져오기
  deleteCertification, // 선택한 자격증 삭제하기
  getMyJobs, // 현재 선택한 직무 목록 가져오기
  deleteJob, // 선택한 직무 삭제하기
  getMyCareerAndCertifications, // 선택한 목표 직무와 목표 자격증 가져오기
};
