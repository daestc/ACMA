const mongoose = require("mongoose");

const NotificationSettingsSchema = new mongoose.Schema({
  dailyScheduleAlert: { type: Boolean, default: true,  description: '일일 강의 알림' },
  dDayAlert:          { type: Boolean, default: true,  description: 'D-Day 알림' },
  pushNotification:   { type: Boolean, default: false, description: '푸시 알림' },
  emailNotification:  { type: Boolean, default: false, description: '이메일 알림' },
}, { _id: false });

const PomodoroSettingsSchema = new mongoose.Schema({
  workMinutes:              { type: Number, default: 25,  min: 1, max: 60  }, // 집중 시간
  shortBreakMinutes:        { type: Number, default: 5,   min: 1, max: 30  }, // 짧은 휴식
  longBreakMinutes:         { type: Number, default: 15,  min: 1, max: 60  }, // 긴 휴식
  sessionsUntilLongBreak:   { type: Number, default: 4,   min: 1, max: 10  }, // 긴 휴식까지 세션 수
}, { _id: false });

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
  // 사용자 비밀번호 (소셜 로그인 유저는 null)
  password: {
    type: String,
    required: false,
    minlength: 8,
  },
  // 소셜 로그인 제공자 ('local' | 'kakao' | 'naver' | 'google')
  provider: {
    type: String,
    enum: ['local', 'kakao', 'naver', 'google'],
    default: 'local',
  },
  // 소셜 로그인 제공자의 고유 ID
  providerId: {
    type: String,
    default: null,
  },
  // 회원 역할 ('student' = 학생 | 'staff' = 대학관계자 | 'admin' = 관리자)
  role: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: 'student',
  },
  // 대학관계자 승인 상태 (staff 가입 시 'pending', 관리자 승인 후 'approved')
  staffStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: null,
  },
  // 대학관계자 인증 사진 경로 (public/upload/...)
  verificationImage: {
    type: String,
    default: null,
  },
  // 학생 정보
  studentId: { type: String, default: null, trim: true }, // 학번
  // 소속 대학교
  university: { type: String, default: null, trim: true },
  // 전공
  major: { type: String, default: null, trim: true },
  // 재학 상태
  enrollmentStatus: { type: String, enum: ['재학', '휴학', '졸업'], default: '재학' },
  // 구독 플랜
  planType:     { type: String, enum: ['free', 'premium'], default: 'free' },
  // 포인트 잔액 (원 단위)
  pointBalance: { type: Number, default: 0, min: 0 },
  // 일일 AI 기능 사용량
  dailyUsage: {
    quiz:    { count: { type: Number, default: 0 }, date: { type: String, default: '' } },
    summary: { count: { type: Number, default: 0 }, date: { type: String, default: '' } },
  },
  // 보안
  passwordChangedAt: { type: Date,    default: null },  // 마지막 비밀번호 변경 시각
  
  // AI 기반 직무 적합도 점수
  careerAptitude: {
    certificationRatio: { type: Number, min: 0, max: 100 }, // 보유 자격증 일치율
    majorRatio: { type: Number, min: 0, max: 100 }, // 전공 관련성
    gpaRatio: { type: Number, min: 0, max: 100 }, // 직무 평균 GPA 달성률
    skillStackRatio: { type: Number, min: 0, max: 100 }, // 보유 스킬 일치율
    languageScoreRatio: { type: Number, min: 0, max: 100 }, // 보유 어학 성적 일치율
  },
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

  // todoList
  todoList: [
    {
      title: String, // 할 일
      note: String, // 확인 사항(완료시 "완료"로 변경)
      // 수행 날짜
      doDay: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // 습관 트래커
  habitTracker: [
    {
      title: String, // 항목명
      category: String, // 건강, 성장, 학습 ...
      // 수행 여부
      isCompleted: {
        type: Boolean, 
        default: false
      },
      // 최신 변경일 -> 날짜가 바뀌면 수행 여부를 false로 변경
      lastUpdatedDate: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // ── 알림 설정
  notificationSettings: { type: NotificationSettingsSchema, default: () => ({}) },

  // ── 뽀모도로 설정
  pomodoroSettings: { type: PomodoroSettingsSchema, default: () => ({}) },
}, {
  timestamps: true
});

// User 모델 내보내기
module.exports = mongoose.model('User', UserSchema);