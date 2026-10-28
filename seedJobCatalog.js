// AI 진로 추천(FR-AI-005, Phase5-진로추천-구현계획서.md §5-1)용 공용 직무 카탈로그를
// 고용24 직업정보 API로 채우는 배치. 사용자별 저장 목록인 Job 모델과 달리 JobCatalog는
// userId 없는 공용 마스터 데이터라 이 배치로만 채운다(요청마다 API를 부르지 않는다 — §6).
//
// 직무 목록은 직업정보 목록 API(대표 직업, 약 500개)에서 가져온다. 계획서의 searchCareers
// (직업사전 dJobCD) 경로는 1차 상세 API에 지식·능력·성격이 있는 코드가 2.2%뿐이라 버렸다.
// 상세는 1차 API의 dtlGb=1(요약·지식·능력·성격·연봉·학과·자격증)과 dtlGb=2(하는 일)만 쓴다.
// 2차 API(직업사전 상세)는 직업정보 코드 대부분에 "정보가 존재하지 않습니다"를 돌려준다.
//
// 실행 전 .env에 MONGODB_URI, service_key가 설정되어 있어야 한다.
// 실행 방법:
//   node seedJobCatalog.js --dry-run              (목록 API만 불러 대상 직무 수 확인, DB 쓰기 없음)
//   node seedJobCatalog.js --limit 30             (목록 앞 30개만 적재)
//   node seedJobCatalog.js --category "소프트웨어|금융"   (목록의 분류명 jobClcdNM 정규식, 기본값 전체)

const mongoose = require('mongoose');
require('dotenv').config();
const { parseStringPromise } = require('xml2js');
const { JobCatalog } = require('./models/JobCatalog');
const careerService = require('./services/careerService');
const { norm, expandCert, splitCertNames } = require('./services/ai/recommendScorer');

const SOURCE = 'jobInfo';
const CALL_INTERVAL_MS = 300;
const API_BASE = 'https://www.work24.go.kr/cm/openApi/call/wk';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/xml, text/xml, */*;q=0.01',
  'Referer': 'https://www.work24.go.kr/',
  'Origin': 'https://www.work24.go.kr',
};

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, category: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--limit') args.limit = Number(argv[(i += 1)]);
    else if (arg === '--category') args.category = argv[(i += 1)];
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callWork24(path) {
  const serviceKey = process.env.service_key;
  if (!serviceKey) throw new Error('service_key is not configured');

  const response = await fetch(`${API_BASE}/${path}&authKey=${serviceKey}`, { headers: HEADERS });
  const text = await response.text();
  if (!response.ok) throw new Error(`work24 ${response.status}: ${text.slice(0, 200)}`);
  return parseStringPromise(text, { explicitArray: false, trim: true });
}

// 직업정보 목록: 파라미터 없이 부르면 전체(total≈492)가 한 번에 온다.
async function fetchJobInfoList() {
  const parsed = await callWork24('callOpenApiSvcInfo212L01.do?returnType=XML&target=JOBCD');
  const total = Number(parsed?.jobsList?.total || 0);
  const items = toArray(parsed?.jobsList?.jobList);
  return { total, items };
}

// 1차 API dtlGb=2: 하는 일(execJob). fetchPrimaryJobAPI는 dtlGb=1 고정이라 따로 부른다.
async function fetchJobInfoDuties(jobCode) {
  const parsed = await callWork24(
    `callOpenApiSvcInfo212D05.do?returnType=XML&target=JOBDTL&jobGb=1&jobCd=${encodeURIComponent(jobCode)}&dtlGb=2`,
  );
  return parsed?.jobsDo || null;
}

// relMajorList, relCertList: 1개면 객체, 여러 개면 배열 (careerService.toArray와 동일 — export 안 돼 있어 복제)
function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// "전산(99)/창의력(98)" → [{ name:'전산', importance:99 }, ...]
// parseSlashList와 달리 괄호 안 중요도 숫자를 살린다 — 적합도 가중치로 쓰기 위함(§3-2)
// 항목 이름에 '/'가 들어간 경우("적응성/융통성(72)")가 있어서 "(숫자)" 바로 뒤의 '/'에서만 나눈다.
function parseWeightedList(str) {
  const raw = String(str || '');
  const parts = /\(\d+\)/.test(raw) ? raw.split(/(?<=\(\d+\))\s*\/\s*/) : raw.split('/');
  return parts.map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\((\d+)\)$/);
    return m ? { name: m[1].trim(), importance: Number(m[2]) } : { name: s, importance: null };
  });
}

