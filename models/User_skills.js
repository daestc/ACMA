const mongoose = require("mongoose");
const Schema = mongoose;

// 사용자 보유 스펙 스키마
const UserSkillSchema = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  // 보유 스킬
  userSkill: [
    {
      name: String, // 스킬 이름
      level: {
        type: String,
        enum: ["하급", "중급", "고급"]
      }
    }
  ],
  // 보유 어학점수
  userLanguage: [
    {
      language: {
        type: String,
        enum: ['english', 'japanese', 'chinese', 'other'],
        default: 'english',
        // english  영어 (TOEIC, TOEFL, IELTS, OPIc)
        // japanese 일본어 (JLPT)
        // chinese  중국어 (HSK)
        // other    기타
      },
      score:       { type: String, default: null }, // 점수 또는 등급 (예: '850', 'N2', '5급')
      acquiredDate:{ type: Date,   default: null }, // 취득일
      expiryDate:  { type: Date,   default: null }, // 유효기간 만료일
    }
  ],

  // 보유 수상경력
  userAward: [
    {
      name: String, // 수상 명
      organizer: { type: String, default: null }, // 주최 기관
      acquiredDate: { type: Date, default: null}, // 취득일
      rank: { type: String, default: null }, // 수상 등급 (최우수상, 금상 등)
    }
  ],

  // 경험 / 활동 / 교육
  userExperience: [
    {
      title: String,
      host: { type: String, default: null }, // 주최 기관
      location: { type: String, default: null }, // 장소
      startDate: { type: Date, default: null}, // 시작일
      endDate: { type: Date, default: null}, // 종료일
      note: { type: String, default: null }, // 활동 설명
    }
  ]
}, {
  timestamps: true
});

// 사용자 능력 모델 내보내기
module.exports = mongoose.model('UserSkill', UserSkillSchema);