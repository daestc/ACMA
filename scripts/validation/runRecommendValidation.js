// 진로 추천 검증 실행기 — 가상 학생(validation/personas.json)을 실제 서비스와 같은 조건으로 점수화하고,
// 팀이 결과를 보기 전에 커밋한 기대 결과(validation/expectations.json)로 판정한다. DB는 find만 한다.
//
// 실행: node scripts/validation/runRecommendValidation.js --list-categories   (대분류 → 중분류(직무 수)만 출력)
//       node scripts/validation/runRecommendValidation.js                     (전체 실행 → validation/results/<날짜>/)
//       node scripts/validation/runRecommendValidation.js --only G-CS-1       (한 명만, 화면 출력만)
//       node scripts/validation/runRecommendValidation.js --check-expectations (기대 결과의 이름만 대조, 잠금 무관)
//       --out <폴더>  결과 폴더를 바꾼다(기본 validation/results/<KST 날짜>)
//
// 이름 대조: 기대 결과의 mdcl·lrcl·cert 이름이 카탈로그에 없으면(오타 등) 종료 코드 3으로 멈춘다. 없는 중분류는
// 후보에 있을 수 없어서 top10_lacks_mdcl이 오타만으로 항상 통과해 일치율이 조용히 부풀기 때문이다.
//
// 기대 결과 잠금: expectations.json에 커밋되지 않은 변경이 있거나 커밋된 적이 없으면 종료 코드 2로 멈춘다
// (--list-categories 제외). 결과를 본 뒤 기대를 맞추는 일을 막고, 결과에 그 파일의 커밋 해시를 남긴다.
// --only도 잠금을 따른다 — 후보 목록을 미리 보면 기대를 결과에 맞추게 된다.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
const mongoose = require('mongoose');
const { JobCatalog } = require('../../models/JobCatalog');
const scorer = require('../../services/ai/recommendScorer');
const { CATALOG_QUERY, SCORING_FIELDS } = require('../../services/ai/recommendationService');
const { cleanSubjectName } = require('../../services/ai/contextBuilder');

const PERSONAS_FILE = path.join(ROOT, 'validation', 'personas.json');
const EXPECTATIONS_REL = 'validation/expectations.json';
const EXPECTATIONS_FILE = path.join(ROOT, EXPECTATIONS_REL);
const FAILED_GRADES = new Set(['F', 'NP']); // recommendationService.loadScoringCourses와 같은 규칙
const GROUP_LABEL = { G: 'G. 전공·과목 조합', M: 'M. 변화 시험', E: 'E. 경계 사례' };

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] || null;
}

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

// ── 기대 결과 잠금 ─────────────────────────────────────────

function checkExpectationsLock() {
  const dirty = git(['status', '--porcelain', '--', EXPECTATIONS_REL]);
  const committed = git(['log', '-1', '--format=%H%x20%cI', '--', EXPECTATIONS_REL]);
  if (dirty || !committed || !fs.existsSync(EXPECTATIONS_FILE)) {
    console.error('기대 결과를 먼저 커밋하세요.');
    console.error(`  ${EXPECTATIONS_REL}: ${dirty ? `커밋되지 않은 변경 (${dirty.split('\n').join(', ')})` : '커밋된 적 없음'}`);
    process.exit(2);
  }
  const [hash, time] = committed.split(' ');
  return { hash, time };
}

// ── 학생 입력 ────────────────────────────────────────────

const PATCHABLE = ['major', 'doubleMajor', 'grade', 'courses', 'certs', 'skills', 'experiences', 'prefs', 'interests'];
const keyOf = (field, v) => (field === 'courses' ? v.name : JSON.stringify(v));

