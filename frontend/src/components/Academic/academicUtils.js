// 학기 선택 목록 — 가장 최근에 시작한 학기부터 과거 순서 (첫 항목 = 현재 학기).
// 3~8월은 1학기, 9월~다음 해 2월은 2학기로 본다. 예전엔 '2026-1'까지 하드코딩이라
// 2026-2학기부터는 현재 학기를 고를 수 없었다. (서버 utils/semesterOptions.js와 같은 규칙)
function buildSemesterOptions(count = 8) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const month = kst.getUTCMonth() + 1
  let year = month <= 2 ? kst.getUTCFullYear() - 1 : kst.getUTCFullYear()
  let term = month >= 3 && month <= 8 ? 1 : 2

  const options = []
  for (let i = 0; i < count; i += 1) {
    options.push(`${year}-${term}`)
    if (term === 1) { year -= 1; term = 2 } else { term = 1 }
  }
  return options
}

export const SEMESTER_OPTIONS = buildSemesterOptions()

export const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']

export const SUBJECT_TYPE_OPTIONS = [
  { value: 'major_required', label: '전필' },
  { value: 'major_elective', label: '전선' },
  { value: 'general_required', label: '교필' },
  { value: 'general_elective', label: '교선' },
  { value: 'free', label: '일선' },
]

const GRADE_MAP = {
  'A+': 4.5, A: 4.0,
  'B+': 3.5, B: 3.0,
  'C+': 2.5, C: 2.0,
  'D+': 1.5, D: 1.0,
  F: 0,
}

// 학기 코드 → { year, semesterNumber } (정렬용)
export function parseSemesterOrder(semester) {
  const match = String(semester || '').trim().match(/^(\d{4})-(\d)$/)
  if (!match) return { year: 0, semesterNumber: 0 }
  return { year: Number(match[1]), semesterNumber: Number(match[2]) }
}

export function formatSemesterLabel(semester) {
  return String(semester || '').replace(/^(\d{4})-(\d)$/, '$1-$2학기')
}

export function calcGpaFromRows(rows) {
  let pts = 0
  let creds = 0
  rows.forEach((row) => {
    // 과목명이 빈 행은 제외 — 과목을 하나도 안 넣었는데 "예상 평점 4.50"이 보이는 것을 막는다.
    if (!String(row.subjectName || '').trim()) return
    const c = parseInt(row.credits, 10) || 3
    const g = row.grade
    pts += (GRADE_MAP[g] ?? 0) * c
    creds += c
  })
  return creds ? (pts / creds).toFixed(2) : '0.00'
}

export const SEMESTER_STATUS_LABEL = {
  planned: { text: '계획', badgeClass: 'badge-blue' },
  in_progress: { text: '진행중', badgeClass: 'badge-amber' },
  completed: { text: '마감 완료', badgeClass: 'badge-green' },
}
