# ACMA (AcadMe) — 프로젝트 컨텍스트

> 이 파일은 Claude Code 세션 간 컨텍스트 유지를 위한 문서입니다.

---

## 프로젝트 개요

**AcadMe** — 대학생 종합 관리 플랫폼  
**스택**: Node.js + Express 5, MongoDB + Mongoose, EJS, Passport.js (세션 기반)  
**아키텍처**: MVC — `routes → controllers → services → models`  
**실행**: `npm run dev` (nodemon, port 3000)  
**현재 브랜치**: `feature/auth2`

---

## 팀 역할 분담 (git author 기준)

| 담당자 | 영역 |
|--------|------|
| **chang** (나) | 인증(Auth) — login, register, logout, OAuth, middleware, mypage 모달 |
| kimminjae | 학사관리 — AcademicRecord, CreditSummary, 졸업요건, 학점계산기 |
| 김해든 | 캘린더 — CalendarEvent, Timetable, 시간표 CRUD |
| daeun | 공지/알림 — Notice, Notification, 알림창 |
| Kimheesung | 사용자 — User CRUD, habitTracker, todoList, career |

---

## 내 담당 파일 (chang)

```
controllers/authController.js   ← 핵심
services/authService.js
config/passport.js              ← 카카오·네이버·구글 전략
config/logger.js
middleware/auth.js              ← requireLogin (세션 기반)
middleware/rateLimiter.js
routes/authRouter.js            ← /auth/*
views/pages/login.ejs
views/pages/register.ejs
views/partials/modals/mypage.ejs  ← 주의: 더미 데이터 하드코딩됨
public/js/register.js
```

---

## 현재 세션 구조

```js
req.session.user = {
  id:       user._id,
  name:     user.name,
  email:    user.email,
  major:    user.major,
  grade:    user.grade,
  provider: user.provider,   // 'local' | 'kakao' | 'naver' | 'google'
  // planId 추가 예정: 'free' | 'premium'
};
```

---

## 긴급 수정 사항 (내 담당)

### 1. mypage.ejs 더미 데이터 → 실세션 연동
`views/partials/modals/mypage.ejs` 의 김민준, 한국대학교 등 전부 하드코딩.
`<%= user.name %>`, `<%= user.major %>` 등으로 교체 필요.

### 2. 다른 라우터의 더미 requireLogin → 실제 미들웨어 교체

아래 라우터들이 더미 유저를 사용 중:

```
routes/calendarRouter.js
routes/careerRouter.js
routes/mystatusRouter.js
routes/noticeRouter.js
routes/studyRouter.js
routes/userRouter.js
```

각 파일 상단에 추가하고 더미 함수 제거:
```js
const { requireLogin } = require('../middleware/auth');
```

---

## 설계 결정: 시간표 → 학점계산기 자동 연동

**흐름**: 사용자 시간표 직접 입력 → 확정 시 AcademicRecord 자동 생성

### 필요한 DB 변경 (2개 필드 추가)

#### models/Calendar.js — Timetable에 추가
```js
subjectType: {
  type: String,
  enum: ['major_required', 'major_elective', 'general_required', 'general_elective', 'free'],
  default: null,  // 알바·공부 등 비학업은 null
},
```

#### models/Academic_records.js — subjects[] 내부에 추가
```js
timetableId: {
  type: Schema.Types.ObjectId,
  ref: 'Timetable',
  default: null,  // null=수동입력, ObjectId=시간표 자동생성
},
```

### 자동 연동 로직 (calendarService 또는 별도 enrollmentService)
```
Timetable 저장 확정
→ AcademicRecord.subjects[]에 status:'planned'로 자동 삽입
→ grade: null, gradePoint: null (학기 끝나면 사용자 입력)
→ timetableId: 해당 Timetable._id
```

### 시간 충돌 감지 (김해든과 협의)
```
POST /calendar/timetables 시 서버에서
같은 userId + semester의 기존 Timetable 조회
→ schedule[].dayOfWeek + startTime~endTime 겹침 체크
→ 충돌 시 400 반환
```

---

## 설계 결정: 결제 / 구독 시스템