// patch: { 필드: { add: [...] } | { remove: [...] } | { replace: 값 } }. courses의 remove는 과목명으로 찾는다.
function applyPatch(base, patch, id) {
  const next = JSON.parse(JSON.stringify(base));
  Object.entries(patch || {}).forEach(([field, op]) => {
    if (!PATCHABLE.includes(field)) throw new Error(`${id}: patch할 수 없는 필드 ${field}`);
    if ('replace' in op) { next[field] = op.replace; return; }
    const list = Array.isArray(next[field]) ? next[field] : [];
    const removeKeys = new Set((op.remove || []).map(v => (field === 'courses' && typeof v === 'string' ? v : keyOf(field, v))));
    const kept = list.filter(v => !removeKeys.has(keyOf(field, v)));
    if (removeKeys.size && kept.length !== list.length - removeKeys.size) throw new Error(`${id}: ${field}에서 지울 값 일부가 base에 없음`);
    next[field] = [...kept, ...(op.add || [])];
  });
  return next;
}

function loadPersonas() {
  const raw = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'));
  const byId = new Map(raw.map(p => [p.id, p]));
  if (byId.size !== raw.length) throw new Error('personas.json에 중복 id가 있습니다');
  return raw.map(p => {
    if (p.group !== 'M') return { ...p, resolved: p };
    const base = byId.get(p.base);
    if (!base || base.group === 'M') throw new Error(`${p.id}: base ${p.base}를 찾을 수 없거나 M 학생입니다`);
    return { ...p, baseResolved: base, resolved: { ...applyPatch(base, p.patch, p.id), id: p.id } };
  });
}

// 서비스(recommendationService.buildCandidates)와 같은 입력: F·NP를 뺀 과목(이름은 loadScoringCourses처럼
// cleanSubjectName으로 정리), sanitizePrefs, 관심 분야 필터
function scorePersona(p, jobs) {
  const courses = (p.courses || []).filter(c => c?.name && !FAILED_GRADES.has(c.grade))
    .map(c => ({ name: cleanSubjectName(c.name), credits: c.credits, grade: c.grade ?? null }))
    .filter(c => c.name);
  const context = {
    profile: { major: p.major || null, doubleMajor: p.doubleMajor || null, grade: p.grade ?? null },
    specs: {
      certifications: (p.certs || []).map(name => ({ name })),
      skills: (p.skills || []).map(name => ({ name })),
      experiences: (p.experiences || []).map(title => ({ title })),
    },
    academic: { majorCourses: courses.map(c => ({ name: c.name, grade: c.grade })) },
  };
  const interests = p.interests || [];
  const signals = scorer.extractUserSignals(context, courses);
  const prefs = scorer.sanitizePrefs(p.prefs);
  const pool = interests.length ? jobs.filter(j => interests.includes(j.jobLrclNm)) : jobs;
  const top10 = scorer.rankCandidates(signals, prefs, pool, { limit: 10, perMidClass: 3 });
  const full = scorer.rankCandidates(signals, prefs, pool, { limit: pool.length, perMidClass: Infinity });
  const confidence = scorer.calcConfidence(signals, prefs);
  return { context, courses, signals, prefs, interests, top10, full, confidence, needsInterests: confidence === 'low' && interests.length === 0 };
}

// ── 판정 ────────────────────────────────────────────────

const countBy = list => {
  const m = new Map();
  list.forEach(v => m.set(v, (m.get(v) || 0) + 1));
  return [...m].map(([k, n]) => `${k}×${n}`).join(', ');
};
// 전체 순위(1부터)에서 조건에 맞는 직무의 최고 순위. 없으면 null
const bestRank = (full, pred) => { const i = full.findIndex(pred); return i === -1 ? null : i + 1; };
const rankText = r => (r == null ? '없음' : `${r}위`);
const certKeys = cert => new Set(scorer.expandCert(cert).map(scorer.norm));

