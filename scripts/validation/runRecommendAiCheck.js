// AI 추천 사유 본문 점검 — 가상 학생에게 실제 서비스와 같은 순서로 AI 추천을 만들고(DB에 저장하지 않음),
// 사유(reason) 문장에 그 학생이 갖지 않은 자격증 이름이 나온 곳을 사람이 판정할 표로 뽑는다.
// evidence는 스키마가 enum(facts)로 막아서 목록 밖 값을 구조적으로 낼 수 없다 — 그래서 본문을 본다.
//
// 실행: node scripts/validation/runRecommendAiCheck.js --ids G-CS-1,G-CS-2,...   (호출 수만 보여 주고 멈춤)
//       node scripts/validation/runRecommendAiCheck.js --ids ... --yes             (실제 호출)
//       node scripts/validation/runRecommendAiCheck.js --summarize <결과 폴더>      (팀이 ai_review.csv 판정 후 집계)
//       --out <폴더>  결과 폴더를 바꾼다(기본 validation/results/<KST 날짜>)
// 결과: ai_raw/<id>.json(원본 응답·검증기 errors), ai_review.csv(판정 칸 비움), ai_check.md(자동 집계)
// DB는 읽기만 한다(카탈로그 find, 실행 전후 careerrecommendations 문서 수 확인).

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
const mongoose = require('mongoose');
const { JobCatalog } = require('../../models/JobCatalog');
const { CareerRecommendation } = require('../../models/Ai');
const scorer = require('../../services/ai/recommendScorer');
const validator = require('../../services/ai/validator');
const aiClient = require('../../services/ai/aiClient');
const recommendationPrompt = require('../../services/ai/prompts/recommendation');
const { CATALOG_QUERY, SCORING_FIELDS, buildPrefLabels } = require('../../services/ai/recommendationService');
const { loadPersonas, scorePersona, kstToday } = require('./runRecommendValidation');

const PICK_COUNT = 3; // recommendationService와 같은 값 — 후보가 이보다 적으면 서비스는 AI를 부르지 않는다
const MIN_CERT_NAME_LENGTH = 3;
const VERDICT_HOLD = '보유처럼 씀';
const VERDICTS = [VERDICT_HOLD, '필요하다고 씀', '기타'];

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] || null;
}

const csvCell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 따옴표 안의 쉼표·줄바꿈을 지키는 CSV 읽기(--summarize용, 팀이 엑셀로 저장해도 읽히게 BOM 제거)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

// 자격증 사전: 카탈로그 전체 relatedCertifications를 splitCertNames로 펼친 이름(3자 이상)
function buildCertDictionary(jobs) {
  const names = new Set();
  jobs.forEach(j => (j.relatedCertifications || []).forEach(raw => scorer.splitCertNames(raw).forEach(n => {
    const name = n.trim();
    if (name.length >= MIN_CERT_NAME_LENGTH) names.add(name);
  })));
  return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
}

const splitSentences = text => String(text || '').split(/(?<=[.!?。])\s+|\n+/).map(s => s.trim()).filter(Boolean);

// 문장에 나온 사전 자격증 중 학생이 갖지 않은 것. 더 긴 이름에 포함되는 짧은 이름(예: 전산회계 ⊂ 전산회계1급)은
// 긴 이름만 남기고, 학생이 가진 자격증 이름 안에 들어가는 이름도 뺀다.
function unheldCertsIn(sentence, dictionary, heldKeys) {
  const s = scorer.norm(sentence);
  // 사전에 띄어쓰기만 다른 이름("정보처리 기사"·"정보처리기사")이 함께 있어 정규화한 이름으로 먼저 하나로 모은다
  const found = new Map();
  dictionary.forEach(name => {
    const key = scorer.norm(name);
    if (!s.includes(key)) return;
    // 표에는 띄어쓰기가 적은 표기를 쓴다
    if (!found.has(key) || name.split(' ').length < found.get(key).split(' ').length) found.set(key, name);
  });
  const keys = [...found.keys()];
  const longest = keys.filter(a => !keys.some(b => b.length > a.length && b.includes(a)));
  return longest
    .filter(key => ![...heldKeys].some(h => h.includes(key) || key.includes(h)))
    .map(key => found.get(key));
}

