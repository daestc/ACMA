const axios = require('axios');

exports.getScholarshipNotice = async () => {
    try {
        // 1. .env에서 키 가져오기
        const apiKey = process.env.API_Key; 
        const baseUrl = 'https://api.odcloud.kr/api/15006497/v1/uddi:7348982a-e8f0-4643-9833-28956895743b';

        console.log("### [Scholarship] 인코딩 최적화 요청 중...");

        const response = await axios.get(baseUrl, {
            params: {
                page: 1,
                perPage: 10,
                // 💡 핵심: encodeURIComponent를 쓰지 않고 axios가 처리하게 두거나, 
                // 키가 이미 인코딩되어 있다면 그대로 전달해야 해.
                serviceKey: apiKey 
            },
            // ⚠️ 중요: axios가 serviceKey를 이중으로 인코딩하지 않도록 설정
            paramsSerializer: params => {
                const searchParams = new URLSearchParams();
                for (const key in params) {
                    if (key === 'serviceKey') {
                        // 인증키는 이미 완성된 형태이므로 인코딩 없이 그대로 붙임
                        searchParams.append(key, params[key]);
                    } else {
                        searchParams.append(key, params[key]);
                    }
                }
                return searchParams.toString().replace(/%2B/g, '+'); // '+' 기호가 변조되는 것 방지
            },
            timeout: 5000
        });

        const items = response.data?.data || [];
        
        if (items.length === 0) {
            console.log("### [Scholarship] 데이터가 비어있습니다.");
            return [];
        }

        const processed = items.map((item, index) => {
            return {
                _id: `scholar-${index}-${Date.now()}`,
                title: item['장학금명'] || item['상품명'] || '국가우수장학금',
                categoryName: '장학금',
                categoryBadgeClass: 'badge-gold',
                icon: '💰',
                iconBgColor: '#fef3c7',
                formattedDate: `접수: ${item['신청시작일'] || '공고참조'} ~ ${item['신청종료일'] || ''}`,
                dDayText: '공고',
                dDayBadgeClass: 'badge-blue'
            };
        });

        console.log(`### [Scholarship] 장학금 ${processed.length}건 로드 성공!`);
        return processed;

    } catch (error) {
        console.error(`❌ [Scholarship] 최종 에러: ${error.message}`);
        // 400 에러 상세 내용 출력 (디버깅용)
        if (error.response) console.log("Detail:", error.response.data);
        return [];
    }
};