function judge(exp, res, baseRes) {
  const mdcl = new Set(exp.mdcl || []);
  const mdclList = [...mdcl].join(' / ');
  const top10Mdcl = res.top10.map(c => c.jobMdclNm);
  const needBase = () => { if (!baseRes) throw new Error(`${exp.type}은 M 학생에만 쓸 수 있습니다`); };
  switch (exp.type) {
    case 'top10_has_mdcl':
    case 'top3_has_mdcl': {
      const n = exp.type === 'top3_has_mdcl' ? 3 : 10;
      const list = top10Mdcl.slice(0, n);
      return { expected: `상위 ${n}개에 ${mdclList}`, actual: `후보 중분류: ${countBy(list) || '없음'}`, pass: list.some(m => mdcl.has(m)) };
    }
    case 'top10_lacks_mdcl':
      return { expected: `후보 10개에 ${mdclList} 없음`, actual: `후보 중분류: ${countBy(top10Mdcl) || '없음'}`, pass: !top10Mdcl.some(m => mdcl.has(m)) };
    case 'confidence':
      return { expected: `신뢰도 ${exp.value}`, actual: `신뢰도 ${res.confidence}`, pass: res.confidence === exp.value };
    case 'needs_interests':
      return { expected: '관심 분야 질문으로 감', actual: `신뢰도 ${res.confidence}, 관심 분야 ${res.interests.length}개 → ${res.needsInterests ? '질문' : '바로 추천'}`, pass: res.needsInterests };
    case 'cert_jobs_rank_improves': {
      needBase();
      const keys = certKeys(exp.cert);
      const has = j => (j.certNames || []).some(c => keys.has(c));
      const b = bestRank(baseRes.full, c => has(c.__job));
      const v = bestRank(res.full, c => has(c.__job));
      if (b == null && v == null) return { expected: `${exp.cert} 관련 직무 순위 상승`, actual: '그 자격증이 certNames에 있는 직무 없음', pass: false, memo: '자격증 이름이 카탈로그와 맞지 않음' };
      return { expected: `${exp.cert} 관련 직무 최고 순위 상승(1위 유지 포함)`, actual: `${exp.cert} 관련 최고 순위 ${rankText(b)} → ${rankText(v)}`, pass: v != null && (b == null || v < b || (b === 1 && v === 1)) };
    }
    case 'mdcl_rank_improves':
    case 'mdcl_rank_worsens': {
      needBase();
      const b = bestRank(baseRes.full, c => mdcl.has(c.jobMdclNm));
      const v = bestRank(res.full, c => mdcl.has(c.jobMdclNm));
      const improves = exp.type === 'mdcl_rank_improves';
      // 상승은 cert_jobs_rank_improves처럼 원래 1위였으면 1위 유지도 통과(기대를 쓰는 사람은 base 순위를 볼 수 없다)
      const pass = b != null && v != null && (improves ? (v < b || (b === 1 && v === 1)) : v > b);
      return { expected: `${mdclList} 최고 순위 ${improves ? '상승(1위 유지 포함)' : '하락'}`, actual: `${mdclList} 최고 순위 ${rankText(b)} → ${rankText(v)}`, pass };
    }
    case 'all_in_lrcl': {
      const allowed = new Set(exp.lrcl || res.interests);
      const outside = res.top10.filter(c => !allowed.has(c.jobLrclNm));
      return { expected: `후보 10개 모두 ${[...allowed].join(' / ') || '(관심 분야 없음)'} 안`, actual: outside.length ? `밖 ${outside.length}개: ${countBy(outside.map(c => c.jobLrclNm))}` : `모두 안 (${res.top10.length}개)`, pass: allowed.size > 0 && res.top10.length > 0 && outside.length === 0 };
    }
    case 'top10_unchanged': {
      needBase();
      const a = baseRes.top10.map(c => c.jobCode);
      const b = res.top10.map(c => c.jobCode);
      const firstDiff = a.findIndex((code, i) => code !== b[i]);
      const same = a.length === b.length && firstDiff === -1;
      return { expected: '후보 10개 순서 그대로', actual: same ? '같음' : `${firstDiff + 1}번째부터 다름`, pass: same };
    }
    default:
      return { expected: exp.type, actual: '-', pass: false, memo: `알 수 없는 판정 종류 ${exp.type}` };
  }
}

