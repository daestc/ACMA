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
// 배치되는 사고를 막는다. 시간/항목이 버려지는 게 아니라 속성 하나가 조정되는
// 것뿐이라 notices(정보성)로 분류한다 — errors(실제 배치 실패)와 다르다.
function injectDueDates(items, certSchedule, notices) {
  items.forEach(item => {
    if (!item.isDeadline) return;

    const normalizedTitle = normalizeForMatch(item.title);
    const candidates = (certSchedule || []).filter(
      cert => cert.certName && normalizedTitle.includes(normalizeForMatch(cert.certName)),
    );

    if (candidates.length === 0) {
      item.isDeadline = false;
      notices.push(`"${item.title}" 마감 매칭 실패로 isDeadline 해제`);
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
// errors(실제 배치 실패)와 notices(정보성 안내)를 분리해서 저장한다 — 성격이 다른
// 메시지를 한 배열에 섞어두면 화면에서 사용자가 뭘 조치해야 하는지 구분이 안 된다.
async function runDistribution(weeklyPlanDoc, extraNotices = []) {
  try {
    const { byDate, errors, weekDates } = dailyDistributor.distribute(
      weeklyPlanDoc,
      weeklyPlanDoc.computed?.availableHoursByDay || [],
    );
    await dailyDistributor.applyDistributionToChecklists(weeklyPlanDoc.userId, weeklyPlanDoc._id, byDate, weekDates);

    const dayCount = [...byDate.values()].filter(arr => arr.length > 0).length;
    const itemCount = [...byDate.values()].reduce((sum, arr) => sum + arr.length, 0);

    await WeeklyPlan.findByIdAndUpdate(weeklyPlanDoc._id, {
      'distribution.status': 'done',
      'distribution.distributedAt': new Date(),
      'distribution.dayCount': dayCount,
      'distribution.itemCount': itemCount,
      'distribution.errors': errors,
      'distribution.notices': extraNotices,
    });

    return { status: 'done', dayCount, itemCount, errors, notices: extraNotices };
  } catch (distError) {
    logger.error(`[ai] daily distribution failed (weeklyPlanId=${weeklyPlanDoc._id}): ${distError.message}`);
    const errors = [distError.message];
    await WeeklyPlan.findByIdAndUpdate(weeklyPlanDoc._id, {
      'distribution.status': 'failed',
      'distribution.errors': errors,
      'distribution.notices': extraNotices,
    }).catch(() => {});
    return { status: 'failed', dayCount: 0, itemCount: 0, errors, notices: extraNotices };
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

    const extraNotices = [];
    injectDueDates(sanitized.items, context.certSchedule, extraNotices);

    // hasTimetable:false면 availableHoursByDay가 실제 시간표가 아니라 기본값(하루
    // 6시간 균일)으로 채워졌다는 뜻이다 — 방학이라 정말 시간표가 없는 것과 학생이
    // 아직 등록을 안 한 것을 구분할 수 없으므로, 조용히 기본값을 쓰는 대신 알린다.
    if (context.computed.hasTimetable === false) {
      extraNotices.push('이 주에 해당하는 시간표 데이터가 없어 하루 최대 6시간 가용 시간으로 임시 계산했습니다. 실제 여유 시간과 다를 수 있습니다.');
    }

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
        hasTimetable: context.computed.hasTimetable,
      },
      prevCompletionRate: context.prevCompletionRate,
      generation: buildGenerationMeta(meta, weeklyPlanPrompt.VERSION),
    }, { new: true }).lean();

    await runDistribution(savedDoc, extraNotices);
  } catch (error) {
    logger.error(`[ai] weekly-plan generation failed (docId=${docId}): ${error.message}`);
    await WeeklyPlan.findByIdAndUpdate(docId, {
      status: 'failed',
      errorMessage: GENERIC_FAILURE_MESSAGE,
    }).catch(() => {});
  }
}

module.exports = { generateWeeklyPlan, runDistribution };
