const { WeeklyPlan } = require('../../models/Ai');
const contextBuilder = require('./contextBuilder');
const weeklyPlanPrompt = require('./prompts/weeklyPlan');
const aiClient = require('./aiClient');
const validator = require('./validator');
const dailyDistributor = require('./dailyDistributor');
const logger = require('../../config/logger');

const GENERIC_FAILURE_MESSAGE = '생성에 실패했습니다. 잠시 후 다시 시도해주세요.';

function normalizeForMatch(value) {
  return String(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

// isDeadline 항목에 실제 마감일(dueDate)을 서버가 주입한다 — LLM은 날짜를 다루지 않는다.
// context.certSchedule엔 안정적인 id가 없으므로(Notice._id 미노출) 정규화된 title
// 부분포함 매칭을 쓴다. 매칭 실패 시 isDeadline을 false로 강등해 dueDate 없이
// 배치되는 사고를 막는다.
function injectDueDates(items, certSchedule, errors) {
  items.forEach(item => {
    if (!item.isDeadline) return;

    const normalizedTitle = normalizeForMatch(item.title);
    const candidates = (certSchedule || []).filter(
      cert => cert.certName && normalizedTitle.includes(normalizeForMatch(cert.certName)),
    );

    if (candidates.length === 0) {
      item.isDeadline = false;
      errors.push(`"${item.title}" 마감 매칭 실패로 isDeadline 해제`);
      return;
    }

    const best = candidates.reduce((min, c) => (c.dDay < min.dDay ? c : min));
    item.dueDate = best.date;
  });
}

// 검증 실패 시 로그에 남길 구조 정보 — 내용(제목/사유 등, 개인 학사 데이터 인용 가능성)은
// 빼고 키 목록/타입/길이만 남긴다.
function describeShape(data) {
  if (data === null || typeof data !== 'object') {
    return { type: typeof data };
  }
  const shape = { keys: Object.keys(data) };
  if ('items' in data) {
    shape.itemsType = Array.isArray(data.items) ? 'array' : typeof data.items;
    shape.itemsLength = Array.isArray(data.items) ? data.items.length : null;
    if (Array.isArray(data.items) && data.items[0] && typeof data.items[0] === 'object') {
      shape.firstItemKeys = Object.keys(data.items[0]);
    }
  }
  return shape;
}

function buildGenerationMeta(meta, promptVersion) {
  return {
    model: meta.model,
    promptVersion,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    latencyMs: meta.latencyMs,
    retryCount: meta.retryCount,
  };
}

// distribute() + applyDistributionToChecklists()를 실행하고 WeeklyPlan.distribution을
// 갱신한다. 실패해도 WeeklyPlan.status는 건드리지 않는다 — 주간계획 자체는 여전히
// 유효하므로 사용자에게 보여줄 수 있고, 분배만 재시도 가능해야 한다(POST .../distribute).
async function runDistribution(weeklyPlanDoc, extraErrors = []) {
  try {
    const { byDate, errors } = dailyDistributor.distribute(
      weeklyPlanDoc,
      weeklyPlanDoc.computed?.availableHoursByDay || [],
    );
    await dailyDistributor.applyDistributionToChecklists(weeklyPlanDoc.userId, weeklyPlanDoc._id, byDate);

    const dayCount = [...byDate.values()].filter(arr => arr.length > 0).length;
    const itemCount = [...byDate.values()].reduce((sum, arr) => sum + arr.length, 0);
    const allErrors = [...extraErrors, ...errors];

    await WeeklyPlan.findByIdAndUpdate(weeklyPlanDoc._id, {
      'distribution.status': 'done',
      'distribution.distributedAt': new Date(),
      'distribution.dayCount': dayCount,
      'distribution.itemCount': itemCount,
      'distribution.errors': allErrors,
    });

    return { status: 'done', dayCount, itemCount, errors: allErrors };
  } catch (distError) {
    logger.error(`[ai] daily distribution failed (weeklyPlanId=${weeklyPlanDoc._id}): ${distError.message}`);
    const allErrors = [...extraErrors, distError.message];
    await WeeklyPlan.findByIdAndUpdate(weeklyPlanDoc._id, {
      'distribution.status': 'failed',
      'distribution.errors': allErrors,
    }).catch(() => {});
    return { status: 'failed', dayCount: 0, itemCount: 0, errors: allErrors };
  }
}

// 주간 계획 생성 전체 흐름. 컨트롤러의 백그라운드(setImmediate)에서 호출된다.
async function generateWeeklyPlan(docId, userId, weekStart) {
  try {
    const context = await contextBuilder.buildWeeklyPlanContext(userId, weekStart);

    const { data, meta } = await aiClient.generateJSON({
      system: weeklyPlanPrompt.buildSystem(),
      user: weeklyPlanPrompt.buildUser(context),
      schema: weeklyPlanPrompt.OUTPUT_JSON_SCHEMA,
    });

    const { valid, sanitized, errors: validationErrors } = validator.validateWeeklyPlan(data, context);
    if (!valid) {
      // 항목 내용(개인 학사 데이터 인용 가능성)은 로그에 남기지 않고, 구조 정보와
      // validator가 낸 이유만 남긴다 — "검증 실패"라고만 찍히면 다음에도 원인을 못 찾는다.
      logger.error(
        `[ai] weekly-plan validation failed (docId=${docId}): reasons=${JSON.stringify(validationErrors)} `
        + `shape=${JSON.stringify(describeShape(data))}`,
      );
      throw new Error('LLM 출력이 검증을 통과하지 못했습니다.');
    }

    const dueDateErrors = [];
    injectDueDates(sanitized.items, context.certSchedule, dueDateErrors);

    const savedDoc = await WeeklyPlan.findByIdAndUpdate(docId, {
      status: 'done',
      errorMessage: null,
      goal: sanitized.goal,
      items: sanitized.items,
      computed: {
        availableHoursByDay: context.computed.availableHoursByDay,
        availableHoursTotal: context.computed.availableHoursTotal,
        allocatedHours: sanitized.allocatedHours,
        academicPhase: context.computed.academicPhase,
        semester: context.computed.semester,
      },
      prevCompletionRate: context.prevCompletionRate,
      generation: buildGenerationMeta(meta, weeklyPlanPrompt.VERSION),
    }, { new: true }).lean();

    await runDistribution(savedDoc, dueDateErrors);
  } catch (error) {
    logger.error(`[ai] weekly-plan generation failed (docId=${docId}): ${error.message}`);
    await WeeklyPlan.findByIdAndUpdate(docId, {
      status: 'failed',
      errorMessage: GENERIC_FAILURE_MESSAGE,
    }).catch(() => {});
  }
}

module.exports = { generateWeeklyPlan, runDistribution };