const KNOWN_TYPES = new Set([
  'top10_has_mdcl', 'top3_has_mdcl', 'top10_lacks_mdcl', 'confidence', 'needs_interests',
  'cert_jobs_rank_improves', 'mdcl_rank_improves', 'mdcl_rank_worsens', 'all_in_lrcl', 'top10_unchanged',
]);
const MDCL_TYPES = new Set(['top10_has_mdcl', 'top3_has_mdcl', 'top10_lacks_mdcl', 'mdcl_rank_improves', 'mdcl_rank_worsens']);

// 기대 결과의 이름을 카탈로그와 대조한다(후보 목록은 보지 않는다). 문제 목록 [{ id, type, name, reason }]
function checkExpectationNames(expectations, personas, jobs) {
  const mdclSet = new Set(jobs.map(j => j.jobMdclNm).filter(Boolean));
  const lrclSet = new Set(jobs.map(j => j.jobLrclNm).filter(Boolean));
  const certNameSet = new Set(jobs.flatMap(j => j.certNames || []));
  const personaIds = new Set(personas.map(p => p.id));
  const problems = [];
  Object.entries(expectations).forEach(([id, value]) => {
    if (!personaIds.has(id)) problems.push({ id, type: '-', name: id, reason: 'personas.json에 없는 id' });
    normalizeExpectation(value).checks.forEach(exp => {
      const type = exp?.type;
      if (!KNOWN_TYPES.has(type)) { problems.push({ id, type: type ?? '-', name: '-', reason: '알 수 없는 판정 종류' }); return; }
      if (MDCL_TYPES.has(type)) {
        if (!Array.isArray(exp.mdcl) || !exp.mdcl.length) problems.push({ id, type, name: '-', reason: 'mdcl이 비어 있음' });
        (exp.mdcl || []).filter(m => !mdclSet.has(m)).forEach(m => problems.push({ id, type, name: m, reason: '카탈로그에 없는 중분류' }));
      }
      if (type === 'all_in_lrcl') (exp.lrcl || []).filter(l => !lrclSet.has(l)).forEach(l => problems.push({ id, type, name: l, reason: '카탈로그에 없는 대분류' }));
      if (type === 'cert_jobs_rank_improves' && ![...certKeys(exp.cert || '')].some(k => certNameSet.has(k))) {
        problems.push({ id, type, name: exp.cert ?? '-', reason: '어떤 직무 certNames에도 없는 자격증' });
      }
      if (type === 'confidence' && !['low', 'normal'].includes(exp.value)) problems.push({ id, type, name: exp.value ?? '-', reason: 'value는 low 또는 normal' });
    });
  });
  return problems;
}

function reportNameProblems(problems) {
  console.error(`기대 결과의 이름 ${problems.length}건이 카탈로그와 맞지 않습니다 (--list-categories의 이름을 그대로 쓰세요):`);
  problems.forEach(p => console.error(`  ${p.id} · ${p.type} · ${p.name} — ${p.reason}`));
}

// 기대 형식: [판정, ...] 또는 { skip: "이유" }. 배열 안의 { skip: "이유" }도 그 학생 전체 보류로 본다.
function normalizeExpectation(value) {
  if (value && !Array.isArray(value) && value.skip) return { skip: value.skip, checks: [] };
  const list = Array.isArray(value) ? value : [];
  const skipItem = list.find(e => e && e.skip);
  return skipItem ? { skip: skipItem.skip, checks: [] } : { skip: null, checks: list };
}

// ── 출력 ────────────────────────────────────────────────

const csvCell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function inputSummary(p) {
  const r = p.resolved;
  return [
    `전공 ${r.major || '-'}${r.doubleMajor ? ` + 복수 ${r.doubleMajor}` : ''}, ${r.grade ?? '-'}학년`,
    `과목 ${(r.courses || []).map(c => `${c.name}(${c.credits}/${c.grade ?? '-'})`).join(', ') || '-'}`,
    `자격증 ${(r.certs || []).join(', ') || '-'} / 기술 ${(r.skills || []).join(', ') || '-'} / 경험 ${(r.experiences || []).join(', ') || '-'}`,
    `체크리스트 ${JSON.stringify(r.prefs || null)} / 관심 분야 ${(r.interests || []).join(', ') || '-'}`,
  ];
}

