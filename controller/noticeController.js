const mongoose = require('mongoose');
const dateCaculate = require('../service/dateCaculateService');
const Notice = require('../models/Notice');

//공지사항 가져오기
async function fetchAllData() {
    const dbNotices = await Notice.find({ isPublished: true }).sort({ endDate: 1 }).lean();
    
    return dbNotices.map(item => {
        const diff = dateCaculate.getRemainingDays(item.endDate);

        let typeIcon = '📌';
        let typeColor = 'var(--accent-bg)';
        
        if (item.title && item.title.includes('원서접수')) {
            typeIcon = '📝';
            typeColor = '#e0f2fe';
        } else if (item.title && item.title.includes('시험')) {
            typeIcon = '✍️';
            typeColor = '#fef3c7'; 
        } else if (item.title && item.title.includes('결과발표')) {
            typeIcon = '📢';
            typeColor = '#dcfce7'; 
        }

        let categoryName = '기타';
        let categoryBadgeClass = 'badge-gray';

        if (item.category === 'certification') {
            categoryName = '자격증';
            categoryBadgeClass = 'badge-purple';
        } else if (item.category === 'scholarship') {
            categoryName = '장학금';
            categoryBadgeClass = 'badge-success';
        } else if (item.category === 'academic') {
            categoryName = '학사일정';
            categoryBadgeClass = 'badge-info';
        } else if (item.category === 'recruit') {
            categoryName = '채용/인턴';
            categoryBadgeClass = 'badge-primary';
        } else if (item.category === 'activity') {
            categoryName = '공모전';
            categoryBadgeClass = 'badge-warning';
        }

        const formattedDate = item.createdAt 
            ? new Date(item.createdAt).toISOString().split('T')[0] 
            : '';
        
        return { 
            ...item,
            Dday: diff,
            isUrgent: diff >= 0 && diff <= 7,
            dDayText: dateCaculate.formatDDayText(diff),
            dDayBadgeClass: diff === 0 ? 'red' : (diff <= 7 ? 'amber' : 'blue'), 
            categoryName,
            icon: typeIcon,
            iconBgColor: typeColor,
            categoryBadgeClass,
            formattedDate
        };
    });
}


// 전체 가공 공지를 가져갈 수 있도록 열어둠
async function fetchHomeNotices() {
    try {
        return await fetchAllData();
    } catch (error) {
        console.error("fetchHomeNotices 에러:", error.message);
        return [];
    }
}


// 공지사항 메인 페이지 렌더링 
async function getNoticePage(req, res) {
    try {
        let showNotice = await fetchAllData();
        const urgentNotices = showNotice.filter(n => n.isUrgent == true);
        const loggedInUser = req.user || req.session?.user;

        // 로그인 유저가 설정한 목표 자격증(jmcd) 필터링
        if (loggedInUser) {
            const UserCertModel = mongoose.model('UserCertification');
            const currentUserId = loggedInUser._id || loggedInUser.id || loggedInUser.userDoc?._id;

            const myCerts = await UserCertModel.find({ 
                $or: [{ userId: currentUserId }, { user: currentUserId }],
                status: 'target' 
            }).populate('certificationId', 'jmcd').lean();

            const myTargetJmCds = myCerts
                .filter(c => c.certificationId && c.certificationId.jmcd)
                .map(c => String(c.certificationId.jmcd).trim());

            showNotice = showNotice.filter(n => {
                if (n.category === 'certification') {
                    const finalJmcd = n.jmcd || n.jmCd;
                    if (finalJmcd) {
                        return myTargetJmCds.includes(String(finalJmcd).trim());
                    }
                    return false; 
                }
                return true;
            });
        }

        // 카테고리 탭 선택 필터링
        const categoryFilter = req.query.category || '';
        if (categoryFilter) {
            showNotice = showNotice.filter(n => {
                const queryClean = String(categoryFilter).trim();
                return n.category === queryClean || n.categoryName === queryClean;
            });
        }

        // 5단위 페이징 연산
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10; 
        const totalItems = showNotice.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const maxPagesToShow = 5; 
        const currentBlock = Math.ceil(page / maxPagesToShow);
        const startPage = (currentBlock - 1) * maxPagesToShow + 1;
        const endPage = Math.min(startPage + maxPagesToShow - 1, totalPages);

        const hasPrev = startPage > 1;
        const hasNext = endPage < totalPages;

        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedNotices = showNotice.slice(startIndex, endIndex);
        
        res.render('pages/notice', {
            user: loggedInUser || null,
            notices: paginatedNotices,
            urdentNotices: urgentNotices, // 탑바나 알림 배너용 긴급공지 
            pageTitle: '공지사항',
            currentPageNum: page, 
            totalPages: totalPages,
            startPage: startPage,
            endPage: endPage,
            hasPrev: hasPrev,
            hasNext: hasNext,
            categoryFilter: categoryFilter
        });
        
    } catch (error) {
        console.error(" 공지사항 페이징 렌더 컨트롤러 에러:", error);
        res.status(500).send("서버 에러 발생");
    }
}

module.exports = {
    getNoticePage,
    fetchHomeNotices
};