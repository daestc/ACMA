/* ================================================
   강의 등록 서비스 (대학관계자 전용)
   - 개별 강의 등록 / 목록 조회 / 삭제
   - CSV 업로드 일괄 등록 (seedLeacture.js 파싱 로직 기반)
   ================================================ */
const { Readable } = require('stream');
const csvParser = require('csv-parser');
const iconv = require('iconv-lite');
const { Lecture } = require('../models/Calendar');

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

// ── CSV 버퍼 → 강의 배열 ──────────────────────────
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
    const lectureMap = new Map(); // "교과명-분반" 키로 중복 제거
    const failedRows = [];        // 필수값 누락 등으로 건너뛴 행
    let rowNum = 1;               // 헤더 제외 데이터 행 번호

    Readable.from(text)
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
      }))
      .on('data', (row) => {
        rowNum++;
        const lecture = {
          classification: row['이수구분']?.trim(),
          courseName: row['교과명']?.trim(),
          section: parseInt(row['분반']?.trim(), 10) || 0, // 분반 없으면 0(없음)으로 저장
          credits: parseInt(row['학점']?.trim(), 10) || null,
          professor: row['담당교수']?.trim() || '미정',
          schedules: parseSchedules(row['강의시간']?.trim()),
        };

        if (lecture.classification && lecture.courseName && lecture.credits !== null) {
          lectureMap.set(`${lecture.courseName}-${lecture.section}`, lecture);
        } else {
          failedRows.push({ row: rowNum, reason: '필수값 누락 (이수구분/교과명/학점)' });
        }
      })
      .on('end', () => resolve({ lectures: Array.from(lectureMap.values()), failedRows }))
      .on('error', reject);
  });
}

// ── CSV 일괄 등록 (upsert) ────────────────────────
// 같은 교과명+분반은 갱신, 없으면 삽입 (기존 데이터는 지우지 않음)
async function bulkUpsertFromCsv(buffer, { year, semester, createdBy, university } = {}) {
  const { lectures, failedRows } = await parseCsvBuffer(buffer);

  if (lectures.length === 0) {
    const err = new Error('CSV에서 등록할 강의를 찾지 못했습니다. 헤더(이수구분,교과명,분반,학점,담당교수,강의시간)를 확인해주세요.');
    err.code = 'EMPTY_CSV';
    throw err;
  }

  const ops = lectures.map(lec => ({
    updateOne: {
      // 같은 대학의 같은 과목+분반만 갱신 (다른 대학 강의는 건드리지 않음)
      filter: { university: university || null, courseName: lec.courseName, section: lec.section },
      update: {
        $set: {
          ...lec,
          university: university || null,
          ...(year ? { year } : {}),
          ...(semester ? { semester } : {}),
          ...(createdBy ? { createdBy } : {}),
        },
      },
      upsert: true,
    },
  }));

  const result = await Lecture.bulkWrite(ops, { ordered: false });

  return {
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
    total: lectures.length,
    failedRows,
  };
}

// ── 개별 강의 등록 ────────────────────────────────
async function createLecture({ classification, courseName, section, credits, professor, schedules, year, semester, createdBy, university }) {
  // 같은 대학 안에서만 과목+분반 중복 검사
  const exists = await Lecture.findOne({ university: university || null, courseName, section }).lean();
  if (exists) {
    const err = new Error(`이미 등록된 강의입니다. (${courseName} ${section ? section + '분반' : '분반 없음'})`);
    err.code = 'DUPLICATE_LECTURE';
    throw err;
  }

  return Lecture.create({
    university: university || null,
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

// ── 목록 조회 (검색 + 페이징, 소속 대학 강의만) ──
async function getLectures({ search = '', page = 1, limit = 20, university } = {}) {
  const filter = { university: university || null };
  if (search) {
    filter.$or = [
      { courseName: { $regex: search, $options: 'i' } },
      { professor:  { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Lecture.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // 범위를 벗어난 페이지 요청은 마지막 페이지로 보정
  page = Math.min(Math.max(1, page), totalPages);

  const items = await Lecture.find(filter)
    .sort({ courseName: 1, section: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { items, total, page, totalPages };
}

// ── 삭제 (소속 대학 강의만) ───────────────────────
async function deleteLecture(id, university) {
  const result = await Lecture.findOneAndDelete({ _id: id, university: university || null });
  if (!result) {
    const err = new Error('존재하지 않거나 소속 대학의 강의가 아닙니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return result;
}

module.exports = { parseSchedules, bulkUpsertFromCsv, createLecture, getLectures, deleteLecture };
