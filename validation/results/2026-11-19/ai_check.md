# AI 추천 사유 점검 (2026-11-19)

- 실행 시각: 2026-11-19T08:22:46.786Z
- 프롬프트: recommendation.v3
- 대상 23명 중 AI 호출 23회
- AI 추천(사유 있음) 69개
- 스키마 위반: 목록 밖 jobCode 0건, 목록 밖 evidence 0건 (0이어야 한다 — 아니면 strict 스키마가 전달되지 않은 것)
- 검증기 errors 종류별: recommendations[n]에서 근거 목록에 없는 evidence N개 제거 ×1
- 사유 본문에 학생이 갖지 않은 자격증이 나온 문장: 4개 → ai_review.csv 판정 칸(보유처럼 씀 / 필요하다고 씀 / 기타)을 채운 뒤 --summarize
- 자격증 사전: 카탈로그 relatedCertifications 664개 이름(3자 이상)
- DB careerrecommendations 문서 수: 실행 전 25 → 후 25
