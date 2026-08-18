const User = require('../models/User');
const Recruit = require('../models/Recruit');
const aiService = require('../services/recruiteService');
const careerService = require('../services/careerService');

// 1. 채용정보 페이지 렌더링
exports.getRecruitPage = async (req, res) => {
    try {
        // 유저 정보 가져오기
        let currentUser = req.session && req.session.user ? req.session.user : null;
        if (currentUser && currentUser.id) {
            const dbUser = await User.findById(currentUser.id).lean();
            if (dbUser) {
                currentUser = { ...currentUser, ...dbUser };
            }
        }

        // 상태, 지역, 카테고리 수집
        const currentStatus = req.query.status || 'open';
        
        let selectedRegions = req.query.region || [];
        if (typeof selectedRegions === 'string') {
            selectedRegions = [selectedRegions];
        }

        let selectedCategories = req.query.category || [];
        if (typeof selectedCategories === 'string') {
            selectedCategories = [selectedCategories];
        }

        //  정확한 날짜 비교를 위한 오늘 날짜 자정 기준 세팅
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // MongoDB 조회 쿼리 
        let query = {};
        let aiMissingInfo = false; // 직무/자격증 정보 누락 여부 
        
        // 상태 필터
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
            //  AI 추천 공고
            if (currentUser) {
                const userId = currentUser._id || currentUser.id;
                const careerData = await careerService.getMyCareerAndCertifications(userId);
                
                const targetJobObj = careerData.targetJob;
                const certsArray = careerData.certs || [];

                // 직무 이름 추출 
                const jobName = targetJobObj && targetJobObj.title ? targetJobObj.title : null;
                
                // 자격증 이름 추출 
                const certNames = certsArray.length > 0 
                    ? certsArray
                        .filter(c => c.certificationId && c.certificationId.name)
                        .map(c => c.certificationId.name)
                        .join(', ') 
                    : null;

                // 직무와 자격증이 둘 다 없으면 설정 화면으로 유도
                if (!jobName && !certNames) {
                    aiMissingInfo = true;
                    query._id = null;
                } else {
                    console.log(` AI 분석 시작 - 직무: ${jobName || '없음'}, 자격증: ${certNames || '없음'}`);
                    
                    // AI한테 카테고리와 키워드 받아오기 (빈 값은 '무관'으로 치환)
                    const aiResult = await aiService.getRecommendationKeywords(certNames || '무관', jobName || '무관');
                    console.log(" AI 분석 결과:", aiResult);

                    const queryConditions = [];

                    if (aiResult.categories && aiResult.categories.length > 0) {
                        queryConditions.push({ saraminCategory: { $in: aiResult.categories } });
                    }
                    if (aiResult.keywords && aiResult.keywords.length > 0) {
                        const regexKeywords = aiResult.keywords.map(kw => new RegExp(kw, 'i'));
                        queryConditions.push({ title: { $in: regexKeywords } });
                    }

                    if (queryConditions.length > 0) {
                        //  AI 추천 결과이면서, 마감되지 않은(모집 중인) 공고만  필터링
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
        
        // 다중 지역 필터 ($in + 정규식 대소문자 무시)
        if (selectedRegions.length > 0) {
            query.region = { $in: selectedRegions.map(r => new RegExp(r, 'i')) };
        }

        // 카테고리 필터
        if (selectedCategories.length > 0) {
            query.saraminCategory = { $in: selectedCategories };
        }

        // 페이징 (AI 추천 탭은 10개, 나머지는 12개)
        let page = parseInt(req.query.page, 10) || 1;
        let limit = 12;
        let skip = (page - 1) * limit;
        let totalPages = 0;

        if (currentStatus === 'ai') {
            // AI 추천 탭: 전체 결과 중 무조건 10개만
            limit = 10;
            skip = 0; 
            page = 1;
            totalPages = 1; 
        } else {
            // 일반 탭 (모집중, 마감, 스크랩): 12개씩 정상적으로 페이징
            const totalJobs = await Recruit.countDocuments(query);
            totalPages = Math.ceil(totalJobs / limit);
        }

        const jobs = await Recruit.find(query)
            .lean()
            .sort({ deadlineText: 1 })            
            .skip(skip)
            .limit(limit); 

        const categories = [
            '기획·전략', '마케팅·홍보·조사', '회계·세무·재무', '인사·노무·HRD', '총무·법무·사무', 'IT개발·데이터', '디자인',
            '영업·판매·무역', '고객상담·TM', '구매·자재·물류', '상품기획·MD', '운전·운송·배송', '서비스', '생산',
            '건설·건축', '의료', '연구·R&D', '교육', '미디어·문화·스포츠', '금융·보험', '공공·복지'
        ];

        // 뷰로 렌더링
        res.render('pages/recruit', { 
            title: '채용정보 - ACMA',
            user: currentUser || {}, 
            jobs: jobs,
            categories: categories,
            selectedCategories: selectedCategories,
            selectedRegions: selectedRegions, 
            currentStatus: currentStatus,
            currentPage: 'recruit',
            page: page,
            totalPages: totalPages,
            aiMissingInfo: aiMissingInfo 
        });

    } catch (error) {
        console.error("채용공고 불러오기 상세 에러:", error);
        res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
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
        console.error('스크랩 처리 에러:', error);
        res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
    }
};