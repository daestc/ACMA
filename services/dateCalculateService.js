// 날짜 계산 서비스 
exports.getRemainingDays = (targetDate) => {
    if (!targetDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 비교를 위해 시간은 자정으로 초기화

    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    // 날짜 차이 계산 (밀리초 -> 일 단위)
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays; 
};

exports.formatDDayText = (diff) => {
    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return "종료";
};

// 기간이 있는 일정(학사일정 등)의 D-Day. 홈·관리자 홈·공지사항이 같은 값을 보이도록 한 곳에서 계산한다.
//  - 이미 끝난 일정: "종료"
//  - 아직 시작 전: 시작일까지 남은 일수
//  - 진행 중: 종료일까지 남은 일수
// 예전에는 홈/관리자 홈이 항상 종료일 기준이라, 같은 기말고사(12/14~12/18)가 홈에서는 D-46,
// 공지사항에서는 D-42로 서로 다르게 보였다.
exports.getScheduleDday = (startDate, endDate) => {
    const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const today = midnight(new Date());
    const end = midnight(endDate || startDate);

    if (end < today) return { diff: -1, text: "종료" };

    const start = startDate ? midnight(startDate) : end;
    const diff = exports.getRemainingDays(start >= today ? start : end);
    return { diff, text: exports.formatDDayText(diff) };
};