**PG**: 토스페이먼츠 (샌드박스 테스트 가능)  
**플랜**: Free / Premium 2단계

### 새 컬렉션 3개 (models/ 에 추가)

**models/SubscriptionPlan.js**
```js
{
  planId:       { type: String, unique: true },  // 'free' | 'premium'
  name:         String,
  price:        Number,      // 월 구독료 (원)
  billingCycle: String,      // 'monthly' | 'yearly'
  features:     [String],
  isActive:     { type: Boolean, default: true },
}
```

**models/UserSubscription.js**
```js
{
  userId:      { type: ObjectId, ref: 'User', unique: true },
  planId:      String,
  status:      String,  // 'active' | 'trialing' | 'expired' | 'cancelled'
  startDate:   Date,
  endDate:     Date,
  autoRenew:   { type: Boolean, default: true },
  cancelledAt: Date,
  trialEndsAt: Date,
}
```

**models/Payment.js**
```js
{
  userId:        { type: ObjectId, ref: 'User', index: true },
  subscriptionId:{ type: ObjectId, ref: 'UserSubscription' },
  planId:        String,
  amount:        Number,
  pgOrderId:     { type: String, unique: true },  // 토스 주문번호
  pgPaymentKey:  String,
  method:        String,  // 'card' | 'kakaopay' | 'tosspay'
  status:        String,  // 'pending' | 'confirmed' | 'failed' | 'refunded'
  paidAt:        Date,
  refundedAt:    Date,
}
```

### 기존 모델 수정

**models/User.js** — 필드 추가:
```js
planId: { type: String, default: 'free' },  // 빠른 권한 체크용
```

**세션** — authController.js에서 planId 추가:
```js
req.session.user = { ...기존, planId: user.planId };
```

### 새 미들웨어 (middleware/plan.js)
```js
const requirePlan = (plan) => (req, res, next) => {
  if (req.session.user?.planId !== plan)
    return res.status(403).json({ upgrade: true });
  next();
};
module.exports = { requirePlan };
```

### 결제 라우터 (routes/paymentRouter.js 신규)
```
POST /payment/prepare   ← orderId 생성, Payment(pending) 저장
POST /payment/confirm   ← 토스 API 검증 → 구독 활성화 → 세션 갱신
POST /payment/webhook   ← 토스 비동기 콜백 (HMAC 서명 검증 필수!)
GET  /payment/history   ← 결제 내역
```

⚠️ **Webhook HMAC 검증 필수**: 미구현 시 위조 결제 가능

### 플랜별 기능 제한

| 기능 | Free | Premium |
|------|------|---------|
| 시간표 + 학점계산기 | ✓ | ✓ |
| 캘린더 + 진로정보 | ✓ | ✓ |
| 공지사항 | ✓ | ✓ |
| AI 학습 요약 (Study) | ✗ | ✓ |
| 고급 진로 분석 | ✗ | ✓ |

---

## 사이드바 UI 변경

**방향**: 상단 sidebar-user 블록 제거 → 하단 유저 카드로 일원화 (ChatGPT/Claude 방식)

`views/partials/sidebar.ejs` 수정:
```html
<!-- sidebar-footer 교체 -->
<div class="sidebar-footer">
  <div class="sidebar-user-card" onclick="openMyPageModal()">
    <div class="user-avatar"><%= user.name[0] %></div>
    <div class="user-info">
      <div class="user-name"><%= user.name %></div>
      <span class="plan-badge"><%= user.planId === 'premium' ? '✦ Premium' : 'Free' %></span>
    </div>
    <span>···</span>
  </div>
</div>
```

---

## 환경변수 (.env 추가 예정)

```
TOSS_SECRET_KEY=   ← 결제 시스템
TOSS_CLIENT_KEY=   ← 결제 시스템
```

---

## 알려진 버그 / 기술 부채

1. `models/Notification.js`에 CalendarEvent 스키마 중복 정의 → 제거 필요
2. `models/University_profile.js`에 `const { Schema } = mongoose` 누락 → 런타임 오류 가능
3. 모든 라우터 더미 requireLogin → 실제 미들웨어 교체 미완료
4. `mypage.ejs` 더미 데이터 실세션 연동 미완료
