/* ================================================
   강의 등록 서비스 (대학관계자 전용)
   - 개별 강의 등록 / 목록 조회 / 삭제
   - CSV 업로드 일괄 등록 (seedLeacture.js 파싱 로직 기반)
   ================================================ */
const { Readable } = require('stream');
const path = require('path');
const csvParser = require('csv-parser');
const iconv = require('iconv-lite');
const XLSX = require('xlsx');
const { Lecture } = require('../models/Calendar');

// 시드 등으로 university가 null인 기존 데이터는 대진대학교 소속으로 취급
const LEGACY_NULL_UNIVERSITY = '대진대학교';

function normalizeUniversity(university) {
  const value = university?.trim();
  return value || null;
}

function requireUniversity(university) {
  const value = normalizeUniversity(university);
  if (!value) {
    const err = new Error('소속 대학 정보가 없어 강의를 처리할 수 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }
  return value;
}

// DB null → 표시·필터용 대학명
function resolveUniversityLabel(stored) {
  return stored?.trim() || LEGACY_NULL_UNIVERSITY;
}

// 관계자 소속 대학 기준 MongoDB 필터 (레거시 null 포함 여부)
function buildStaffUniversityFilter(staffUniversity) {
  const univ = normalizeUniversity(staffUniversity);
  if (!univ) return null;

  if (univ === LEGACY_NULL_UNIVERSITY) {
    return { $or: [{ university: univ }, { university: null }] };
  }
  return { university: univ };
}

function buildLectureListFilter(staffUniversity, search = '') {
  const univFilter = buildStaffUniversityFilter(staffUniversity);
  if (!univFilter) return null;

  const term = search.trim();
  if (!term) return univFilter;

  return {
    $and: [
      univFilter,
      {
        $or: [
          { courseName: { $regex: term, $options: 'i' } },
          { professor: { $regex: term, $options: 'i' } },
        ],
      },
    ],
  };
}

function buildLectureOwnershipFilter(staffUniversity, extra = {}) {
  const univFilter = buildStaffUniversityFilter(staffUniversity);
  if (!univFilter) return null;

  if (univFilter.$or) {
    return { $and: [univFilter, extra] };
  }
  return { ...univFilter, ...extra };
}

function formatLectureForOutput(lecture) {
  return {
    ...lecture,
    university: resolveUniversityLabel(lecture.university),
  };
}

// ── 강의시간 문자열 파싱 ──────────────────────────
// "월11:30-13:30,수14:00-15:30" → [{ day, startTime, endTime, startMinute, endMinute }]
function parseSchedules(scheduleStr) {
  if (!scheduleStr) return [];

  return scheduleStr.split(',').map(s => {
    s = s.trim();
    const day = s.charAt(0);
    if (!['월', '화', '수', '목', '금', '토', '일'].includes(day)) return null;

    const timeRange = s.substring(1).split('-');
    if (timeRange.length !== 2) return null;

    const [startHour, startMin] = timeRange[0].split(':').map(Number);
    const [endHour, endMin]     = timeRange[1].split(':').map(Number);
    if ([startHour, startMin, endHour, endMin].some(Number.isNaN)) return null;

    return {
      day,
      startTime: timeRange[0],
      endTime: timeRange[1],
      startMinute: startHour * 60 + startMin,
      endMinute: endHour * 60 + endMin,
    };
  }).filter(Boolean);
}

function cellStr(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function buildLectureFromRow(row) {
  const credits = parseInt(cellStr(row['학점']), 10);
  return {
    classification: cellStr(row['이수구분']),
    courseName: cellStr(row['교과명']),
    section: parseInt(cellStr(row['분반']), 10) || 0,
    credits: Number.isNaN(credits) ? null : credits,
    professor: cellStr(row['담당교수']) || '미정',
    schedules: parseSchedules(cellStr(row['강의시간'])),
  };
}

function collectLecturesFromRows(rows) {
  const lectureMap = new Map();
  const failedRows = [];

  rows.forEach(({ row, rowNum }) => {
    const lecture = buildLectureFromRow(row);
    if (lecture.classification && lecture.courseName && lecture.credits !== null) {
      lectureMap.set(`${lecture.courseName}-${lecture.section}`, lecture);
    } else {
      failedRows.push({ row: rowNum, reason: '필수값 누락 (이수구분/교과명/학점)' });
    }
  });

  return { lectures: Array.from(lectureMap.values()), failedRows };
}

// ── CSV / XLSX 버퍼 → 강의 배열 ──────────────────
// 한글 CSV 인코딩 대응: UTF-8 기본, 깨진 문자가 감지되면 EUC-KR로 재해석
function decodeCsvBuffer(buffer) {
  let text = buffer.toString('utf8');
  if (text.includes('\uFFFD')) {
    text = iconv.decode(buffer, 'euc-kr');
  }
  return text.replace(/^\uFEFF/, ''); // BOM 제거
}

function parseCsvBuffer(buffer) {
  const text = decodeCsvBuffer(buffer);

  return new Promise((resolve, reject) => {
    const rows = [];
    let rowNum = 1;

    Readable.from(text)
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
      }))
      .on('data', (row) => {
        rowNum++;
        rows.push({ row, rowNum });
      })
      .on('end', () => resolve(collectLecturesFromRows(rows)))
      .on('error', reject);
  });
}

