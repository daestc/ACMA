/**
 * 자격증 시드 스크립트 (일회용)
 *
 * 동작:
 *   1. q-net 자격증 목록 API 호출 → 자격증 마스터 정보 (jmcd, name, field, series 등)
 *   2. CSV 파일 읽기 → 종목명별로 피벗 (수행직무, 취득방법, 진로 및 전망 등)
 *   3. 종목명으로 매칭 → 병합
 *   4. MongoDB에 일괄 저장
 *
 * 실행:
 *   node seedCertifications.js
 */

require('dotenv').config();
const fs = require('fs');
const iconv = require('iconv-lite');
const csvParser = require('csv-parser');
const { parseStringPromise } = require('xml2js');
const connectDB = require('./config/database');
const { Certification } = require('./models/Certifications_jobs');

const CSV_FILE = '한국산업인력공단_국가기술자격_종목별_시험정보_20240624.csv';
const QNET_API = 'http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList';


/**
 * CSV 파일을 읽어 종목명 기준으로 피벗
 *   long format: { 종목명, 항목, 내용 } 행 단위
 *   → wide format: { '종목명': { 수행직무: '...', 취득방법: '...', ... } }
 */
async function loadCsvAsMap(path) {
  return new Promise((resolve, reject) => {
    const map = {};
    fs.createReadStream(path)
      .pipe(iconv.decodeStream('euc-kr'))
      .pipe(csvParser())
      .on('data', (row) => {
        const name = row['종목명']?.trim();
        const key  = row['항목']?.trim();
        const val  = row['내용']?.trim();
        if (!name || !key) return;
        if (!map[name]) map[name] = {};
        map[name][key] = val;
      })
      .on('end', () => resolve(map))
      .on('error', reject);
  });
}


/**
 * q-net API에서 자격증 목록 가져오기
 */
async function fetchQnetList() {
  const params = new URLSearchParams({
    serviceKey: process.env.qnet_service_key,
    numOfRows: '1000',
    pageNo: '1',
  });

  const response = await fetch(`${QNET_API}?${params.toString()}`);
  const xml = await response.text();

  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });

  const resultCode = parsed?.response?.header?.resultCode;
  if (resultCode !== '00') {
    throw new Error(`q-net API 오류: ${parsed?.response?.header?.resultMsg}`);
  }

  const items = parsed?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}


/**
 * 매핑 + 병합
 */
function buildDocuments(apiList, csvMap) {
  let matched = 0;
  let unmatched = 0;

  const docs = apiList.map(api => {
    const name = api.jmfldnm?.trim();
    const csvData = csvMap[name];
    if (csvData) matched++;
    else unmatched++;

    const f1 = api.obligfldnm?.trim() || api.qualgbnm?.trim() || '기타';
    const f2 = api.mdobligfldnm?.trim() || '';

    return {
      name,
      jmcd:        api.jmcd?.trim() || '',
      field1:      f1,
      field2:      f2 === f1 ? '' : f2,
      seriesName:  api.seriesnm?.trim() || '',
      description: csvData?.['수행직무'] || '',
      careerPath:  csvData?.['진로 및 전망'] || '',
      way:         csvData?.['취득방법'] || '',
      officialUrl: csvData?.['실시기관 홈페이지'] || '',
      relatedJobs: [],
      isActive:    true,
    };
  });

  console.log(`매칭 완료: ${matched}건 / 매칭 실패: ${unmatched}건`);
  return docs;
}


async function main() {
  try {
    console.log('1. DB 연결 중...');
    await connectDB();

    console.log('2. CSV 파일 읽는 중...');
    const csvMap = await loadCsvAsMap(CSV_FILE);
    console.log(`   → CSV 종목 수: ${Object.keys(csvMap).length}`);

    console.log('3. q-net API 호출 중...');
    const apiList = await fetchQnetList();
    console.log(`   → API 자격증 수: ${apiList.length}`);

    console.log('4. 데이터 병합 중...');
    const docs = buildDocuments(apiList, csvMap);

    console.log('5. DB에 저장 중...');
    // 기존 데이터 모두 삭제 후 재삽입 (반복 실행 안전)
    await Certification.deleteMany({});
    const result = await Certification.insertMany(docs);
    console.log(`   → 저장된 문서 수: ${result.length}`);

    console.log('\n✅ 시드 완료');
  } catch (error) {
    console.error('\n❌ 시드 실패:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
