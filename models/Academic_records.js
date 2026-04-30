const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * [academic_records] 컬렉션
 * 대학생 학기별 성적 및 학점 이수 현황
 */
const academicRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // 학기 구분 (ex. "2025-1")
    semester: { type: String, required: true },
    year: { type: Number, required: true },
    semesterNumber: { type: Number, enum: [1, 2], required: true }, // 1학기 | 2학기

    status: { //추가: 학기 상태. 
          type: String,
          enum: ['planned', 'in_progress', 'completed'],
          default: 'in_progress',
    },

    // 해당 학기 과목 목록
    subjects: [
      {
        subjectName: { type: String, required: true },
        subjectCode: { type: String, default: null },

        // 과목 구분: 전필 | 전선 | 교필 | 교선 | 일선
        subjectType: {
          type: String,
          enum: ['major_required', 'major_elective', 'general_required', 'general_elective', 'free'],
          required: true,
        },

        credits: { type: Number, required: true, min:0 },  // 학점 수 //수정: min:0 추가해 최솟값 지정 //수정전: credits: { type: Number, required: true }

        // 등급: A+ A B+ B C+ C D+ D F P NP
        grade: {
          type: String,
          enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'P', 'NP', null], //A, B,인지 A0, B0여부는 사용자가 직접 입력하는 형식이기 때문에 크게 문제될게 없어보임
          default: null,
        },

        isRetake: { type: Boolean, default: false }, //추가:재수강 여부
        // isIncludedInGPA: { type: Boolean, default: true }, //추가: gpa계산 여부 p/np는 gpa에서 없어야 하기 때문

        // 등급 → 평점 (4.5 기준)
        gradePoint: { type: Number, default: null }, //사용자 직접 입력 선호x

        isPassed: { type: Boolean, default: null },  //사용자 직접 입력 선호x
        memo: { type: String, default: null }, //필수 아님
      },
    ],

    // 학기 계산 결과 (자동 집계)
    semesterSummary: { //서버 자동 계산
      attemptedCredits: { type: Number, default: 0 },     // 이수 신청 학점 //수정: totalCredits -> attemptedCredits , 정확한 이름 정정
      earnedCredits: { type: Number, default: 0 },    // 취득 학점 (F 제외)
      semesterGPA: { type: Number, default: null },   // 학기 평점
    },
  },
  { timestamps: true }
);

academicRecordSchema.index({ userId: 1, semester: 1 }, { unique: true });


/**
 * [credit_summaries] 컬렉션
 * 대학생 전체 이수 학점 현황 요약 (실시간 집계용 캐시)
 */
const creditSummarySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // 영역별 이수 학점
    earnedCredits: {
      majorRequired: { type: Number, default: 0 },    // 전공필수
      majorElective: { type: Number, default: 0 },    // 전공선택
      generalRequired: { type: Number, default: 0 },  // 교양필수
      generalElective: { type: Number, default: 0 },  // 교양선택
      free: { type: Number, default: 0 },             // 일반선택
      total: { type: Number, default: 0 },            // 총 이수 학점
    },
    
    attemptedCreditsTotal: { type: Number, default: 0 }, //추가: 신청학점 총합

    // 누적 GPA
    cumulativeGPA: { type: Number, default: null },
    completedSemesters: { type: Number, default: 0 },

    // 마지막 업데이트
    lastCalculatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);


module.exports = {
  AcademicRecord: mongoose.model('AcademicRecord', academicRecordSchema),
  CreditSummary: mongoose.model('CreditSummary', creditSummarySchema),
};
