// services/specService.js
const UserSkill = require('../models/User_skills');

const ARRAY_FIELD = {
  award: 'userAward',
  language: 'userLanguage',
  experience: 'userExperience',
};

async function pushSpec(userId, type, item) {
  const field = ARRAY_FIELD[type];
  if (!field) throw new Error('알 수 없는 스펙 유형');
  return UserSkill.findOneAndUpdate(
    { userId },
    { $push: { [field]: item } },
    { new: true, upsert: true }
  );
}


module.exports = { pushSpec };