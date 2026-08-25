import { formatSemesterLabel } from './academicUtils'

const TARGET_GPA = 3.9

function AcademicTrendChart({ records }) {
  const validRecords = records.filter((r) => Number.isFinite(r.semesterGPA))

  if (!validRecords.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, color: 'var(--text2)', fontSize: 13 }}>
        표시할 GPA 데이터가 없습니다.
      </div>
    )
  }

  const width = 760
  const height = 280
  const padding = { top: 28, right: 36, bottom: 54, left: 58 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const gpaValues = validRecords.map((r) => r.semesterGPA)
  const minGpa = Math.min(...gpaValues, TARGET_GPA)
  const yMax = 4.5
  const yMin = Math.max(0, Math.min(3.0, Math.floor((minGpa - 0.25) * 10) / 10))
  const yRange = Math.max(0.5, yMax - yMin)
  const stepX = validRecords.length === 1 ? 0 : chartWidth / (validRecords.length - 1)

  const toY = (value) => padding.top + ((yMax - value) / yRange) * chartHeight
  const toX = (index) => padding.left + index * stepX
  const points = validRecords.map((r, i) => `${toX(i)},${toY(r.semesterGPA)}`)
  const areaPoints = [`${padding.left},${padding.top + chartHeight}`, ...points, `${padding.left + chartWidth},${padding.top + chartHeight}`].join(' ')
  const bestRecord = validRecords.reduce((best, cur) => (cur.semesterGPA > best.semesterGPA ? cur : best), validRecords[0])

  const tickValues = []
  for (let value = yMax; value >= yMin; value -= 0.5) tickValues.push(Number(value.toFixed(1)))

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="학기별 GPA 추이 그래프">
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="var(--border)" strokeWidth="1" />
      <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="var(--border)" strokeWidth="1" />

      {tickValues.map((value) => {
        const y = toY(value)
        return (
          <g key={value}>
            <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="var(--border)" strokeWidth="0.7" strokeDasharray="3,4" />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="var(--text3)" fontSize="11" fontFamily="DM Sans">{value.toFixed(1)}</text>
          </g>
        )
      })}

      <polygon points={areaPoints} fill="var(--accent)" opacity="0.07" />
      {validRecords.length > 1 && (
        <polyline points={points.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {validRecords.map((record, index) => {
        const x = toX(index)
        const y = toY(record.semesterGPA)
        const isBest = record.semester === bestRecord.semester
        const color = isBest ? 'var(--green)' : 'var(--accent)'
        return (
          <g key={record.semester}>
            <circle cx={x} cy={y} r={isBest ? 6 : 5} fill={color} stroke="white" strokeWidth="2" />
            <text x={x} y={y - 14} textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="DM Sans">{record.semesterGPA.toFixed(2)}</text>
            <text x={x} y={height - 18} textAnchor="middle" fill="var(--text2)" fontSize="11" fontFamily="DM Sans">{formatSemesterLabel(record.semester)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default AcademicTrendChart
