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