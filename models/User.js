const mongoose = require("mongoose");

// User 스키마 정의
const UserSchema = new mongoose.Schema({
  // 사용자 이름
  name: {
    type: String,
    required: true, // 필수 필드
    trim: true, // 앞뒤 공백 제거
  },
  // 사용자 이메일 (로그인 ID 역할)
  email: {
    type: String,
    required: true, // 필수 필드
    unique: true, // 고유한 값이어야 함
    trim: true, // 앞뒤 공백 제거
    lowercase: true, // 소문자로 저장
    // 대학생 이메일 형식 유효성 검사 (예: @university.ac.kr)
    match: [/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/, '유효한 이메일 주소를 입력해주세요.'],
  },
  // 사용자 비밀번호 (보안을 위해 해싱하여 저장해야 함)
  password: {
    type: String,
    required: true, // 필수 필드
    minlength: 8, // 최소 8자 이상
  },
  // 소속 대학교
  university: {
    type: String,
    required: true,
    trim: true,
  },
  // 전공
  major: {
    type: String,
    required: true,
    trim: true,
  },
  // 학년
  grade: {
    type: Number,
    min: 1, // 최소 1학년
    max: 4, // 최대 4학년 (5년제 학과의 경우 5로 조정 가능)
  },
  // GPA (학점)
  gpa: {
    // 현재 GPA
    current: {
      type: Number,
      min: 0.0,
      max: 4.5, // 일반적인 GPA 범위 (학교 정책에 따라 조정 가능)
    },
    // 목표 GPA
    target: {
      type: Number,
      min: 0.0,
      max: 4.5,
    },
  },
  // 이수 학점
  creditsEarned: {
    type: Number,
    min: 0,
  },
  // 졸업 요건 학점 (전공필수, 전공선택, 교양필수, 교양선택)
  graduationRequirements: {
    majorRequired: {
      type: Number,
      min: 0,
    },
    majorElective: {
      type: Number,
      min: 0,
    },
    generalRequired: {
      type: Number,
      min: 0,
    },
    generalElective: {
      type: Number,
      min: 0,
    },
  },
  // AI 기반 직무 적합도 점수
  careerAptitude: {
    // 백엔드 개발자 직무 적합도 점수
    backendDeveloperScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    // 향후 다른 직무 적합도 점수 필드 추가 가능
  },
  // 자격증 목록
  certifications: [
    {
      name: String, // 자격증 이름
      status: { type: String, enum: ['취득', '준비중', '목표'] }, // 자격증 상태
      date: Date, // 취득일 또는 목표일
      icon: String, // UI 표시를 위한 아이콘 정보 (예: 이모지 또는 URL)
    },
  ],
  // 대외활동 및 수상 경력 목록
  extracurricularActivities: [
    {
      title: String, // 활동/수상 제목
      organization: String, // 주최 기관 또는 소속
      startDate: Date, // 활동 시작일
      endDate: Date, // 활동 종료일
      type: { type: String, enum: ['교내', '대외'] }, // 활동 유형
      description: String, // 상세 설명
    },
  ],
  // 어학 성적 목록
  languageScores: [
    {
      name: String, // 시험명 (예: TOEIC, TOEFL, JLPT)
      score: String, // 점수 또는 등급
      date: Date, // 취득일
      targetScore: String, // 목표 점수 (준비중인 경우)
      icon: String, // UI 표시를 위한 아이콘 정보 (예: 국기 이모지 또는 URL)
    },
  ],
  // AI 추천 커리어 로드맵
  careerRoadmap: [
    {
      title: String, // 로드맵 단계 제목
      description: String, // 단계별 설명
      status: { type: String, enum: ['done', 'current', 'todo'] }, // 단계 진행 상태
    },
  ],
  // 주간 요일별 공부 시간 기록 (Map 형태로 유연하게 관리)
  weeklyStudyHours: {
    type: Map,
    of: Number, // 예: { '월': 3, '화': 5, '수': 2.5, ... } (시간 단위)
  },
  // 과목별 누적 학습 시간
  subjectStudyHours: [
    {
      subject: String, // 과목명
      hours: Number, // 총 학습 시간 (시)
      minutes: Number, // 총 학습 시간 (분)
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

// User 모델 내보내기
module.exports = mongoose.model('User', UserSchema);
