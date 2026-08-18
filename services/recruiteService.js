const {OpenAI} = require('openai');

const openai = new OpenAI({
    apiKey : process.env.OPENAI_API_KEY,
    timeout: parseInt(process.env.AI_TIMEOUT_MS) || 60000,
});


exports.getRecommendationKeywords = async(certification, job)=>{
    try {
        // 채용 카테고리 목록
        const validCategories = [
            '기획·전략', '마케팅·홍보·조사', '회계·세무·재무', '인사·노무·HRD', '총무·법무·사무', 'IT개발·데이터', '디자인',
            '영업·판매·무역', '고객상담·TM', '구매·자재·물류', '상품기획·MD', '운전·운송·배송', '서비스', '생산',
            '건설·건축', '의료', '연구·R&D', '교육', '미디어·문화·스포츠', '금융·보험', '공공·복지'
        ];
        // 직무랑 사람인 공고 매칭 시키기 
        const prompt = `
        사용자의 목표 자격증: '${certification}'
        한국표준직업분류 기준 희망 직무: '${job}'

        이 사용자가 지원하기 적합한 채용 공고를 찾기 위해 아래 두 가지를 분석해주세요.
        1. 'categories': 제시된 [허용된 채용 카테고리] 중에서 이 직무/자격증과 가장 연관성이 높은 카테고리를 1~2개 선택하세요. 반드시 목록에 있는 정확한 명칭만 사용해야 합니다.
        2. 'keywords': 공고 제목에 포함될 만한 구체적인 실무/기술/자격증 검색 키워드를 3~5개 추출하세요.

        [허용된 채용 카테고리]
        ${validCategories.join(', ')}

        반드시 아래 JSON 형식으로만 응답하세요:
        {
        "categories": ["선택한 카테고리1", "선택한 카테고리2"],
        "keywords": ["키워드1", "키워드2", "키워드3"]
        }`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful recruitment assistant designed to output strictly valid JSON.' },
                { role: 'user', content: prompt }
            ],            
            max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 4000,
            temperature: 0.3,
        });

        const resultJson = JSON.parse(response.choices[0].message.content.trim());        
        return {
            categories: resultJson.categories || [],
            keywords: resultJson.keywords || []
        };


    } catch (error) {
        console.error('키워드 추출 실패', error);
        return { categories: [], keywords: [job, certification].filter(Boolean) };

    }


}