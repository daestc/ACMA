export const SEMESTER_OPTIONS = [
  '2026-1', '2025-2', '2025-1', '2024-2', '2024-1', '2023-2', '2023-1',
]

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