async function summarize(dir) {
  const reviewFile = path.join(dir, 'ai_review.csv');
  const rawDir = path.join(dir, 'ai_raw');
  const rows = parseCsv(fs.readFileSync(reviewFile, 'utf8'));
  const header = rows.shift();
  const col = name => header.indexOf(name);
  const verdictCol = col('판정');
  const counts = new Map([...VERDICTS, '(빈칸)', '(그 외 값)'].map(v => [v, 0]));
  rows.forEach(r => {
    const v = (r[verdictCol] || '').trim();
    const key = !v ? '(빈칸)' : VERDICTS.includes(v) ? v : '(그 외 값)';
    counts.set(key, counts.get(key) + 1);
  });
  const raws = fs.readdirSync(rawDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8')));
  const aiPicks = raws.reduce((sum, r) => sum + (r.picks || []).filter(p => p.source === 'ai' && p.reason).length, 0);
  console.log(`AI 추천 ${aiPicks}개 사유 중 입력에 없는 자격증을 보유한 것처럼 쓴 문장 ${counts.get(VERDICT_HOLD)}개`);
  console.log(`(점검 대상 문장 ${rows.length}개: ${[...counts].map(([k, n]) => `${k} ${n}`).join(', ')})`);
  if (counts.get('(빈칸)') || counts.get('(그 외 값)')) {
    console.log(`⚠️ 판정이 비었거나 정해진 값(${VERDICTS.join(' / ')})이 아닌 줄이 있습니다.`);
    process.exitCode = 1;
  }
}

async function main() {
  const summarizeDir = argValue('--summarize');
  if (summarizeDir) return summarize(path.resolve(summarizeDir));

  const ids = (argValue('--ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('--ids로 대상 학생을 지정하세요');
  const personas = loadPersonas();
  const targets = ids.map(id => {
    const p = personas.find(x => x.id === id);
    if (!p) throw new Error(`personas.json에 없는 id: ${id}`);
    return p;
  });

  await mongoose.connect(process.env.MONGODB_URI);
  const jobs = await JobCatalog.find(CATALOG_QUERY).select(SCORING_FIELDS).lean();
  const scored = targets.map(p => ({ p, res: scorePersona(p.resolved, jobs) }));
  // 서비스는 관심 분야 질문으로 가거나 후보가 3개 미만이면 AI를 부르지 않는다 — 여기서도 부르지 않는다
  const callable = scored.filter(({ res }) => !res.needsInterests && res.top10.length >= PICK_COUNT);
  const skipped = scored.filter(x => !callable.includes(x));

  console.log(`AI를 ${callable.length}회 호출합니다 (대상 ${targets.length}명${skipped.length ? `, 서비스가 AI를 부르지 않는 경우 ${skipped.length}명 제외: ${skipped.map(({ p }) => p.id).join(', ')}` : ''}).`);
  if (!process.argv.includes('--yes')) {
    console.log('실제로 호출하려면 --yes를 붙여 다시 실행하세요.');
    await mongoose.connection.close();
    process.exitCode = 1;
    return;
  }

  const outDir = argValue('--out') ? path.resolve(argValue('--out')) : path.join(ROOT, 'validation', 'results', kstToday());
  const rawDir = path.join(outDir, 'ai_raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const docsBefore = await CareerRecommendation.countDocuments();
  const dictionary = buildCertDictionary(jobs);
  const jobsByCode = new Map(jobs.map(j => [j.jobCode, j]));

  const reviewRows = [];
  const schemaViolations = { jobCode: 0, evidence: 0 };
  const errorKinds = new Map();
  let aiPickCount = 0;

  for (const { p, res } of callable) {
    // recommendationService.generateRecommendation과 같은 순서·같은 입력(저장만 하지 않음)
    const prefLabels = buildPrefLabels(res.prefs);
    const candidates = res.top10;
    const facts = [...new Set([
      ...validator.collectEvidenceFacts(res.context),
      ...candidates.flatMap(c => c.matched?.subjects || []),
      ...prefLabels,
    ])];
    const candidateCodes = candidates.map(c => c.jobCode);
    const inputState = scorer.buildInputState(res.signals, res.prefs);

    let data = null;
    let meta = null;
    let callError = null;
    try {
      ({ data, meta } = await aiClient.generateJSON({
        system: recommendationPrompt.buildSystem(),
        user: recommendationPrompt.buildUser(res.context, candidates, jobsByCode, prefLabels, facts, inputState, res.interests),
        schema: recommendationPrompt.buildOutputSchema(candidateCodes, facts),
      }));
    } catch (e) {
      callError = e.message;
    }

    const recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
    const factSet = new Set(facts);
    recs.forEach(rec => {
      if (!candidateCodes.includes(rec?.jobCode)) schemaViolations.jobCode += 1;
      (Array.isArray(rec?.evidence) ? rec.evidence : []).forEach(e => { if (!factSet.has(e)) schemaViolations.evidence += 1; });
    });
    const { picks, errors } = data ? validator.validateRecommendation(data, candidates, facts) : { picks: [], errors: [] };
    errors.forEach(e => {
      const kind = e.replace(/\[\d+\]/g, '[n]').replace(/\(([^)]*)\)/g, '(…)').replace(/\d+개/g, 'N개');
      errorKinds.set(kind, (errorKinds.get(kind) || 0) + 1);
    });

    const heldKeys = new Set((p.resolved.certs || []).flatMap(c => scorer.expandCert(c).map(scorer.norm)));
    picks.filter(pk => pk.source === 'ai' && pk.reason).forEach(pk => {
      aiPickCount += 1;
      splitSentences(pk.reason).forEach(sentence => {
        const certs = unheldCertsIn(sentence, dictionary, heldKeys);
        if (certs.length) reviewRows.push([p.id, pk.jobCode, sentence, certs.join(' / '), '']);
      });
    });

    fs.writeFileSync(path.join(rawDir, `${p.id}.json`), JSON.stringify({
      id: p.id,
      label: p.resolved.label || p.label || null,
      input: { major: p.resolved.major, doubleMajor: p.resolved.doubleMajor, certs: p.resolved.certs, skills: p.resolved.skills, experiences: p.resolved.experiences, prefs: p.resolved.prefs, interests: p.resolved.interests },
      promptVersion: recommendationPrompt.VERSION,
      model: meta?.model || null,
      candidateCodes,
      facts,
      callError,
      response: data,
      validatorErrors: errors,
      picks,
    }, null, 2));
    console.log(`  ${p.id}: ${callError ? `호출 실패 (${callError})` : `AI 추천 ${picks.filter(pk => pk.source === 'ai').length}개, 검증기 errors ${errors.length}`}`);
  }

  const docsAfter = await CareerRecommendation.countDocuments();
  const csv = [['id', 'jobCode', '문장', '걸린 자격증', '판정'], ...reviewRows].map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'ai_review.csv'), csv);

  const md = [
    `# AI 추천 사유 점검 (${kstToday()})`, '',
    `- 실행 시각: ${new Date().toISOString()}`,
    `- 프롬프트: ${recommendationPrompt.VERSION}`,
    `- 대상 ${targets.length}명 중 AI 호출 ${callable.length}회${skipped.length ? ` (제외: ${skipped.map(({ p }) => p.id).join(', ')})` : ''}`,
    `- AI 추천(사유 있음) ${aiPickCount}개`,
    `- 스키마 위반: 목록 밖 jobCode ${schemaViolations.jobCode}건, 목록 밖 evidence ${schemaViolations.evidence}건 (0이어야 한다 — 아니면 strict 스키마가 전달되지 않은 것)`,
    `- 검증기 errors 종류별: ${[...errorKinds].map(([k, n]) => `${k} ×${n}`).join(' / ') || '없음'}`,
    `- 사유 본문에 학생이 갖지 않은 자격증이 나온 문장: ${reviewRows.length}개 → ai_review.csv 판정 칸(${VERDICTS.join(' / ')})을 채운 뒤 --summarize`,
    `- 자격증 사전: 카탈로그 relatedCertifications ${dictionary.length}개 이름(3자 이상)`,
    `- DB careerrecommendations 문서 수: 실행 전 ${docsBefore} → 후 ${docsAfter}`, '',
  ];
  fs.writeFileSync(path.join(outDir, 'ai_check.md'), md.join('\n'));
  console.log(`결과: ${path.relative(ROOT, outDir)}/ (ai_raw ${callable.length}개, ai_review.csv ${reviewRows.length}줄, ai_check.md)`);
  console.log(`careerrecommendations 문서 수 ${docsBefore} → ${docsAfter}`);
  await mongoose.connection.close();
}

// 단위 점검용(문장 나누기·자격증 찾기·CSV 읽기)
module.exports = { buildCertDictionary, splitSentences, unheldCertsIn, parseCsv, csvCell };

if (require.main === module) {
  main().catch(async error => {
    console.error('❌ AI 점검 실패:', error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
}
