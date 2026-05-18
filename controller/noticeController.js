const noticeService = require('../service/noticeService');
const scholarshipService = require('../service/scholarshipService'); 
const dateCaculate = require('../service/dateCaculateService');
const Notice = require('../models/Notice');

// 공통 데이터 가져오기 
async function fetchAllData() {
    const dbNotices = await Notice.find({ isPublished: true }).sort({ endDate: 1 });
    
    return dbNotices.map(doc => {
        const item = doc.toObject(); // [수정] tem -> item으로 변경
        const diff = dateCaculate.getRemainingDays(item.endDate);

        let typeIcon = '📌';
        let typeColor = 'var(--accent-bg)';
        
        if (item.title.includes('원서접수')) {
            typeIcon = '📝';
            typeColor = '#e0f2fe'; // 연한 파랑
        } else if (item.title.includes('시험')) {
            typeIcon = '✍️';
            typeColor = '#fef3c7'; // 연한 노랑
        } else if (item.title.includes('결과발표')) {
            typeIcon = '📢';
            typeColor = '#dcfce7'; // 연한 초록
        }
        
        return { 
            ...item,
            Dday: diff,
            isUrgent: diff >= 0 && diff <= 50,
            dDayText: dateCaculate.formatDDayText(diff),
            categoryName: item.category === 'certification' ? '자격증' : '기타',
            icon: typeIcon,
            iconBgColor: typeColor,
categoryBadgeClass: item.category === 'certification' ? 'badge-purple' : 'badge-gray'        };
    }).filter(n => n.Dday >= 0);
}

// 홈 페이지 컨트롤러
exports.getHomePage = async (req, res) => {
    try {
        const showNotice = await fetchAllData();
        
        res.render('pages/home', {
            user: req.user || null,
            notices: showNotice,
            topNotices: showNotice.slice(0, 6), // D-Day 기준 상위 3개 
            urgentNotices: showNotice.filter(n => n.isUrgent === true),
            pageTitle: '홈'
        });

    } catch (error) {
        // [수정] 에러 발생 시 로그 출력 방식 변경
        console.error("홈페이지 로드 에러:", error.message);
        res.status(500).send("페이지를 불러오는 중 에러가 발생했습니다.");
    }
};

// 공지사항 페이지 컨트롤러
exports.getNoticePage = async (req, res) => {
    try {
        const showNotice = await fetchAllData();
        const urgentNotices = showNotice.filter(n => n.isUrgent === true);
        
        res.render('pages/notice', {
            user: req.user || null,
            notices: showNotice,
            urgentNotices: urgentNotices,
            pageTitle: '공지사항'
        });

    } catch (error) {
        console.error("공지사항 페이지 로드 에러:", error.message);
        res.status(500).send("서버 에러가 발생했습니다.");
    }
};