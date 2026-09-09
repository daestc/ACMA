
export const QUIZ_MAX_FILE_SIZE = 20 * 1024 * 1024

export function isPdfFile(file) {
  return Boolean(file) && file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf')
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function shuffleOptions(question) {
  const pairs = question.options.map((text, originalIndex) => ({ text, originalIndex }))
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return {
    ...question,
    options: pairs.map((pair) => pair.text),
    answer_index: pairs.findIndex((pair) => pair.originalIndex === question.answer_index),
  }
}

export const POMO_WORK = 25 * 60
export const POMO_REST = 5 * 60

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