function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { lectures: [], failedRows: [] };
  }

  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const rows = sheetRows.map((row, idx) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[String(key).replace(/^\uFEFF/, '').trim()] = value;
    }
    return { row: normalized, rowNum: idx + 2 };
  });

  return collectLecturesFromRows(rows);
}

function parseLectureFile(buffer, filename = '') {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.xlsx') {
    return Promise.resolve(parseExcelBuffer(buffer));
  }
  return parseCsvBuffer(buffer);
}

// ── CSV 일괄 등록 (upsert) ────────────────────────
// 같은 교과명+분반은 갱신, 없으면 삽입 (기존 데이터는 지우지 않음)
async function bulkUpsertFromCsv(buffer, { year, semester, createdBy, university, filename } = {}) {
  const univ = requireUniversity(university);
  const { lectures, failedRows } = await parseLectureFile(buffer, filename);

  if (lectures.length === 0) {
    const err = new Error('파일에서 등록할 강의를 찾지 못했습니다. 헤더(이수구분,교과명,분반,학점,담당교수,강의시간)를 확인해주세요.');
    err.code = 'EMPTY_CSV';
    throw err;
  }

  const ops = lectures.map(lec => ({
    updateOne: {
      filter: buildLectureOwnershipFilter(univ, {
        courseName: lec.courseName,
        section: lec.section,
      }),
      update: {
        $set: {
          ...lec,
          university: univ,
          ...(year ? { year } : {}),
          ...(semester ? { semester } : {}),
          ...(createdBy ? { createdBy } : {}),
        },
      },
      upsert: true,
    },
  }));

  let result;
  try {
    result = await Lecture.bulkWrite(ops, { ordered: false });
  } catch (err) {
    if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
      const dup = new Error('동일한 교과명·분반 강의가 이미 등록되어 있습니다. 목록에서 확인하거나 파일을 수정해주세요.');
      dup.code = 'DUPLICATE_LECTURE';
      throw dup;
    }
    throw err;
  }

  return {
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
    total: lectures.length,
    failedRows,
  };
}

// ── 개별 강의 등록 ────────────────────────────────
async function createLecture({ classification, courseName, section, credits, professor, schedules, year, semester, createdBy, university }) {
  const univ = requireUniversity(university);

  // 같은 대학(레거시 null 포함) 안에서만 과목+분반 중복 검사
  const exists = await Lecture.findOne(
    buildLectureOwnershipFilter(univ, { courseName, section }),
  ).lean();
  if (exists) {
    const err = new Error(`이미 등록된 강의입니다. (${courseName} ${section ? section + '분반' : '분반 없음'})`);
    err.code = 'DUPLICATE_LECTURE';
    throw err;
  }

  return Lecture.create({
    university: univ,
    classification,
    courseName,
    section,
    credits,
    professor: professor || '미정',
    schedules,
    ...(year ? { year } : {}),
    ...(semester ? { semester } : {}),
    ...(createdBy ? { createdBy } : {}),
  });
}

// 소속 대학 강의만 조회 (대진대는 university:null 레거시 포함)
async function getLectures({ search = '', page = 1, limit = 20, university } = {}) {
  const filter = buildLectureListFilter(university, search);
  if (!filter) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

  const total = await Lecture.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  page = Math.min(Math.max(1, page), totalPages);

  const items = await Lecture.find(filter)
    .sort({ courseName: 1, section: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    items: items.map(formatLectureForOutput),
    total,
    page,
    totalPages,
  };
}

// ── 삭제 (소속 대학 강의만) ───────────────────────
async function deleteLecture(id, university) {
  const univ = requireUniversity(university);
  const result = await Lecture.findOneAndDelete(
    buildLectureOwnershipFilter(univ, { _id: id }),
  );
  if (!result) {
    const err = new Error('존재하지 않거나 소속 대학의 강의가 아닙니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return result;
}

module.exports = { parseSchedules, bulkUpsertFromCsv, createLecture, getLectures, deleteLecture };
