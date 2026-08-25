import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🎓',
    title: '스마트 학사 관리',
    desc: 'GPA 계산기, 졸업요건 설정, 목표 GPA 시뮬레이터로 학업 현황을 한눈에 파악하고 전략적으로 관리하세요.',
  },
  {
    icon: '🤖',
    title: 'AI 커리어 로드맵',
    desc: '내 전공, 자격증, GPA를 기반으로 AI가 맞춤형 커리어 로드맵과 직무 적합도를 분석해 다음 목표를 제안합니다.',
  },
  {
    icon: '📖',
    title: 'AI PDF 요약 & 퀴즈',
    desc: '교재나 강의자료를 업로드하면 AI가 핵심 요약, 개념정리 표, 키워드를 추출하고 퀴즈를 자동 생성합니다.',
  },
  {
    icon: '📅',
    title: '통합 캘린더 & D-Day',
    desc: '강의 시간표, 자격증 시험일, 장학금 마감일을 한곳에서 관리하고 날씨 정보와 함께 확인하세요.',
  },
  {
    icon: '💼',
    title: '진로 정보 탐색',
    desc: '보유 자격증 기반 직무 추천, 자격증 세부 정보(진로·전망·수행직무), Q-net 원서접수 링크까지 한번에.',
  },
  {
    icon: '🍅',
    title: '뽀모도로 타이머',
    desc: '집중 25분, 휴식 5분 사이클로 학습 효율을 높이고 주간 학습 리포트로 내 공부 패턴을 분석하세요.',
  },
]

function Landing() {
  return (
    <>
      {/* 상단 네비게이션 */}
      <nav className="landing-nav">
        <div className="landing-logo">AcadMe</div>
        <div className="landing-nav-right">
          <Link className="landing-nav-login" to="/auth/login">로그인</Link>
          <Link className="landing-nav-cta" to="/auth/register">무료로 시작하기</Link>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <div className="landing-hero">
        <div className="landing-badge">🎓 대학생 맞춤형 학사관리 플랫폼</div>
        <h1 className="landing-h1">
          모든 학업 성장을<br />
          <span>한 곳에서</span> 관리하세요.
        </h1>
        <p className="landing-sub">
          학점 관리부터 자격증, 직무 적합도 분석까지<br />
          당신의 커리어 로드맵을 AcadMe와 함께 시작하세요.
        </p>
        <div className="landing-btns">
          <Link className="landing-btn-main" to="/auth/register">지금 시작하기 →</Link>
          <Link className="landing-btn-ghost" to="/auth/login">기존 계정으로 로그인</Link>
        </div>
      </div>

      {/* 대시보드 미리보기 목업 */}
      <div className="landing-preview">
        <div className="landing-mockup">
          <div className="landing-mockup-inner">
            {/* 사이드바 */}
            <div className="lm-sidebar">
              <div className="lm-logo">AcadMe</div>
              <div className="lm-nav">
                <div className="lm-item active">🏠 홈</div>
                <div className="lm-item">📅 캘린더</div>
                <div className="lm-item">⭐ MyStatus</div>
                <div className="lm-item">📢 공지사항</div>
                <div className="lm-item">🎓 학사관리</div>
                <div className="lm-item">📖 공부</div>
                <div className="lm-item">💼 진로정보</div>
              </div>
            </div>
            {/* 메인 콘텐츠 */}
            <div className="lm-main">
              <div className="lm-topbar">안녕하세요, 김민준님 👋</div>
              <div className="lm-cards">
                <div className="lm-card"><div className="lm-card-val" style={{ color: '#3d5af1' }}>3.8</div><div className="lm-card-lbl">현재 평점</div></div>
                <div className="lm-card"><div className="lm-card-val" style={{ color: '#059669' }}>92</div><div className="lm-card-lbl">이수 학점</div></div>
                <div className="lm-card"><div className="lm-card-val" style={{ color: '#d97706' }}>14h</div><div className="lm-card-lbl">주간 공부</div></div>
                <div className="lm-card"><div className="lm-card-val" style={{ color: '#7c3aed' }}>3</div><div className="lm-card-lbl">자격증</div></div>
              </div>
              <div className="lm-row">
                <div className="lm-box">
                  <div className="lm-box-title">졸업 요건</div>
                  <div className="lm-bar-row"><div className="lm-bar-lbl">전공필수</div><div className="lm-bar-track"><div className="lm-bar-fill" style={{ width: '76%', background: '#3d5af1' }} /></div></div>
                  <div className="lm-bar-row"><div className="lm-bar-lbl">전공선택</div><div className="lm-bar-track"><div className="lm-bar-fill" style={{ width: '70%', background: '#7c3aed' }} /></div></div>
                  <div className="lm-bar-row"><div className="lm-bar-lbl">교양필수</div><div className="lm-bar-track"><div className="lm-bar-fill" style={{ width: '90%', background: '#059669' }} /></div></div>
                  <div className="lm-bar-row"><div className="lm-bar-lbl">교양선택</div><div className="lm-bar-track"><div className="lm-bar-fill" style={{ width: '50%', background: '#d97706' }} /></div></div>
                </div>
                <div className="lm-box">
                  <div className="lm-box-title">직무 적합도 — 백엔드 개발자</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60 }}>
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="22" fill="none" stroke="#e5e8f0" strokeWidth="6" />
                      <circle
                        cx="30" cy="30" r="22" fill="none" stroke="#3d5af1" strokeWidth="6"
                        strokeDasharray="108 138" strokeDashoffset="35" strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '30px 30px' }}
                      />
                      <text x="30" y="35" textAnchor="middle" fill="#3d5af1" fontSize="11" fontWeight="800" fontFamily="DM Sans">78%</text>
                    </svg>
                  </div>
                  <div style={{ fontSize: 7, color: '#aaa', textAlign: 'center', marginTop: 4 }}>보유자격증 95% · 전공관련성 88%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 기능 소개 */}
      <div className="landing-features">
        {FEATURES.map(f => (
          <div className="lf-item" key={f.title}>
            <div className="lf-icon">{f.icon}</div>
            <div className="lf-title">{f.title}</div>
            <div className="lf-desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </>
  )
}

export default Landing
