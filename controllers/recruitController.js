const User = require('../models/User');
const Recruit = require('../models/Recruit');
const aiService = require('../services/recruitService');
const careerService = require('../services/careerService');
const logger = require('../config/logger');

// 사용자 입력을 RegExp에 넣기 전 특수문자 이스케이프 — ReDoS 방지
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RECRUIT_CATEGORIES = [
    '기획·전략', '마케팅·홍보·조사', '회계·세무·재무', '인사·노무·HRD', '총무·법무·사무', 'IT개발·데이터', '디자인',
    '영업·판매·무역', '고객상담·TM', '구매·자재·물류', '상품기획·MD', '운전·운송·배송', '서비스', '생산',
    '건설·건축', '의료', '연구·R&D', '교육', '미디어·문화·스포츠', '금융·보험', '공공·복지'
];

// 공통 쿼리 빌더 — getRecruitPage(SSR)와 getRecruitList(JSON API) 양쪽에서 사용
async function buildRecruitQuery(currentUser, params) {
    const { currentStatus, selectedRegions, selectedCategories } = params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = {};
    let aiMissingInfo = false;

    if (currentStatus === 'open') {
        query.$and = [
            { deadlineText: { $ne: '마감' } },
            { $or: [{ endDate: null }, { endDate: { $gte: today } }] }
        ];
    } else if (currentStatus === 'closed') {
        query.$or = [
            { deadlineText: '마감' },
            { endDate: { $lt: today } }
        ];
    } else if (currentStatus === 'scrap') {
        if (currentUser && currentUser.scrapedJobs) {
            query._id = { $in: currentUser.scrapedJobs };
        } else {
            query._id = null;
        }
    } else if (currentStatus === 'ai') {
        if (currentUser) {
            const userId = currentUser._id || currentUser.id;
            const careerData = await careerService.getMyCareerAndCertifications(userId);

            const targetJobObj = careerData.targetJob;
            const certsArray = careerData.certs || [];

            const jobName = targetJobObj && targetJobObj.title ? targetJobObj.title : null;
            const certNames = certsArray.length > 0
                ? certsArray
                    .filter(c => c.certificationId && c.certificationId.name)
                    .map(c => c.certificationId.name)
                    .join(', ')
                : null;

            if (!jobName && !certNames) {
                aiMissingInfo = true;
                query._id = null;
            } else {
                const aiResult = await aiService.getRecommendationKeywords(certNames || '무관', jobName || '무관');

                const queryConditions = [];
                if (aiResult.categories && aiResult.categories.length > 0) {
                    queryConditions.push({ saraminCategory: { $in: aiResult.categories } });
                }
                if (aiResult.keywords && aiResult.keywords.length > 0) {
                    const regexKeywords = aiResult.keywords.map(kw => new RegExp(escapeRegex(kw), 'i'));
                    queryConditions.push({ title: { $in: regexKeywords } });
                }

                if (queryConditions.length > 0) {
                    query.$and = [
                        { deadlineText: { $ne: '마감' } },
                        { $or: [{ endDate: null }, { endDate: { $gte: today } }] },
                        { $or: queryConditions }
                    ];
                } else {
                    query._id = null;
                }
            }
        } else {
            query._id = null;
        }
    }

    if (selectedRegions.length > 0) {
        query.region = { $in: selectedRegions.map(r => new RegExp(escapeRegex(r), 'i')) };
    }
    if (selectedCategories.length > 0) {
        query.saraminCategory = { $in: selectedCategories };
    }

    return { query, aiMissingInfo };
}

// 공통 파라미터 파싱
function parseRecruitParams(reqQuery) {
    const currentStatus = reqQuery.status || 'open';

    let selectedRegions = reqQuery.region || [];
    if (typeof selectedRegions === 'string') selectedRegions = [selectedRegions];

    let selectedCategories = reqQuery.category || [];
    if (typeof selectedCategories === 'string') selectedCategories = [selectedCategories];

    return { currentStatus, selectedRegions, selectedCategories };
}

