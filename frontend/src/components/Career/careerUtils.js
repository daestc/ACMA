import { useEffect, useState } from 'react'

export function useCascadingCategories(apiUrl, fields) {
  const [allRows, setAllRows] = useState([])
  const [values, setValues] = useState(() => fields.map(() => ''))

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setAllRows(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setAllRows([]) })
    return () => { cancelled = true }
  }, [apiUrl])

  const optionsPerLevel = fields.map((_, level) => {
    if (level === 0) {
      const set = new Set()
      allRows.forEach((row) => { if (row[fields[0]]) set.add(row[fields[0]]) })
      return Array.from(set)
    }
    const selectedValues = values.slice(0, level)
    if (selectedValues.some((v) => !v)) return []
    const set = new Set()
    allRows.forEach((row) => {
      const match = selectedValues.every((v, i) => row[fields[i]] === v)
      if (match && row[fields[level]]) set.add(row[fields[level]])
    })
    return Array.from(set)
  })

  function setLevel(level, value) {
    setValues((prev) => {
      const next = [...prev]
      next[level] = value
      for (let i = level + 1; i < next.length; i++) next[i] = ''
      return next
    })
  }

  // allRows(원본 카테고리 전체 목록)도 함께 노출한다 — Career.jsx의 실시간 직무
  // 검색이 선택된 대/중/소/세분류 이름으로 categoryId를 역으로 찾아내는 데 필요하다.
  return { values, optionsPerLevel, setLevel, allRows }
}

// resolveFallbackByName(원본): my-certs 목록에서 이름만 알고 열었을 때(jmcd가 없을 때)
// /career/search-cert?keyword=이름 으로 부족한 필드를 보강한다.
export async function resolveCertFallbackByName(name, fallback = {}) {
  if (fallback.jmcd) return fallback
  try {
    const params = new URLSearchParams()
    if (name) params.set('keyword', name)
    const res = await fetch(`/career/search-cert?${params.toString()}`)
    if (!res.ok) return fallback
    const items = await res.json()
    if (!Array.isArray(items) || !items.length) return fallback
    const exact = items.find((item) => item.name === name) || items[0]
    return {
      ...fallback,
      jmcd: exact?.jmcd || fallback.jmcd || '',
      officialUrl: fallback.officialUrl || exact?.officialUrl || '',
      way: fallback.way || exact?.way || '',
      careerPath: fallback.careerPath || exact?.careerPath || '',
      field1: fallback.field1 || exact?.field1 || '',
      field2: fallback.field2 || exact?.field2 || '',
      seriesName: fallback.seriesName || exact?.seriesName || '',
      description: fallback.description || exact?.description || '',
    }
  } catch (err) {
    console.error('Failed to resolve certification fallback:', err)
    return fallback
  }
}

// fillWay(원본): 취득방법 텍스트를 ①②③... 또는 줄바꿈 기준으로 번호 매긴 단계로 쪼갠다.
export function splitWaySteps(wayText) {
  const text = String(wayText || '').trim()
  if (!text) return null
  const steps = text
    .replace(/\r\n/g, '\n')
    .split(/(?=①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|\n)/)
    .map((step) => step.trim())
    .map((step) => step.replace(/^\n+|\n+$/g, ''))
    .filter(Boolean)
  return steps.length > 1 ? steps : [text]
}

// fillProspect(원본): 진로/전망 텍스트는 '-'로 구분된 단락이 많아서 별도 처리.
export function splitProspectParagraphs(prospectText) {
  const text = String(prospectText || '').trim()
  if (!text) return null
  const items = text.split('-').map((item) => item.trim()).filter(Boolean)
  return items.length > 1 ? items : [text]
}

// renderPassRateSection(원본)의 데이터 그룹핑 부분만 — 연도 내림차순, 종류(필기/실기)별,
// 회차 내림차순.
export function groupPassRates(records) {
  const yearMap = new Map()
  records.forEach((record) => {
    const key = String(record.year || '미상')
    if (!yearMap.has(key)) yearMap.set(key, [])
    yearMap.get(key).push(record)
  })
  return Array.from(yearMap.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, yearRecords]) => ({
      year,
      written: yearRecords.filter((r) => r.examType === 'written').slice().sort((a, b) => (parseInt(b.session, 10) || 0) - (parseInt(a.session, 10) || 0)),
      practical: yearRecords.filter((r) => r.examType === 'practical').slice().sort((a, b) => (parseInt(b.session, 10) || 0) - (parseInt(a.session, 10) || 0)),
    }))
}

export const CAREER_PAGE_SIZE = 10
