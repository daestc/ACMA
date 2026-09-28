// AI 진로 추천(FR-AI-005, Phase5-진로추천-구현계획서.md §5-1)용 공용 직무 카탈로그를
// work24 API로 채우는 배치. 사용자별 저장 목록인 Job 모델과 달리 JobCatalog는 userId 없는
// 공용 마스터 데이터라 이 배치로만 채운다(요청마다 API를 부르지 않는다 — §6).
//
// 실행 전 .env에 MONGODB_URI, service_key가 설정되어 있어야 한다.
// 실행 방법:
//   node seedJobCatalog.js --dry-run                 (API 호출 없이 대상 분류 수만 확인)
//   node seedJobCatalog.js --limit 20                 (직무 20개만 테스트 적재)
//   node seedJobCatalog.js --category "정보\\s*통신|경영|금융"   (대상 분류 정규식, depth2_name 기준)

const mongoose = require('mongoose');
require('dotenv').config();
const { JobSearch } = require('./models/Certifications_jobs');
const { JobCatalog } = require('./models/JobCatalog');
const careerService = require('./services/careerService');
const { norm, expandCert } = require('./services/ai/recommendScorer');

const DEFAULT_CATEGORY_PATTERN = '정보\\s*통신|경영|금융';
const CALL_INTERVAL_MS = 300;
const SEARCH_DISPLAY_LIMIT = 50; // searchCareers가 고정으로 쓰는 display=50과 맞춤 — 정확히 50건이면 잘렸을 수 있다

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, category: DEFAULT_CATEGORY_PATTERN };
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

// relMajorList, relCertList: 1개면 객체, 여러 개면 배열 (careerService.toArray와 동일 — export 안 돼 있어 복제)
function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// "전산(99)/창의력(98)" → [{ name:'전산', importance:99 }, ...]
// parseSlashList와 달리 괄호 안 중요도 숫자를 살린다 — 적합도 가중치로 쓰기 위함(§3-2)
function parseWeightedList(str) {
  return String(str || '').split('/').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\((\d+)\)$/);
    return m ? { name: m[1].trim(), importance: Number(m[2]) } : { name: s, importance: null };
  });
}

async function getTargetCategories(categoryPattern) {
  const regex = new RegExp(categoryPattern);
  const categories = await JobSearch.find({ depth4_name: { $ne: '' } })
    .select('categoryId depth1_name depth2_name depth3_name depth4_name')
    .lean();
  return categories.filter(c => regex.test(c.depth2_name || ''));
}

