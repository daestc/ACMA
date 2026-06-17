const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * [calendar_events] 컬렉션
 * 사용자의 월별 일정 / D-Day 이벤트
 */
const calendarEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    startDate: { type: Date, required: true},
    endDate: { type: Date, default: null }, //추천: default: null 제거 후 required: true 추가                                 //종료일이 없는경우 저장시, 시작일과 같은 값을 가지게 함 단 내부적으로 처리 필요
    isAllDay: { type: Boolean, default: true },
    // 카테고리: 강의 | 시험 | 과제 | 자격증 | 공지 | 기타
    category: {
      type: String,
      enum: ['lecture', 'exam', 'assignment', 'certification', 'notice', 'personal', 'other'],
      default: 'personal',
    },

    // D-Day 설정 여부
    isDday: { type: Boolean, default: false },

    color: { type: String, default: '#3B82F6' }, // 달력 표시 색상

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

calendarEventSchema.index({ userId: 1, startDate: 1 });
calendarEventSchema.index({ userId: 1, isDday: 1 });


/**
 * [timetables] 컬렉션
 * 강의 / 수업 시간표 (주간 시간표)
 */
const timetableSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // 학기 구분 (ex. "2025-1", "2025-2")
    semester: { type: String, default: null }, //수정: required 제거

    // 수정: 과목 정보만 아닌 알바등 반복일정을 넣을 수 있기 때문에 일부 명칭 변경
    title: { type: String, required: true, trim: true }, //수정: subjectName -> title
    location: { type: String, default: null }, //수정: classroom -> location

    type: { //추가: 
      type: String,
      // enum: ['lecture', 'partTime', 'study', 'other'], //강의, 알바, 공부, 기타
      // enum을 삭제하고 사용자가 원하는 category로 설정할 수 있게
      default: 'lecture',
    },
    
    professorName: { type: String, default: null },
    credits: { type: Number, default: 0 },

    // 색상 (시간표 셀 색상)
    color: { type: String, default: '#60A5FA' },

    // 수업 시간 (복수 가능 - ex. 화/목) //5/14 수정. 추가 검증 
    schedule: {
      type: [
        {
          dayOfWeek: { type: Number, min: 0, max: 6, required: true },
           //5/14 수정: 문자열 형식 검증 추가
          startTime: { 
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/
          },
          endTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/
          },
        },
      ],
      required: true,
      validate: {
        validator: arr => Array.isArray(arr) && arr.length > 0,
        message: '시간표 시간 정보는 최소 1개 이상 필요합니다.',
      },
    },
    

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

timetableSchema.index({ userId: 1, semester: 1 });


/**
 * [daily_checklists] 컬렉션
 * 일일 진행 스케줄 체크리스트
 */
const dailyChecklistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // "2026-04-16" 형식

    items: [
      {
        content: { type: String, required: true },
        isCompleted: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
        order: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

dailyChecklistSchema.index({ userId: 1, date: 1 }, { unique: true });

// 1. 강의 시간 세부 정보 스키마 (서브 도큐먼트)
const ScheduleSchema = new mongoose.Schema({
  day: { type: String, required: true, enum: ['월', '화', '수', '목', '금', '토', '일'] },
  startTime: { type: String, required: true }, // "11:30" (화면 표시용)
  endTime: { type: String, required: true },   // "13:30" (화면 표시용)
  startMinute: { type: Number, required: true }, // 690 (쿼리/비교 연산용)
  endMinute: { type: Number, required: true }    // 810 (쿼리/비교 연산용)
}, { _id: false }); // 서브 도큐먼트의 자체 ID 생성을 막아 용량 절약

// 2. 전체 강의(분반별) 스키마
const LectureSchema = new mongoose.Schema({
  university: { type: String, default: null },      // 개설 대학 (등록한 관계자의 소속 대학)
  classification: { type: String, required: true }, // 이수구분 (예: "교필", "전선")
  courseName: { type: String, required: true },     // 교과명 (예: "AI시대의컴퓨팅사고")
  section: { type: Number, required: true },        // 분반 (예: 1, 2, 3)
  credits: { type: Number, required: true },        // 학점 (예: 2)
  professor: { type: String, default: "미정" },     // 담당교수
  schedules: [ScheduleSchema],                      // 강의시간 배열 (복수 시간 대응)
  year: { type: Number, default: 2026 },            // 개설 연도 (복수 학기 관리용)
  semester: { type: String, default: "1학기" },      // 개설 학기
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // 등록한 대학관계자
}, { timestamps: true }); // 생성/수정일 자동 기록

// 복합 인덱스 설정 (성능 최적화)
// 같은 대학 안에서만 과목+분반 중복 방지 (대학이 다르면 같은 과목명/분반 허용)
LectureSchema.index({ university: 1, courseName: 1, section: 1 }, { unique: true });
LectureSchema.index({ "schedules.day": 1, "schedules.startMinute": 1 }); // 시간대별 조회 성능 향상


module.exports = {
  CalendarEvent: mongoose.model('CalendarEvent', calendarEventSchema),
  Timetable: mongoose.model('Timetable', timetableSchema),
  DailyChecklist: mongoose.model('DailyChecklist', dailyChecklistSchema),
  Lecture: mongoose.model('Lecture', LectureSchema),
};
