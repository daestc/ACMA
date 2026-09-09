const mongoose = require("mongoose");

// Study 스키마 정의
const StudySchema = new mongoose.Schema({
  // 이 학습 기록과 연관된 사용자 ID (User 스키마 참조)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // User 모델을 참조
    required: true, // 필수 필드
  },
  // 업로드된 PDF 문서의 고유 ID 또는 경로
  documentId: {
    type: String,
    required: false, // PDF 업로드가 필수는 아닐 수 있음
  },
  // 문서 제목
  documentTitle: {
    type: String,
    trim: true,
  },
  // AI가 요약한 내용
  summary: {
    type: String,
  },
  // AI가 추출한 개념 정리 표
  conceptTable: [
    {
      concept: String, // 개념
      definition: String, // 정의
      timeComplexity: String, // 시간 복잡도
      features: String, // 특징
    },
  ],
  // AI가 추출한 핵심 키워드 목록
  keywords: [
    String,
  ],
  // AI가 생성한 퀴즈 목록
  quizzes: [
    {
      quizTitle: String, // 퀴즈 제목 (예: 자료구조 - 트리 & 그래프)
      questionCount: Number, // 총 문제 수
      difficulty: { type: String, enum: ["쉬움", "보통", "어려움"] }, // 퀴즈 난이도
      correctRate: Number, // 정답률 (예: 85%)
      lastAttemptDate: Date, // 마지막 퀴즈 시도일
      // 퀴즈 문제 및 정답은 별도의 서브컬렉션 또는 파일로 관리하는 것을 고려할 수 있음
    },
  ],
  // 생성일자
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // 최종 업데이트 일자
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Study 모델 내보내기
module.exports = mongoose.model("Study", StudySchema);
