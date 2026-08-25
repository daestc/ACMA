// controllers/specController.js
const specService = require('../services/specService');
const UserSkill = require('../models/User_skills');

function makeHandler(type, build) {
  return async (req, res) => {
    try {
      const userId = req.session.user.id;
      if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

      const item = build(req.body);
      if (item.__error) return res.status(400).json({ success: false, message: item.__error });

      await specService.pushSpec(userId, type, item);
      res.json({ success: true });
    } catch (err) {
      console.error(`${type} 추가 에러:`, err);
      res.status(500).json({ success: false, message: '서버 에러' });
    }
  };
}

const addAward = makeHandler('award', (b) => {
  if (!b.name) return { __error: '수상명은 필수입니다.' };
  return { name: b.name, organizer: b.organizer, rank: b.rank, acquiredDate: b.acquiredDate };
});

const addLanguage = makeHandler('language', (b) => {
  if (!b.language) return { __error: '언어는 필수입니다.' };
  if (!b.score) return { __error: '점수/등급은 필수입니다.' };
  return { language: b.language, testName: b.testName, score: b.score, acquiredDate: b.acquiredDate, expiryDate: b.expiryDate };
});

const addExperience = makeHandler('experience', (b) => {
  if (!b.title) return { __error: '활동명은 필수입니다.' };
  return { title: b.title, host: b.host, location: b.location, startDate: b.startDate, endDate: b.endDate, note: b.note };
});

// specController.js — 네 배열 한 번에 내려주기
const getMySpecs = async (req, res) => {
  try {
    const userId = req.session?.user?._id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ success: false });
    const doc = await UserSkill.findOne({ userId }).lean();
    res.json({
      success: true,
      awards: doc?.userAward || [],
      languages: doc?.userLanguage || [],
      experiences: doc?.userExperience || [],
      skills: doc?.userSkill || [],
    });
  } catch (err) {
    console.error('스펙 조회 에러:', err);
    res.status(500).json({ success: false });
  }
};
// router.get('/mine', getMySpecs);

function makeUpdateHandler(type, build) {
  return async (req, res) => {
    try {
      const userId = req.session?.user?._id || req.session?.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

      const item = build(req.body);
      if (item.__error) return res.status(400).json({ success: false, message: item.__error });

      const result = await specService.updateSpec(userId, type, req.params.id, item);
      if (!result) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
      res.json({ success: true });
    } catch (err) {
      console.error(`${type} 수정 에러:`, err);
      res.status(500).json({ success: false, message: '서버 에러' });
    }
  };
}

function makeDeleteHandler(type) {
  return async (req, res) => {
    try {
      const userId = req.session?.user?._id || req.session?.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

      await specService.deleteSpec(userId, type, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(`${type} 삭제 에러:`, err);
      res.status(500).json({ success: false, message: '서버 에러' });
    }
  };
}

// build 함수는 add와 공유 — 따로 빼두면 재사용 가능
const buildAward = (b) => {
  if (!b.name) return { __error: '수상명은 필수입니다.' };
  return { name: b.name, organizer: b.organizer, rank: b.rank, acquiredDate: b.acquiredDate };
};
const buildLanguage = (b) => {
  if (!b.language) return { __error: '언어는 필수입니다.' };
  if (!b.score) return { __error: '점수/등급은 필수입니다.' };
  return { language: b.language, testName: b.testName, score: b.score, acquiredDate: b.acquiredDate, expiryDate: b.expiryDate };
};
const buildExperience = (b) => {
  if (!b.title) return { __error: '활동명은 필수입니다.' };
  return { title: b.title, host: b.host, location: b.location, startDate: b.startDate, endDate: b.endDate, note: b.note };
};

const SKILL_LEVEL_ENUM = ['하급', '중급', '고급'];
const buildSkill = (b) => {
  if (!b.name) return { __error: '스킬명은 필수입니다.' };
  if (!SKILL_LEVEL_ENUM.includes(b.level)) return { __error: '숙련도는 하급/중급/고급 중 하나여야 합니다.' };
  return { name: b.name, level: b.level };
};


module.exports = {
  addAward: makeHandler('award', buildAward),
  addLanguage: makeHandler('language', buildLanguage),
  addExperience: makeHandler('experience', buildExperience),
  addSkill: makeHandler('skill', buildSkill),
  updateAward: makeUpdateHandler('award', buildAward),
  updateLanguage: makeUpdateHandler('language', buildLanguage),
  updateExperience: makeUpdateHandler('experience', buildExperience),
  updateSkill: makeUpdateHandler('skill', buildSkill),
  deleteAward: makeDeleteHandler('award'),
  deleteLanguage: makeDeleteHandler('language'),
  deleteExperience: makeDeleteHandler('experience'),
  deleteSkill: makeDeleteHandler('skill'),
  getMySpecs,
};
