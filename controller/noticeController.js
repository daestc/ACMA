const dateCaculate = require('../service/dateCaculateService');
const Notice = require('../models/Notice');
const UniversitySchedule = require('../models/UniversitySchedule');
const User = require('../models/User');
const { buildStaffUniversityFilter, normalizeUniversity } = require('../services/lectureAdminService');

async function resolveUserUniversity(req) {
    const sessionUser = req.session?.user;
    if (!sessionUser?.id) return null;

    try {
        const user = await User.findById(sessionUser.id).select('university').lean();
        return user?.university?.trim() || sessionUser.university?.trim() || null;
    } catch {
        return sessionUser.university?.trim() || null;
    }
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getScheduleEndDate(schedule) {
    return schedule.endDate || schedule.startDate;
}

function isUniversityScheduleActive(schedule) {
    if (!schedule.startDate) return false;
    const today = startOfDay(new Date());
    const end = startOfDay(getScheduleEndDate(schedule));
    return end >= today;
}

function getUniversityScheduleDday(schedule) {
    const today = startOfDay(new Date());
    const start = startOfDay(schedule.startDate);
    const end = startOfDay(getScheduleEndDate(schedule));

    if (end < today) {
        return { diff: -1, dDayText: '종료', dDayBadgeClass: 'red' };
    }
    if (start >= today) {
        const diff = dateCaculate.getRemainingDays(start);
        return {
            diff,
            dDayText: dateCaculate.formatDDayText(diff),
            dDayBadgeClass: diff === 0 ? 'red' : (diff <= 7 ? 'amber' : 'blue'),
        };
    }

    const diff = dateCaculate.getRemainingDays(end);
    return {
        diff,
        dDayText: diff === 0 ? 'D-Day' : `D-${diff}`,
        dDayBadgeClass: diff === 0 ? 'red' : (diff <= 7 ? 'amber' : 'blue'),
    };
}

function mapNoticeCategory(item) {
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
        categoryBadgeClass = 'badge-blue';
    }

    return { categoryName, categoryBadgeClass };
}

function mapNoticeDoc(doc) {
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

    const { categoryName, categoryBadgeClass } = mapNoticeCategory(item);
    const formattedDate = item.createdAt
        ? new Date(item.createdAt).toISOString().split('T')[0]
        : '';

    return {
        ...item,
        Dday: diff,
        isUrgent: diff >= 0 && diff <= 50,
        dDayText: dateCaculate.formatDDayText(diff),
        dDayBadgeClass: diff === 0 ? 'red' : (diff <= 7 ? 'amber' : 'blue'),
        categoryName,
        icon: typeIcon,
        iconBgColor: typeColor,
        categoryBadgeClass,
        formattedDate,
    };
}

function mapUniversityScheduleToNotice(schedule) {
    const { diff, dDayText, dDayBadgeClass } = getUniversityScheduleDday(schedule);
    const formattedDate = schedule.createdAt
        ? new Date(schedule.createdAt).toISOString().split('T')[0]
        : '';

    return {
        _id: schedule._id,
        category: 'academic',
        title: schedule.title,
        content: schedule.description,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        createdAt: schedule.createdAt,
        isUniversitySchedule: true,
        Dday: diff,
        isUrgent: diff >= 0 && diff <= 50,
        dDayText,
        dDayBadgeClass,
        categoryName: '학사일정',
        categoryBadgeClass: 'badge-blue',
        icon: '📅',
        iconBgColor: '#fef3c7',
        formattedDate,
    };
}

async function getUniversitySchedulesForNotice(university) {
    const univ = normalizeUniversity(university);
    const filter = buildStaffUniversityFilter(univ);
    if (!filter) return [];

    const schedules = await UniversitySchedule.find(filter)
        .sort({ startDate: 1 })
        .lean();

    return schedules
        .filter(isUniversityScheduleActive)
        .map(mapUniversityScheduleToNotice);
}

function sortNoticesByDate(notices) {
    return notices.sort((a, b) => {
        const dateA = a.endDate || a.startDate;
        const dateB = b.endDate || b.startDate;
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA) - new Date(dateB);
    });
}

// 공통 데이터 가져오기 (로그인 사용자의 소속 대학 학교 일정 포함)
async function fetchAllData(university) {
    const [dbNotices, universitySchedules] = await Promise.all([
        Notice.find({ isPublished: true }).sort({ endDate: 1 }),
        getUniversitySchedulesForNotice(university),
    ]);

    const mappedNotices = dbNotices
        .map(mapNoticeDoc)
        .filter((n) => n.Dday !== null && n.Dday >= 0);

    return sortNoticesByDate([...mappedNotices, ...universitySchedules]);
}


//landingController에서 홈 화면을 그릴 때 호출할 가공 데이터 제공 함수
async function fetchHomeNotices(university) {
    try {
        return await fetchAllData(university);
    } catch (error) {
        console.error("fetchHomeNotices 에러:", error.message);
        return [];
    }
}


// 공지사항 페이지 페이징 컨트롤러
async function getNoticePage(req, res) {
    try {
        const user = req.session?.user || null;
        const university = await resolveUserUniversity(req);

        let showNotice = await fetchAllData(university);
        const urgentNotices = showNotice.filter(n => n.isUrgent == true);

        const categoryFilter = req.query.category || '';
        if (categoryFilter) {
            showNotice = showNotice.filter(n => n.category === categoryFilter);
        }

        const page = parseInt(req.query.page, 10) || 1;
        const itemsPerPage = categoryFilter === 'academic' ? 50 : 10;
        const totalItems = showNotice.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

        const safePage = Math.min(Math.max(page, 1), totalPages);
        const startIndex = (safePage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedNotices = showNotice.slice(startIndex, endIndex);

        res.render('pages/notice', {
            user,
            notices: paginatedNotices,
            urdentNotices: urgentNotices,
            pageTitle: '공지사항',
            currentPageNum: safePage,
            totalPages,
            categoryFilter,
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

