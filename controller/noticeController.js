const noticeService = require('../service/noticeService');
const scholarshipService = require('../service/scholarshipService'); 
const dateCaculate = require('../service/dateCaculateService');
const Notice = require('../models/Notice');

// 공통 데이터 가져오기 
async function fetchAllData() {
    const dbNotices = await Notice.find({ isPublished: true }).sort({ endDate: 1 });
    
    return dbNotices.map(doc => {
        const item = doc.toObject(); 
        const diff = dateCaculate.getRemainingDays(item.endDate);

        let typeIcon = '📌';
        let typeColor = 'var(--accent-bg)';
        
        if (item.title.includes('원서접수')) {
            typeIcon = '📝';
            typeColor = '#e0f2fe';
        } else if (item.title.includes('시험')) {
            typeIcon = '✍️';
            typeColor = '#fef3c7'; 
        } else if (item.title.includes('결과발표')) {
            typeIcon = '📢';
            typeColor = '#dcfce7'; 
        }
        // 카테고리 종류에 따른 텍스트 및 배지 클래스 분기
        let categoryName = '기타';
        let categoryBadgeClass = 'badge-gray';

        if (item.category === 'certification') {
            categoryName = '자격증';
            categoryBadgeClass = 'badge-purple';
        } else if (item.category === 'scholarship') {
            categoryName = '장학금';
            categoryBadgeClass = 'badge-success';
        }
        // 날짜 포맷 (YYYY-MM-DD)
        const formattedDate = item.createdAt 
            ? new Date(item.createdAt).toISOString().split('T')[0] 
            : '';
        
    return { 
            ...item,
            Dday: diff,
            isUrgent: diff >= 0 && diff <= 50,
            dDayText: dateCaculate.formatDDayText(diff),
            dDayBadgeClass: diff === 0 ? 'red' : (diff <= 7 ? 'amber' : 'blue'), // 💡 home.ejs 배지 스타일 연동
            categoryName,
            icon: typeIcon,
            iconBgColor: typeColor,
            categoryBadgeClass,
            formattedDate
        };
    }).filter(n => n.Dday >= 0); //지난 일정은 나오지x
}


//landingController에서 홈 화면을 그릴 때 호출할 가공 데이터 제공 함수
async function fetchHomeNotices() {
    try {
        const data = await fetchAllData();
        return data;
    } catch (error) {
        console.error("fetchHomeNotices 에러:", error.message);
        return [];
    }
}


// 공지사항 페이지 페이징 컨트롤러
async function getNoticePage(req, res) {
    try {
        let showNotice = await fetchAllData();
        const urgentNotices = showNotice.filter(n => n.isUrgent == true);

        const categoryFilter = req.query.category || '';
        if (categoryFilter) {
            showNotice = showNotice.filter(n => n.category === categoryFilter);
        }

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10; 
        const totalItems = showNotice.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedNotices = showNotice.slice(startIndex, endIndex);

        res.render('pages/notice', {
            user: req.user || null,
            notices: paginatedNotices,
            urdentNotices: urgentNotices, 
            pageTitle: '공지사항',
            currentPageNum: page, 
            totalPages: totalPages 
        });
    } catch (error) {
        console.error("공지사항 페이지 로드 에러", error.message);
        res.status(500).send("서버 에러 발생");
    }
}

module.exports = {
    getNoticePage,
    fetchHomeNotices 
};

