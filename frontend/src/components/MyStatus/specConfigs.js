export const TEST_OPTIONS = {
  english: ['TOEIC', 'TOEFL', 'IELTS', 'OPIc', 'TEPS'],
  japanese: ['JLPT', 'JPT'],
  chinese: ['HSK', 'TSC'],
  other: ['기타'],
}

export const SPEC_CONFIGS = {
  award: {
    type: 'award',
    endpoint: '/spec/award',
    title: '수상경력 추가', 
    fields: [
      { key: 'name', label: '수상명', required: true, type: 'text', placeholder: '예: 캡스톤디자인 경진대회' },
      { key: 'organizer', label: '주최 기관', type: 'text', placeholder: '예: 한국정보처리학회' },
      { key: 'rank', label: '수상 등급', type: 'text', placeholder: '예: 최우수상, 금상' },
      { key: 'acquiredDate', label: '취득일', type: 'date' },
    ],
  },
  language: {
    type: 'language',
    endpoint: '/spec/language',
    title: '어학성적 추가', 
    fields: [
      {
        key: 'language',
        label: '언어',
        required: true,
        type: 'select',
        placeholder: '언어 선택',
        options: [
          { value: 'english', label: '영어 (TOEIC / TOEFL / IELTS / OPIc)' },
          { value: 'japanese', label: '일본어 (JLPT)' },
          { value: 'chinese', label: '중국어 (HSK)' },
          { value: 'other', label: '기타' },
        ],
      },
      { key: 'testName', label: '시험 종류', type: 'select', dependsOn: 'language', placeholder: '언어를 먼저 선택하세요' },
      { key: 'score', label: '점수 / 등급', required: true, type: 'text', placeholder: '예: 850, N2, 5급' },
      { key: 'acquiredDate', label: '취득일', type: 'date' },
      { key: 'expiryDate', label: '유효기간 만료일', type: 'date' },
    ],
  },
  experience: {
    type: 'experience',
    endpoint: '/spec/experience',
    title: '경험 / 활동 / 교육 추가', // 원본 버그: 수정 모드에서도 안 바뀜
    fields: [
      { key: 'title', label: '활동명', required: true, type: 'text', placeholder: '예: 교내 캡스톤 프로젝트' },
      { key: 'host', label: '주최 기관', type: 'text', placeholder: '예: OO대학교 SW중심대학사업단' },
      { key: 'location', label: '장소', type: 'text', placeholder: '예: 서울' },
      { key: 'startDate', label: '시작일', type: 'date' },
      { key: 'endDate', label: '종료일', type: 'date' },
      { key: 'note', label: '활동 설명', type: 'textarea', placeholder: '활동 내용을 간단히 적어주세요' },
    ],
  },
  skill: {
    type: 'skill',
    endpoint: '/spec/skill',
    dynamicTitles: { add: '스킬 추가', edit: '스킬 수정' },
    fields: [
      { key: 'name', label: '스킬명', required: true, type: 'text', placeholder: '예: React, SQL, Figma' },
      {
        key: 'level',
        label: '숙련도',
        required: true,
        type: 'select',
        placeholder: '선택',
        options: [
          { value: '하급', label: '하급' },
          { value: '중급', label: '중급' },
          { value: '고급', label: '고급' },
        ],
      },
    ],
  },
}
