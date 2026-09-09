const CATEGORY_ENUM = ['cert', 'course', 'skill', 'project', 'language', 'graduation', 'other'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// LLM이 반환한 주간 계획을 저장 가능한 형태로 검증·보정한다.
// context는 buildWeeklyPlanContext(userId, weekStart) 결과 (computed.availableHoursTotal 사용).
function validateWeeklyPlan(data, context) {
  const errors = [];

  if (typeof data?.goal !== 'string' || !data.goal.trim()) {
    errors.push('goal이 비어있어 기본값으로 대체');
  }
  const goal = (typeof data?.goal === 'string' && data.goal.trim()) || '이번 주 계획';

  if (!Array.isArray(data?.items) || data.items.length === 0) {
    return { valid: false, errors: [...errors, 'items가 비어있거나 배열이 아님'], sanitized: null };
  }

  let items = data.items.slice(0, 10);
  if (data.items.length > 10) errors.push(`items가 10개를 초과해 앞 10개만 사용 (원래 ${data.items.length}개)`);

  items = items.map((item, idx) => {
    const sanitizedItem = { ...item };

    if (!CATEGORY_ENUM.includes(sanitizedItem.category)) {
      errors.push(`items[${idx}].category(${sanitizedItem.category})가 유효하지 않아 'other'로 대체`);
      sanitizedItem.category = 'other';
    }

    if (!isFiniteNumber(sanitizedItem.estimatedHours) || sanitizedItem.estimatedHours < 0) {
      errors.push(`items[${idx}].estimatedHours가 유효하지 않아 0으로 대체`);
      sanitizedItem.estimatedHours = 0;
    }

    if (!Number.isInteger(sanitizedItem.priority) || sanitizedItem.priority < 1 || sanitizedItem.priority > 5) {
      errors.push(`items[${idx}].priority가 유효하지 않아 3으로 대체`);
      sanitizedItem.priority = 3;
    }

    sanitizedItem.isDeadline = Boolean(sanitizedItem.isDeadline);
    sanitizedItem.title = String(sanitizedItem.title || '').trim() || `할 일 ${idx + 1}`;

    return sanitizedItem;
  });

  // 가용 시간 초과분 정리: isDeadline 항목은 절대 자르지 않고, 나머지는 priority
  // 오름차순(1=최우선)으로 정렬한 뒤 예산을 넘는 지점부터 뒤에서 잘라낸다.
  // ??는 NaN을 걸러내지 못하므로 Number.isFinite로 직접 검사한다.
  const rawAvailableHours = context?.computed?.availableHoursTotal;
  const availableHoursTotal = Number.isFinite(rawAvailableHours) ? rawAvailableHours : Infinity;
  const deadlineItems = items.filter(i => i.isDeadline);
  const normalItems = items.filter(i => !i.isDeadline).sort((a, b) => a.priority - b.priority);

  let usedHours = deadlineItems.reduce((sum, i) => sum + i.estimatedHours, 0);
  if (usedHours > availableHoursTotal) {
    errors.push(`마감(isDeadline) 항목만으로 이미 가용 시간 초과 (${usedHours}h / ${availableHoursTotal}h)`);
  }
  const keptNormalItems = [];
  for (const item of normalItems) {
    if (usedHours + item.estimatedHours > availableHoursTotal) break;
    usedHours += item.estimatedHours;
    keptNormalItems.push(item);
  }

  if (keptNormalItems.length < normalItems.length) {
    errors.push(`estimatedHours 총합이 가용 시간(${availableHoursTotal}h)을 초과해 우선순위 낮은 항목 ${normalItems.length - keptNormalItems.length}개를 제외`);
  }

  const finalItems = [...deadlineItems, ...keptNormalItems];

  return {
    valid: true,
    errors,
    sanitized: {
      goal,
      items: finalItems,
      allocatedHours: +usedHours.toFixed(1),
    },
  };
}

// evidence 검증: context에 실제로 존재하는 "근거 사실"(course/cert/skill 이름,
// GPA·학점 같은 숫자, 재학상태 등)을 evidence 문자열이 포함하는지로 판정한다.
// 완전일치가 아니라 포함 관계인 이유 — "GPA 4.32", "자료구조 A" 처럼 모델이 라벨을
// 붙이거나 성적을 덧붙이는 조합형 문구를 evidence로 쓰는 게 정상적인 경우가 많아서,
// 완전일치로 하면 GPA/학점을 인용하라는 프롬프트 규칙 자체와 항상 충돌한다.
// (예전엔 반대 방향 contextBlob.includes(evidence)으로 짰었는데, 그러면 evidence가
// "title" 같은 JSON 키 이름이어도 통과해버리는 구멍이 있었다 — 그래서 방향을 뒤집어
// "evidence가 실제 값을 포함하는지"로 검사한다.)
const MIN_FACT_LENGTH = 2; // 너무 짧은 사실(예: 한 자리 숫자)은 우연히 일치할 위험이 커서 제외
const MAX_EVIDENCE_FACTS = 80; // OpenAI 스키마 enum이 과도하게 커지는 것 방지

function normalizeEvidence(value) {
  return String(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

// context에서 evidence 근거로 인정할 수 있는 "원본" 사실 문자열을 모은다(정규화 전).
// prompts/portfolio.js·diagnosis.js가 [사용 가능한 근거] 화이트리스트 블록 + JSON
// 스키마 enum 양쪽에 그대로 쓰고, buildGroundedFacts는 이 위에 정규화만 얹는다.
//
// 범위는 엄격히 "보유한 것의 고유명사"(과목명/자격증명/스킬명/수상명/경험명)로
// 제한한다. 다음은 둘 다 넣지 않는다:
// - targetJob(목표 직무 요건) — "해야 할 일"이지 사용자가 "한 일"이 아니다. 넣으면
//   targetJob.responsibilities 같은 문구가 evidence로 붙어 "게임엔진 개발 경험" 같은
//   지어낸 문장도 근거 있는 것처럼 통과해버린다.
// - academic.pendingRequirements — 이것도 "아직 못 채운 졸업요건"이라 targetJob과
//   같은 범주다. 한 번 넣었다가 "어학성적 TOEIC"(미충족 요건)이 실제 TOEIC 성적
//   보유를 뜻하는 것처럼 강점 evidence로 인용되는 사고가 실제로 있었다.
// - profile.major/enrollmentStatus, academic.gpa/학점 — 이들은 evidence 배열에
//   원문으로 나열할 "항목"이 아니라 body 문장 안에서 값으로 인용되는 것들이다
//   (프롬프트 규칙 4가 "GPA는 그대로 인용" 별도로 이미 허용). evidence 화이트리스트에
//   넣으면 오히려 범위가 애매해져서, 정작 이 화이트리스트가 막아야 할 "고유명사
//   지어내기"에 대한 방어력이 흐려진다.
// targetJob/pendingRequirements는 gaps 작성 참고용으로 [입력 데이터]에는 그대로 남지만
// 화이트리스트엔 안 넣는다.
//
// experiences[].note(자유 서술형 텍스트) 안의 개별 기술명(React, MyBatis 등)은 여기
// 넣지 않는다 — 한 번 토큰 단위로 쪼개 넣어봤지만, "AI"/"API"/"Database"/"Project"
// 같은 흔한 단어까지 화이트리스트에 올라가 evidence 검증 자체가 무력화되는 부작용이
// 있었다. note 내용은 evidence 배열로 증명할 항목이 아니라 body 문장 안에서 "항목명
// (예: 코딩 부트캠프) 근거로 서술"하는 대상이다 — 근거는 항목명 하나로 충분하고,
// note를 사실대로 서술하는지는 프롬프트 규칙(입력에 없는 기술을 추가하지 마라)으로
// 다룬다.
function collectEvidenceFacts(context) {
  const facts = new Set();
  const add = v => {
    if (typeof v !== 'string' && typeof v !== 'number') return;
    const str = String(v).trim();
    if (str.length >= MIN_FACT_LENGTH) facts.add(str);
  };

  (context?.academic?.majorCourses || []).forEach(c => add(c.name));
  (context?.academic?.currentSubjects || []).forEach(s => add(s.name));
  (context?.specs?.certifications || []).forEach(c => add(c.name));
  (context?.specs?.skills || []).forEach(s => add(s.name));
  (context?.specs?.languages || []).forEach(l => { add(l.testName); add(l.language); });
  (context?.specs?.awards || []).forEach(a => add(a.name));
  (context?.specs?.experiences || []).forEach(e => add(e.title));
  (context?.certSchedule || []).forEach(c => add(c.certName));

  return [...facts].slice(0, MAX_EVIDENCE_FACTS);
}

function buildGroundedFacts(context) {
  return new Set(collectEvidenceFacts(context).map(normalizeEvidence));
}

function isEvidenceGrounded(evidence, facts) {
  const normalized = normalizeEvidence(evidence);
  for (const fact of facts) {
    if (normalized.includes(fact)) return true;
  }
  return false;
}

// LLM이 만든 evidence 문자열이 실제 context의 사실을 포함하는지 대조 — 없으면 해당
// evidence만 제거하고, evidence가 전부 사라지면 section 자체를 버린다(할루시네이션
// 방어 핵심 장치). section이 하나도 안 남으면 통째로 invalid 처리해 빈 포트폴리오가
// 'done'으로 저장되는 것을 막는다.
function validatePortfolio(data, context) {
  const errors = [];

  if (!Array.isArray(data?.sections) || data.sections.length === 0) {
    return { valid: false, errors: ['sections가 비어있거나 배열이 아님'], sanitized: null };
  }

  const facts = buildGroundedFacts(context);

  const sections = data.sections
    .map((section, idx) => {
      const rawEvidence = Array.isArray(section.evidence) ? section.evidence : [];
      const evidence = rawEvidence.filter(e => typeof e === 'string' && e.trim() && isEvidenceGrounded(e, facts));

      if (evidence.length < rawEvidence.length) {
        errors.push(`sections[${idx}]에서 존재하지 않는 evidence ${rawEvidence.length - evidence.length}개 제거`);
      }

      return {
        heading: String(section.heading || '').trim(),
        body: String(section.body || '').trim(),
        evidence,
      };
    })
    .filter((section, idx) => {
      const keep = section.heading && section.body && section.evidence.length > 0;
      if (!keep) errors.push(`sections[${idx}](${section.heading || '제목없음'})는 근거 없는 내용이라 통째로 제외`);
      return keep;
    });

  if (sections.length === 0) {
    return { valid: false, errors: [...errors, '근거 있는 섹션이 하나도 남지 않음'], sanitized: null };
  }

  return {
    valid: true,
    errors,
    sanitized: {
      summary: String(data?.summary || '').trim() || null,
      sections,
    },
  };
}

const GAP_SEVERITY_ENUM = ['high', 'medium', 'low'];
const GAP_ACTION_TYPE_ENUM = ['cert', 'project', 'course', 'language', 'experience', 'none'];

// suggestedFields.field가 이 패턴으로 끝나면 "분야명"이 아니라 과목명처럼 보이는
// 것으로 간주해 제거한다 — 개설 과목 마스터 데이터가 DB에 없어서, 학교에 실제로
// 있는지 확인할 방법이 없는 구체적 과목명을 LLM이 지어내면 그대로 통과해버린다
// (프롬프트 규칙 14만으로는 100% 방어가 안 됨 — 정규식으로 이중 방어).
const COURSE_NAME_PATTERN = /(론|개론|실습|특강|세미나|입문|연습)$/;
const MAX_SUGGESTED_FIELDS = 3;

// validatePortfolio와 반대 정책: strengths의 evidence가 전부 걸러져 0개가 돼도
// 진단 자체는 valid:true를 유지한다 — overview/gaps/scores만으로도 진단은 성립한다
// (포트폴리오는 evidence 없는 섹션이 곧 콘텐츠 없음이라 무효 처리하지만, 진단은
// "부족한 점"이 핵심이라 강점 목록이 비어도 유효한 결과다). gaps가 배열이 아닌
// 경우만 진단의 핵심이 없는 것이므로 invalid 처리한다.
//
// graduationSummary는 diagnosisService가 graduationAdvisor.summarizeGraduation(context)로
// 미리 계산해 넘긴다 — hasElectiveRoom이 false인데 LLM이 suggestedFields를 채워
// 보내는 경우(프롬프트 규칙 16 위반)를 걸러내려면 필요하다.
function validateDiagnosis(data, context, graduationSummary) {
  const errors = [];

  if (!Array.isArray(data?.gaps)) {
    return { valid: false, errors: ['gaps가 배열이 아님'], sanitized: null };
  }

  const facts = buildGroundedFacts(context);

  const rawStrengths = Array.isArray(data?.strengths) ? data.strengths : [];
  const strengths = rawStrengths
    .map((strength, idx) => {
      const rawEvidence = Array.isArray(strength.evidence) ? strength.evidence : [];
      const evidence = rawEvidence.filter(e => typeof e === 'string' && e.trim() && isEvidenceGrounded(e, facts));

      if (evidence.length < rawEvidence.length) {
        errors.push(`strengths[${idx}]에서 존재하지 않는 evidence ${rawEvidence.length - evidence.length}개 제거`);
      }

      return {
        title: String(strength.title || '').trim(),
        body: String(strength.body || '').trim(),
        evidence,
      };
    })
    .filter((strength, idx) => {
      const keep = strength.title && strength.body && strength.evidence.length > 0;
      if (!keep) errors.push(`strengths[${idx}](${strength.title || '제목없음'})는 근거 없는 내용이라 제외`);
      return keep;
    });

  const gaps = data.gaps
    .filter(g => g && typeof g.item === 'string' && g.item.trim())
    .map(g => ({
      item: g.item.trim(),
      reason: typeof g.reason === 'string' ? g.reason : null,
      severity: GAP_SEVERITY_ENUM.includes(g.severity) ? g.severity : 'medium',
      actionType: GAP_ACTION_TYPE_ENUM.includes(g.actionType) ? g.actionType : 'none',
    }));

  // hasElectiveRoom이 false면(전공선택·교양선택 모두 남은 학점 없음) "분야로
  // 채우기" 제안 자체가 성립하지 않는다 — 프롬프트 규칙 16을 LLM이 어겨도
  // 구조적으로 막는다.
  const rawSuggestedFields = graduationSummary?.hasElectiveRoom
    ? (Array.isArray(data?.suggestedFields) ? data.suggestedFields : [])
    : [];
  const seenFields = new Set();
  const suggestedFields = [];
  rawSuggestedFields.forEach((s, idx) => {
    const field = typeof s?.field === 'string' ? s.field.trim() : '';
    if (!field) return;

    if (COURSE_NAME_PATTERN.test(field)) {
      errors.push(`suggestedFields[${idx}](${field})는 과목명처럼 보여 제외`);
      return;
    }

    const normalizedField = field.toLowerCase();
    if (seenFields.has(normalizedField)) {
      errors.push(`suggestedFields[${idx}](${field})는 중복이라 제외`);
      return;
    }
    seenFields.add(normalizedField);

    suggestedFields.push({
      field,
      reason: typeof s.reason === 'string' ? s.reason.trim() || null : null,
    });
  });

  if (suggestedFields.length > MAX_SUGGESTED_FIELDS) {
    errors.push(`suggestedFields가 ${MAX_SUGGESTED_FIELDS}개를 초과해 앞 ${MAX_SUGGESTED_FIELDS}개만 사용`);
  }

  return {
    valid: true,
    errors,
    sanitized: {
      overview: String(data?.overview || '').trim() || null,
      strengths,
      gaps,
      suggestedFields: suggestedFields.slice(0, MAX_SUGGESTED_FIELDS),
    },
  };
}

module.exports = { validateWeeklyPlan, validatePortfolio, validateDiagnosis, collectEvidenceFacts };