// 공통 유저 조회 (세션 → DB 병합)
async function resolveCurrentUser(session) {
    let currentUser = session && session.user ? session.user : null;
    if (currentUser && currentUser.id) {
        const dbUser = await User.findById(currentUser.id).lean();
        if (dbUser) currentUser = { ...currentUser, ...dbUser };
    }
    return currentUser;
}

// 1. 채용정보 페이지 렌더링 (SSR)
exports.getRecruitPage = async (req, res) => {
    try {
        const currentUser = await resolveCurrentUser(req.session);
        const params = parseRecruitParams(req.query);
        const { query, aiMissingInfo } = await buildRecruitQuery(currentUser, params);
        const { currentStatus, selectedRegions, selectedCategories } = params;

        let page = parseInt(req.query.page, 10) || 1;
        let limit = 12;
        let skip = (page - 1) * limit;
        let totalPages = 0;

        if (currentStatus === 'ai') {
            limit = 10; skip = 0; page = 1; totalPages = 1;
        } else {
            const totalJobs = await Recruit.countDocuments(query);
            totalPages = Math.ceil(totalJobs / limit);
        }

        const jobs = await Recruit.find(query).lean().sort({ deadlineText: 1 }).skip(skip).limit(limit);

        res.render('pages/recruit', {
            title: '채용정보 - ACMA',
            user: currentUser || {},
            jobs,
            categories: RECRUIT_CATEGORIES,
            selectedCategories,
            selectedRegions,
            currentStatus,
            currentPage: 'recruit',
            page,
            totalPages,
            aiMissingInfo
        });
    } catch (error) {
        logger.error("채용공고 불러오기 상세 에러:", error);
        res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
    }
};

// 3. 채용정보 목록 JSON API (React SPA용)
exports.getRecruitList = async (req, res) => {
    try {
        const currentUser = await resolveCurrentUser(req.session);
        const params = parseRecruitParams(req.query);
        const { query, aiMissingInfo } = await buildRecruitQuery(currentUser, params);
        const { currentStatus, selectedRegions, selectedCategories } = params;

        let page = parseInt(req.query.page, 10) || 1;
        let limit = 12;
        let skip = (page - 1) * limit;
        let totalPages = 0;

        if (currentStatus === 'ai') {
            limit = 10; skip = 0; page = 1; totalPages = 1;
        } else {
            const totalJobs = await Recruit.countDocuments(query);
            totalPages = Math.ceil(totalJobs / limit);
        }

        const jobs = await Recruit.find(query).lean().sort({ deadlineText: 1 }).skip(skip).limit(limit);

        const userScraps = (currentUser && currentUser.scrapedJobs)
            ? currentUser.scrapedJobs.map(id => id.toString())
            : [];
        const jobsWithScrap = jobs.map(job => ({ ...job, isScrapped: userScraps.includes(job._id.toString()) }));

        res.json({
            jobs: jobsWithScrap,
            categories: RECRUIT_CATEGORIES,
            selectedCategories,
            selectedRegions,
            currentStatus,
            page,
            totalPages,
            aiMissingInfo
        });
    } catch (error) {
        logger.error("채용공고 JSON 조회 상세 에러:", error);
        res.status(500).json({ success: false, message: `서버 오류가 발생했습니다: ${error.message}` });
    }
};

// 2. 공고 스크랩 API
exports.toggleScrap = async (req, res) => {
    try {
        const sessionUser = req.user || (req.session && req.session.user);

        if (!sessionUser || !sessionUser.id) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        const recruitId = req.params.id;
        const user = await User.findById(sessionUser.id);

        if (!user) {
            return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
        }

        const isScrapped = user.scrapedJobs.includes(recruitId);
        if (isScrapped) {
            user.scrapedJobs.pull(recruitId);
        } else {
            user.scrapedJobs.push(recruitId);
        }

        await user.save();
        res.json({ success: true, isScrapped: !isScrapped });

    } catch (error) {
        logger.error('스크랩 처리 에러:', error);
        res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
    }
};
