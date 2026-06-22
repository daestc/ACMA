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

// 수정: 배열 안 _id로 찾아서 해당 항목 필드 교체
async function updateSpec(userId, type, itemId, item) {
  const field = ARRAY_FIELD[type];
  if (!field) throw new Error('알 수 없는 스펙 유형');
  // { 'userAward.$.name': ... } 형태로 set 객체 구성
  const setObj = {};
  for (const [k, v] of Object.entries(item)) setObj[`${field}.$.${k}`] = v;

  return UserSkill.findOneAndUpdate(
    { userId, [`${field}._id`]: itemId },
    { $set: setObj },
    { new: true }
  );
}

// 삭제: 배열에서 _id 매칭 항목 제거
async function deleteSpec(userId, type, itemId) {
  const field = ARRAY_FIELD[type];
  if (!field) throw new Error('알 수 없는 스펙 유형');
  return UserSkill.findOneAndUpdate(
    { userId },
    { $pull: { [field]: { _id: itemId } } },
    { new: true }
  );
}

module.exports = { pushSpec, updateSpec, deleteSpec };