function candidateLines(res) {
  return res.top10.map((c, i) => {
    const b = c.breakdown;
    return `${i + 1}. ${c.title} · ${c.jobMdclNm} · ${c.total}점 (전공 ${b.major} 자격 ${b.cert} 지식 ${b.knowledge} 기술 ${b.skill} 선호 ${b.pref})`;
  });
}

async function main() {
  const listOnly = process.argv.includes('--list-categories');
  const only = argValue('--only');

  await mongoose.connect(process.env.MONGODB_URI);
  const jobs = await JobCatalog.find(CATALOG_QUERY).select(SCORING_FIELDS).lean();

  if (listOnly) {
    const byL = new Map();
    jobs.forEach(j => {
      const l = j.jobLrclNm || '(대분류 없음)';
      const m = j.jobMdclNm || '(중분류 없음)';
      if (!byL.has(l)) byL.set(l, new Map());
      byL.get(l).set(m, (byL.get(l).get(m) || 0) + 1);
    });
    let total = 0;
    [...byL].sort(([a], [b]) => a.localeCompare(b, 'ko')).forEach(([l, mids]) => {
      const n = [...mids.values()].reduce((s, v) => s + v, 0);
      total += n;
      console.log(`\n■ ${l} (${n})`);
      [...mids].sort(([a], [b]) => a.localeCompare(b, 'ko')).forEach(([m, k]) => console.log(`  - ${m} (${k})`));
    });
    console.log(`\n직무 수 합 ${total} / 카탈로그 ${jobs.length}`);
    await mongoose.connection.close();
    return;
  }

  // 이름 대조는 잠금보다 먼저 한다 — 기대를 쓰는 중에도(커밋 전) 이름만 확인할 수 있게
  const personas = loadPersonas();
  if (fs.existsSync(EXPECTATIONS_FILE)) {
    const problems = checkExpectationNames(JSON.parse(fs.readFileSync(EXPECTATIONS_FILE, 'utf8')), personas, jobs);
    if (problems.length) {
      reportNameProblems(problems);
      await mongoose.connection.close();
      process.exit(3);
    }
    if (process.argv.includes('--check-expectations')) {
      console.log('기대 결과의 이름이 모두 카탈로그와 맞습니다.');
      await mongoose.connection.close();
      return;
    }
  } else if (process.argv.includes('--check-expectations')) {
    console.error(`${EXPECTATIONS_REL}이 없습니다.`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const lock = checkExpectationsLock();
  const expectations = JSON.parse(fs.readFileSync(EXPECTATIONS_FILE, 'utf8'));

  // M 판정에서 직무의 certNames가 필요해 원본 직무를 붙여 둔다(점수에는 쓰지 않음)
  const jobByCode = new Map(jobs.map(j => [j.jobCode, j]));
  const attachJobs = res => { res.full.forEach(c => { Object.defineProperty(c, '__job', { value: jobByCode.get(c.jobCode), enumerable: false }); }); return res; };

  const targets = only ? personas.filter(p => p.id === only) : personas;
  if (only && !targets.length) throw new Error(`--only ${only}: personas.json에 없는 id`);

  const rows = [];
  const results = [];
  for (const p of targets) {
    const res = attachJobs(scorePersona(p.resolved, jobs));
    const baseRes = p.baseResolved ? attachJobs(scorePersona(p.baseResolved, jobs)) : null;
    const { skip, checks } = normalizeExpectation(expectations[p.id]);
    let status;
    // 키가 없거나 빈 틀([])이면 기대 미작성 — 판정 0개를 통과로 세지 않는다
    if (!(p.id in expectations) || (!skip && checks.length === 0)) {
      status = 'missing';
      rows.push([p.id, p.group, p.kind || '', '-', '-', '-', '보류', '기대 미작성']);
    } else if (skip) {
      status = 'skip';
      rows.push([p.id, p.group, p.kind || '', 'skip', '-', '-', '보류', skip]);
    } else {
      const judged = checks.map(exp => {
        try { return { exp, ...judge(exp, res, baseRes) }; } catch (e) { return { exp, expected: exp.type, actual: '-', pass: false, memo: e.message }; }
      });
      judged.forEach(j => rows.push([p.id, p.group, p.kind || '', j.exp.type, j.expected, j.actual, j.pass ? '통과' : '실패', j.memo || '']));
      status = judged.every(j => j.pass) ? 'pass' : 'fail';
    }
    results.push({ p, res, baseRes, status });
  }

  const csv = [['id', 'group', 'kind', 'type', '기대', '실제', '통과', '메모'], ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n';

  if (only) {
    process.stdout.write(csv);
    const r = results[0];
    console.log(`\n${r.p.id} 신뢰도 ${r.res.confidence}${r.res.needsInterests ? ' (관심 분야 질문)' : ''}`);
    candidateLines(r.res).forEach(l => console.log(`  ${l}`));
    await mongoose.connection.close();
    return;
  }

  const outDir = argValue('--out') ? path.resolve(argValue('--out')) : path.join(ROOT, 'validation', 'results', kstToday());
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'checks.csv'), csv);

  const md = [];
  md.push(`# 진로 추천 검증 결과 (${kstToday()})`, '');
  md.push(`- 실행 시각: ${new Date().toISOString()}`);
  md.push(`- 코드: ${git(['rev-parse', '--short', 'HEAD'])}`);
  md.push(`- 기대 결과 파일: ${EXPECTATIONS_REL} @ ${lock.hash} (${lock.time})`);
  md.push(`- 카탈로그 직무 수: ${jobs.length}`);
  md.push(`- 학생 ${results.length}명 (학생 1명 = 1건, 판정이 모두 통과해야 통과)`, '');
  md.push('| 묶음 | 통과 / 판정 | 판정 보류 | 기대 미작성 |', '|---|---|---|---|');
  ['G', 'M', 'E'].forEach(g => {
    const list = results.filter(r => r.p.group === g);
    const judgedList = list.filter(r => r.status === 'pass' || r.status === 'fail');
    md.push(`| ${GROUP_LABEL[g]} | ${judgedList.filter(r => r.status === 'pass').length} / ${judgedList.length} | ${list.filter(r => r.status === 'skip').length} | ${list.filter(r => r.status === 'missing').length} |`);
  });
  const failed = results.filter(r => r.status === 'fail');
  md.push('', `## 실패한 건 (${failed.length})`);
  failed.forEach(({ p, res, baseRes }) => {
    md.push('', `### ${p.id} — ${p.resolved.label || p.label || ''}`);
    rows.filter(r => r[0] === p.id && r[6] === '실패').forEach(r => md.push(`- 실패: ${r[3]} — 기대 "${r[4]}", 실제 "${r[5]}"${r[7] ? ` (${r[7]})` : ''}`));
    md.push('- 입력:', ...inputSummary(p).map(l => `  - ${l}`));
    md.push(`- 신뢰도 ${res.confidence}${res.needsInterests ? ' (관심 분야 질문)' : ''}, 후보 10개:`, ...candidateLines(res).map(l => `  ${l}`));
    if (baseRes) md.push(`- base ${p.base} 후보 10개:`, ...candidateLines(baseRes).map(l => `  ${l}`));
    md.push('- 원인: (작성)');
  });
  md.push('', '## 기대 결과 수정', '', '(결과를 본 뒤 기대 결과를 고쳤다면 건수와 이유를 여기에 적는다)', '');
  fs.writeFileSync(path.join(outDir, 'summary.md'), md.join('\n'));

  console.log(`결과: ${path.relative(ROOT, outDir)}/checks.csv, summary.md (학생 ${results.length}명, 판정 ${rows.length}줄)`);
  await mongoose.connection.close();
}

// AI 근거 점검(runRecommendAiCheck.js)이 같은 입력 만들기를 쓴다
module.exports = { loadPersonas, scorePersona, kstToday };

if (require.main === module) {
  main().catch(async error => {
    console.error('❌ 검증 실행 실패:', error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
}
