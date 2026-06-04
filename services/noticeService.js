// 자격증 서비스
const axios = require('axios');
const Notice = require('../models/Notice'); 
const dateCaculate = require('./dateCaculateService'); // 날짜 계산

//자격증 공지사항 가져오기 
exports.getCerNotice = async () => {
    try {
        // MongoDB에서 데이터 조회
        const notices = await Notice.find({ 
            category: 'certification',
            isPublished: true 
        }).sort({ endDate: 1 }); // 마감일 순 정렬

        // 2. 화면 출력을 위한 규격화
        return notices.map(doc => {
            const item = doc.toObject();
            return {
                ...item,
                icon: '🏆',
                iconBgColor: '#e0f2fe', // 하늘색 계열
                categoryName: '자격증',
                categoryBadgeClass: 'badge-blue',
                targetDate: item.endDate // D-Day 계산 기준일
            };
        });
    } catch (error) {
        console.error("DB 로드 에러:", error.message);
        return [];
    }
};

/**
 * DB에서 장학금 공지사항 가져오기
 */
exports.getScholarshipNotice = async () => {
    try {
        const notices = await Notice.find({ category: 'scholarship' }).sort({ endDate: 1 });
        return notices.map(doc => ({
            ...doc.toObject(),
            icon: '💰',
            iconBgColor: '#fef3c7', // 노란색 계열
            categoryName: '장학금',
            categoryBadgeClass: 'badge-amber',
            targetDate: doc.endDate
        }));
    } catch (error) {
        return [];
    }
};