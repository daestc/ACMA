# ACMA (AcadMe)
> 대학생을 위한 진로 포트폴리오 관리 및 생성_학사관리 플랫폼

## 프로젝트 소개
- 흩어진 진로/학사 관련 정보들을 한곳에서 관리하도록 도와줄 수 있음
- 학사 측에서 학생의 정보를 효율적으로 접근하여 원하는 정보를 제공할 수 있도록 도와줄 수 있음
- 주요 타겟: 체계적인 자기개발을 원하는 대학생

## 주요 기능
- 진로정보: 직무/자격증 검색, 상세 정보, 합격률
- 학사관리: 학기별 성적 이력, 학점 추이
- 캘린더: 일정, 시간표, 날씨 연동
- 마이스테이터스: 스펙 관리
- 관리자: 대학별 통계
- AI 학습: Python으로 추출한 PDF 텍스트 기반 객관식 퀴즈 생성 및 풀이
- 계획: AI기반 커리큘럼 및 계획 생성

## 기술 스택
- Frontend: EJS, Vanilla JS, CSS
- Backend: Node.js, Express
- AI Pipeline: Python, pdfplumber, Anthropic Python SDK
- Database: MongoDB (Mongoose)
- 외부 API: work24(고용24 직업사전), Q-net(자격증 정보), 기상청(날씨)
- 아키텍쳐: Router → Controller → Service → Model 

## 프로젝트 구조
controllers/  컨트롤러

services/     비즈니스 로직

models/       DB 스키마

routes/       라우터

views/        EJS 템플릿

public/       정적 파일 (js, css)

config/       설정 파일

logs/         기록

middleware/   에러처리, 세션 관리, 인증

## 설치 및 실행
```bash
npm install
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r python/requirements.txt
# .env 설정 (아래 참고)
npm run dev
```

## 환경 변수 (.env)
| 변수 | 설명 | <br>
| MONGODB_URI | MongoDB 연결 주소 | <br>
| service_key | work24 API 키 | <br>
| qnet_service_key | Q-net API 키 | <br>
| SESSION_SECRET | 세션 암호화 키 | <br>
| KMA_SERVICE_KEY | 기상청 API 키 | <br>
| ANTHROPIC_API_KEY | Claude API 키 (PDF 퀴즈 생성 필수) | <br>
| ANTHROPIC_MODEL | Claude 모델 ID (선택, 기본 `claude-sonnet-4-6`) | <br>
| PYTHON_EXECUTABLE | Python 또는 가상환경 실행 파일 경로 | <br>

AI PDF 퀴즈의 구성과 처리 흐름은 [docs/AI_PDF_QUIZ.md](docs/AI_PDF_QUIZ.md)를 참고하세요.


## 팀 구성 / 역할 분담
| 이름 | 담당 | <br>
| 김민재 | 진로정보, 자격증_정보, mystatus 페이지, 관리자, 학점등록 및 통계 | <br>
| 김해든 | 시간표, 캘린더, 날씨 정보 | <br>
| 이다은 | 자격증_학사일정_장학금정보_ 일정 정보 | <br>
| 양창모 | 로그인/세션, 구독 기능 | <br>

## 개발 기간
2026.05.01 ~

## 할 것
-AI기반 커리큘럼 생성 및 계획 생성 <br>
-AI기반 PDF요약 및 학습 기능 추가 <br>
-구독 기능을 통한 AI기능 차등 제공 구현 <br>







