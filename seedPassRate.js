/**
 * 합격률 시드 스크립트 (일회용)
 *
 * 동작:
 *   1. DB에서 자격증 마스터 조회 → { jmCd: ObjectId } 맵 생성
 *   2. 연도 × 등급 조합으로 q-net 합격률 API 호출 (재시도 포함)
 *   3. 응답 파싱 → certificationId 매핑
 *   4. PassRate 컬렉션에 일괄 저장
 *
 * 실행:
 *   node seedPassRates.js
 */
 
require('dotenv').config();
const { parseStringPromise } = require('xml2js');
const connectDB = require('./config/database');
const { Certification, PassRate } = require('./models/Certifications_jobs');
 
const PASS_RATE_API = 'http://openapi.q-net.or.kr/api/service/rest/InquiryQualPassRateSVC/getList';
 
// 시드 대상
const YEARS = [2022, 2023, 2024];
const GRADE_CODES = ['10', '20', '30', '31', '32', '33', '40'];
// 10=기술사, 20=기능장, 30=기사, 31=산업기사, 32=1급, 33=2급, 40=기능사
 
/**
 * sleep
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
 
 
/**
 * 재시도 로직이 포함된 API 호출
 *   q-net 서버가 자주 resultCode=99로 응답하므로 재시도 필수
 */
async function callApiWithRetry(params, maxRetry = 5) {
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const url = `${PASS_RATE_API}?${new URLSearchParams(params).toString()}`;
      const response = await fetch(url);
      const text = await response.text();
 
      if (text.includes('<resultCode>00</resultCode>')) {
        return text;
      }
      console.log(`    시도 ${attempt} 실패 (resultCode≠00), 재시도...`);
    } catch (err) {
      console.log(`    시도 ${attempt} 예외: ${err.message}`);
    }
    await sleep(3000);
  }
  return null;
}
 
 
/**
 * 합격률 응답 XML을 파싱하여 item 배열 반환
 */
async function parsePassRateXml(xml) {
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const items = parsed?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}
 
 
/**
 * 합격률 문자열 ("46.7%") → 숫자 (46.7)
 */
function parseRate(rateStr) {
  if (!rateStr) return 0;
  const num = parseFloat(String(rateStr).replace('%', '').trim());
  return isNaN(num) ? 0 : num;
}
 
 
/**
 * 시험구분 ("필기"/"실기") → enum ("written"/"practical")
 */
function mapExamType(typCcd) {
  if (typCcd === '필기') return 'written';
  if (typCcd === '실기') return 'practical';
  return null; // 알 수 없는 값
}
 
 
async function main() {
  try {
    console.log('1. DB 연결 중...');
    await connectDB();
 
    console.log('2. 자격증 마스터 조회 중...');
    const certs = await Certification.find({}, { _id: 1, jmcd: 1 }).lean();
    const jmcdToId = new Map();
    certs.forEach(c => {
      if (c.jmcd) jmcdToId.set(c.jmcd, c._id);
    });
    console.log(`   → 등록된 자격증: ${certs.length}건 (jmcd 매핑: ${jmcdToId.size}건)`);
 
    console.log('3. q-net 합격률 API 호출 중...');
    const allDocs = [];
    let totalFetched = 0;
    let unmatchedJmcds = new Set();
 
    for (const year of YEARS) {
      for (const grdCd of GRADE_CODES) {
        console.log(`  [year=${year}, grdCd=${grdCd}] 호출 중...`);
        const params = {
          serviceKey: process.env.qnet_service_key,
          numOfRows: '2000',
          pageNo: '1',
          baseYY: String(year),
          grdCd,
        };
 
        const xml = await callApiWithRetry(params);
        if (!xml) {
          console.log(`    → 최종 실패, 스킵`);
          continue;
        }
 
        const items = await parsePassRateXml(xml);
        console.log(`    → 받음: ${items.length}건`);
        totalFetched += items.length;
 
        for (const it of items) {
          const certId = jmcdToId.get(it.jmCd);
          if (!certId) {
            unmatchedJmcds.add(it.jmCd);
            continue;
          }
          const examType = mapExamType(it.examTypCcd);
          if (!examType) continue;
 
          allDocs.push({
            certificationId: certId,
            examType,
            year: Number(it.implYy),
            session: `${it.implSeq}회`,
            applicantCount: Number(it.recptNoCnt) || 0,
            passerCount:    Number(it.examPassCnt) || 0,
            passRate:       parseRate(it.passRate),
            note: '',
          });
        }
 
        await sleep(1500); // 호출 간 간격
      }
    }
 
    console.log(`\n4. 데이터 정리 완료`);
    console.log(`   → API에서 받은 총 건수: ${totalFetched}`);
    console.log(`   → 자격증과 매칭된 건수: ${allDocs.length}`);
    console.log(`   → 매칭 실패한 jmCd 수: ${unmatchedJmcds.size}`);
 
    console.log('\n5. DB에 저장 중...');
    await PassRate.deleteMany({}); // 안전한 재실행을 위해 기존 데이터 삭제
    const result = await PassRate.insertMany(allDocs);
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