// execJob: "-업무1\n-업무2\n..." → ['업무1', '업무2', ...]
function parseDuties(execJob) {
  return String(execJob || '').split('\n').map(s => s.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
}

function buildCatalogDoc(listItem, primary, duties) {
  const title = primary?.jobSmclNm || listItem.jobNm || '';
  const summary = String(primary?.jobSum || duties?.jobSum || '').slice(0, 300);
  const responsibilities = parseDuties(duties?.execJob);
  const relatedCertifications = [...new Set(
    toArray(primary?.relCertList).flatMap(c => splitCertNames(c.certNm)),
  )];
  const certNames = [...new Set(relatedCertifications.flatMap(expandCert).map(norm))];

  return {
    jobCode: listItem.jobCd,
    title: title.trim(),
    source: SOURCE,
    jobLrclNm: primary?.jobLrclNm || '',
    jobMdclNm: primary?.jobMdclNm || listItem.jobClcdNM || '',
    summary,
    responsibilities,
    knowledge: parseWeightedList(primary?.knowldg),
    abilities: parseWeightedList(primary?.jobAbil),
    characteristics: parseWeightedList(primary?.jobChr),
    averageSalary: careerService.parseSalary(primary?.sal),
    relatedDepartments: toArray(primary?.relMajorList).map(m => m.majorNm).filter(Boolean),
    relatedCertifications,
    certNames,
    searchText: norm(`${title}${summary}${responsibilities.join('')}`),
    lastSyncedAt: new Date(),
    syncError: '',
  };
}

const FILL_FIELDS = {
  knowledge: d => d.knowledge.length > 0,
  abilities: d => d.abilities.length > 0,
  characteristics: d => d.characteristics.length > 0,
  relatedDepartments: d => d.relatedDepartments.length > 0,
  certNames: d => d.certNames.length > 0,
  responsibilities: d => d.responsibilities.length > 0,
  'averageSalary.median50>0': d => d.averageSalary.median50 > 0,
};

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const { total, items } = await fetchJobInfoList();
  const categoryRegex = args.category ? new RegExp(args.category) : null;
  let targets = categoryRegex ? items.filter(i => categoryRegex.test(i.jobClcdNM || '')) : items;
  if (args.limit) targets = targets.slice(0, args.limit);

  console.log(`목록 total=${total}, 수신=${items.length}, 대상=${targets.length}` +
    `${args.category ? ` (분류 패턴: /${args.category}/)` : ''}`);
  if (items.length !== total) console.log(`⚠️ 목록 수신 건수(${items.length})가 total(${total})과 다릅니다.`);

  if (args.dryRun) {
    const byClass = new Map();
    targets.forEach(i => byClass.set(i.jobClcdNM, (byClass.get(i.jobClcdNM) || 0) + 1));
    console.log(`분류 수: ${byClass.size}`);
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ DB 연결 성공!');

  const removed = await JobCatalog.deleteMany({ source: { $ne: SOURCE } });
  if (removed.deletedCount) console.log(`🗑️ 다른 출처 문서 ${removed.deletedCount}건 삭제`);

  let successCount = 0;
  let failCount = 0;
  const fillCounts = Object.fromEntries(Object.keys(FILL_FIELDS).map(k => [k, 0]));
  const rawSamples = [];
  const certSamples = []; // 파싱으로 표기가 바뀐 relCertList 원문 → 결과
  let certNameTotal = 0;

  for (const item of targets) {
    try {
      // 직무 하나가 실패해도 계속 진행한다 — 실패는 syncError에 남기고 다음 직무로 넘어간다.
      const primary = await careerService.fetchPrimaryJobAPI(item.jobCd);
      await sleep(CALL_INTERVAL_MS);
      const duties = await fetchJobInfoDuties(item.jobCd);

      if (rawSamples.length < 3) {
        rawSamples.push({
          jobCode: item.jobCd,
          knowldg: primary?.knowldg || '',
          jobAbil: primary?.jobAbil || '',
          jobChr: primary?.jobChr || '',
        });
      }

      const doc = buildCatalogDoc(item, primary, duties);
      certNameTotal += doc.certNames.length;
      const rawCerts = toArray(primary?.relCertList).map(c => c.certNm).filter(Boolean);
      if (certSamples.length < 5 && rawCerts.some(c => /[,，(（]/.test(c))) {
        certSamples.push({ jobCode: item.jobCd, raw: rawCerts, parsed: doc.relatedCertifications, certNames: doc.certNames });
      }
      Object.entries(FILL_FIELDS).forEach(([key, isFilled]) => { if (isFilled(doc)) fillCounts[key] += 1; });

      await JobCatalog.findOneAndUpdate(
        { jobCode: doc.jobCode },
        { $set: doc },
        { upsert: true, setDefaultsOnInsert: true },
      );
      successCount += 1;
    } catch (error) {
      failCount += 1;
      await JobCatalog.findOneAndUpdate(
        { jobCode: item.jobCd },
        {
          $set: {
            jobCode: item.jobCd,
            title: item.jobNm || item.jobCd,
            source: SOURCE,
            jobMdclNm: item.jobClcdNM || '',
            syncError: error.message,
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      console.error(`❌ ${item.jobCd} 실패: ${error.message}`);
    }

    await sleep(CALL_INTERVAL_MS);
  }

  const pct = n => (targets.length ? ((n / targets.length) * 100).toFixed(1) : '0.0');
  console.log('──────── 결과 ────────');
  console.log(`직무 수: ${targets.length}`);
  console.log(`성공: ${successCount} / 실패: ${failCount}`);
  Object.entries(fillCounts).forEach(([key, n]) => console.log(`채움 ${key}: ${n}/${targets.length} (${pct(n)}%)`));
  console.log(`certNames 직무당 평균: ${successCount ? (certNameTotal / successCount).toFixed(2) : 0}개`);
  console.log('자격증 파싱 샘플(원문 → 결과):', JSON.stringify(certSamples, null, 2));
  console.log('첫 3건 원문(knowldg/jobAbil/jobChr):', JSON.stringify(rawSamples, null, 2));

  await mongoose.connection.close();
}

run().catch(async error => {
  console.error('❌ 배치 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
