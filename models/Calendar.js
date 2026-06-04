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
    endDate: { type: Date, default: null }, //추천: default: null 제거 후 required: true 추가
                                            //종료일이 없는경우 저장시, 시작일과 같은 값을 가지게 함 단 내부적으로 처리 필요
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

    // 수업 시간 (복수 가능 - ex. 화/목)
    schedule: [
      {
        // 0=일, 1=월 ~ 6=토
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        startTime: { type: String, required: true }, // "09:00"
        endTime: { type: String, required: true },   // "10:30"
      },
    ],

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


module.exports = {
  CalendarEvent: mongoose.model('CalendarEvent', calendarEventSchema),
  Timetable: mongoose.model('Timetable', timetableSchema),
  DailyChecklist: mongoose.model('DailyChecklist', dailyChecklistSchema),
};
