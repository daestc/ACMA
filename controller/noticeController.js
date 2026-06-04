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
        
        return { 
            ...item,
            Dday: diff,
            isUrgent: diff >= 0 && diff <= 50,
            dDayText: dateCaculate.formatDDayText(diff),
            categoryName: item.category === 'certification' ? '자격증' : '기타',
            icon: typeIcon,
            iconBgColor: typeColor,
            categoryBadgeClass: item.category === 'certification' ? 'badge-purple' : 'badge-gray'
        };
    }).filter(n => n.Dday >= 0); //지난 일정은 나오지x
}

//공지사항 페이지 페이징 컨트롤러
exports.getNoticePage = async(req, res) => {
    try {
        let showNotice = await fetchAllData();
        const urgentNotices = showNotice.filter( n => n.isUrgent == true);

        const categoryFilter = req.query.category || '';
        if( categoryFilter) {
            showNotice = showNotice.filter(n => n.category === categoryFilter);
        }

        const page = parseInt(req.query.page) || 1;//기본값 1페이지
        const itemsPerPage = 10; //페이지 당 10개씩
        const totalItems = showNotice.length;
        const totalPages =Math.ceil(totalItems / itemsPerPage);

        //10개 데이터만 자르기
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedNotices = showNotice.slice(startIndex, endIndex);

        res.render('pages/notice', {
            user: req.user || null,
            notices : paginatedNotices,
            urdentNotices : urgentNotices,
            pageTitle : '공지사항',
            currentPageNum : page, //현재 페이지 번호
            totalPages: totalPages //전체 페이지 수 
        })
    } catch (error) {
        console.error("공지사항 페이지 로드 에러" , error.message);
        res.status(500).send("서버 에러 발생");
    }
}

// 홈 페이지 컨트롤러
exports.getHomePage = async (req, res) => {
    try {
        const showNotice = await fetchAllData();
        
        res.render('pages/home', {
            user: req.user || null,
            notices: showNotice,
            topNotices: showNotice.slice(0, 6), // D-Day 기준 상위 6개 
            urgentNotices: showNotice.filter(n => n.isUrgent === true),
            pageTitle: '홈',
            habitList: [],
            todoList: [],
            completedCount: 0
        });

    } catch (error) {
        console.error("홈페이지 로드 에러:", error.message);
        res.status(500).send("페이지를 불러오는 중 에러가 발생했습니다.");
    }
};