function buildCatalogDoc(category, jobMeta, primary, secondary) {
  const title = primary?.jobSmclNm || secondary?.dJobNm || jobMeta.jobName || '';
  const summary = (primary?.jobSum || secondary?.workSum || '').slice(0, 300);
  const responsibilities = secondary?.doWork?.split('. ').map(s => s.trim()).filter(Boolean) || [];
  const relatedDepartments = toArray(primary?.relMajorList).map(m => m.majorNm).filter(Boolean);
  const relatedCertifications = careerService.parseCertLic(secondary?.optionJobInfo?.certLic)
    || toArray(primary?.relCertList).map(c => c.certNm).filter(Boolean);
  const certNames = [...new Set(relatedCertifications.flatMap(expandCert).map(norm))];

  return {
    jobCode: jobMeta.jobCode,
    jobSeq: jobMeta.jobSeq || '1',
    title,
    categoryId: category.categoryId,
    depth1_name: category.depth1_name,
    depth2_name: category.depth2_name,
    depth3_name: category.depth3_name,
    depth4_name: category.depth4_name,
    summary,
    responsibilities,
    knowledge: parseWeightedList(primary?.knowldg),
    abilities: parseWeightedList(primary?.jobAbil),
    characteristics: parseWeightedList(primary?.jobChr),
    averageSalary: careerService.parseSalary(primary?.sal),
    relatedDepartments,
    relatedCertifications,
    certNames,
    searchText: norm(`${title}${summary}${responsibilities.join('')}`),
    lastSyncedAt: new Date(),
    syncError: '',
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ DB 연결 성공!');

  const targetCategories = await getTargetCategories(args.category);
  console.log(`대상 분류(세분류) 수: ${targetCategories.length} (패턴: /${args.category}/, depth2_name 기준)`);

  if (args.dryRun) {
    targetCategories.slice(0, 20).forEach(c => {
      console.log(`  - [${c.categoryId}] ${c.depth2_name} > ${c.depth3_name} > ${c.depth4_name}`);
    });
    if (targetCategories.length > 20) console.log(`  ... 외 ${targetCategories.length - 20}건`);
    await mongoose.connection.close();
    return;
  }

  // searchCareers는 API 오류 때도 []를 돌려줘서 "직무 없음"과 구분이 안 된다 —
  // 0건 분류 수를 따로 집계해 이상 여부를 사람이 판단하게 한다.
  const jobsByCode = new Map(); // jobCode -> { jobMeta, category } (처음 등장한 분류 기준으로 고정)
  let zeroResultCategories = 0;
  const cappedCategories = [];

  for (const category of targetCategories) {
    const jobs = await careerService.searchCareers(category.depth4_name, category.categoryId);
    if (jobs.length === 0) zeroResultCategories += 1;
    if (jobs.length === SEARCH_DISPLAY_LIMIT) cappedCategories.push(category.depth4_name);

    jobs.forEach(jobMeta => {
      if (!jobsByCode.has(jobMeta.jobCode)) jobsByCode.set(jobMeta.jobCode, { jobMeta, category });
    });

    await sleep(CALL_INTERVAL_MS);
  }

  let targets = Array.from(jobsByCode.values());
  if (args.limit) targets = targets.slice(0, args.limit);

  console.log(`직무 수(중복 제거): ${targets.length}`);
  if (zeroResultCategories > 0) console.log(`⚠️ 0건 분류 수: ${zeroResultCategories}`);
  if (cappedCategories.length > 0) {
    console.log(`⚠️ ${SEARCH_DISPLAY_LIMIT}건 경고 분류(잘렸을 수 있음): ${cappedCategories.join(', ')}`);
  }

  let successCount = 0;
  let failCount = 0;
  let salaryFilledCount = 0;
  const rawSamples = [];

  for (const { jobMeta, category } of targets) {
    try {
      // 직무 하나가 실패해도 계속 진행한다 — 실패는 syncError에 남기고 다음 직무로 넘어간다.
      const [primary, secondary] = await Promise.all([
        careerService.fetchPrimaryJobAPI(jobMeta.jobCode),
        careerService.fetchSecondaryJobAPI(jobMeta.jobCode, jobMeta.jobSeq),
      ]);

      if (rawSamples.length < 3) {
        rawSamples.push({
          jobCode: jobMeta.jobCode,
          knowldg: primary?.knowldg || '',
          jobAbil: primary?.jobAbil || '',
          jobChr: primary?.jobChr || '',
        });
      }

      const doc = buildCatalogDoc(category, jobMeta, primary, secondary);
      if (doc.averageSalary.median50 > 0) salaryFilledCount += 1;

      await JobCatalog.findOneAndUpdate(
        { jobCode: doc.jobCode },
        { $set: doc },
        { upsert: true, setDefaultsOnInsert: true },
      );
      successCount += 1;
    } catch (error) {
      failCount += 1;
      await JobCatalog.findOneAndUpdate(
        { jobCode: jobMeta.jobCode },
        {
          $set: {
            jobCode: jobMeta.jobCode,
            title: jobMeta.jobName || '',
            syncError: error.message,
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      console.error(`❌ ${jobMeta.jobCode} 실패: ${error.message}`);
    }

    await sleep(CALL_INTERVAL_MS);
  }

  console.log('──────── 결과 ────────');
  console.log(`대상 분류 수: ${targetCategories.length}`);
  console.log(`직무 수: ${targets.length}`);
  console.log(`성공: ${successCount} / 실패: ${failCount}`);
  console.log(`0건 분류 수: ${zeroResultCategories}`);
  console.log(`${SEARCH_DISPLAY_LIMIT}건 경고 분류 수: ${cappedCategories.length}`);
  console.log(
    `연봉(median50>0) 채움 비율: ${targets.length ? ((salaryFilledCount / targets.length) * 100).toFixed(1) : 0}%`,
  );
  console.log('첫 3건 원문(knowldg/jobAbil/jobChr):', JSON.stringify(rawSamples, null, 2));

  await mongoose.connection.close();
}

run().catch(async error => {
  console.error('❌ 배치 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
