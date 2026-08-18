require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');

// 몽고DB 연결
async function connectDB() {
    try {
        const dbUri = process.env.MONGODB_URI;
        await mongoose.connect(dbUri);
        console.log('MONGODB 연결 성공!');
    } catch (err) {
        console.error('ONGODB 연결 실패:', err.message);
        process.exit(1);
    }
}

//  스키마 설정
const recruitSchema = new mongoose.Schema({
    company: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, unique: true }, // 중복 방지 고유키
    deadlineText: { type: String },
    mainCategory: { type: String, default: '기타' }, // 21개 대분류 이름 (예: 기획·전략, IT개발·데이터 등)
    jobCategory: { type: String, default: '일반' }
}, { timestamps: true });

const Recruit = mongoose.models.Recruit || mongoose.model('Recruit', recruitSchema);

//  사람인 21개 대분류 카테고리 맵핑 테이블 
const MAIN_CATEGORIES = [
    { name: '기획·전략', code: '16' },
    { name: '마케팅·홍보·조사', code: '14' },
    { name: '회계·세무·재무', code: '3' },
    { name: '인사·노무·HRD', code: '5' },
    { name: '총무·법무·사무', code: '4' },
    { name: 'IT개발·데이터', code: '2' },
    { name: '디자인', code: '15' },
    { name: '영업·판매·무역', code: '8' },
    { name: '고객상담·TM', code: '21' },
    { name: '구매·자재·물류', code: '18' },
    { name: '상품기획·MD', code: '12' },
    { name: '운전·운송·배송', code: '7' },
    { name: '서비스', code: '10' },
    { name: '생산', code: '11' },
    { name: '건설·건축', code: '22' },
    { name: '의료', code: '6' },
    { name: '연구·R&D', code: '9' },
    { name: '교육', code: '19' },
    { name: '미디어·문화·스포츠', code: '13' },
    { name: '금융·보험', code: '17' },
    { name: '공공·복지', code: '20' }
];

//  봇 차단 방지용 딜레이 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function crawlMassiveJobs() {
    await connectDB();

    let totalSavedCount = 0;

    //  21개 대분류 순회 루프
    for (const cat of MAIN_CATEGORIES) {
        console.log(`\n [${cat.name}] (코드: ${cat.code}) 대분류 공고 최대 300개 수집 시작...`);
        
        let count = 0;
        let page = 1;
        const MAX_ITEMS = 300; //  카테고리당  300개

        while (count < MAX_ITEMS) {
            // 사람인 대분류 검색 URL 구조 
            const targetUrl = `https://www.saramin.co.kr/zf_user/search/recruit?cat_mcls=${cat.code}&recruitPage=${page}`;
            
            try {
                const response = await axios.get(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                    }
                });

                const $ = cheerio.load(response.data);
                const items = $('.item_recruit');
                
                if (items.length === 0) {
                    console.log(`⚠️ [${cat.name}] 더 이상 수집할 공고가 없습니다. 다음 카테고리로 넘어갑니다.`);
                    break;
                }

                // 페이지 내 공고 순회
                for (let i = 0; i < items.length; i++) {
                    if (count >= MAX_ITEMS) break; // 300개 채우면 즉시 중지

                    const element = items[i];
                    const company = $(element).find('.corp_name a').text().trim();
                    const titleElem = $(element).find('.job_tit a');
                    const title = titleElem.attr('title')?.trim() || titleElem.text().trim();
                    const relativeLink = titleElem.attr('href');
                    const link = relativeLink ? `https://www.saramin.co.kr${relativeLink}` : '';
                    const deadline = $(element).find('.job_date .date').text().trim();

                    if (title && company && link) {
                        const jobData = {
                            company,
                            title,
                            url: link,
                            deadlineText: deadline,
                            mainCategory: cat.name // 21개 대분류 이름 태깅
                        };

                        //  중복 방지 Upsert 저장
                        await Recruit.updateOne(
                            { url: jobData.url },
                            { $set: jobData },
                            { upsert: true }
                        );

                        count++;
                        totalSavedCount++;
                    }
                }

                console.log(`⏳ [${cat.name}] ${page}페이지 진행 중... (현재 수집: ${count}/300개)`);
                page++; 
                
                // IP 차단 방지를 위한 랜덤 휴식 
                await sleep(Math.floor(Math.random() * 2000) + 2000); 

            } catch (error) {
                console.error(`❌ [${cat.name}] 페이지 요청 에러 (${page}페이지):`, error.message);
                break;
            }
        }
        console.log(`✅ [${cat.name}] 수집 완료! (이번 카테고리 누적: ${count}개)`);
        
        // 카테고리 전환 시 서버 부담을 줄이기 위한 추가 휴식 (3초 ~ 5초)
        await sleep(Math.floor(Math.random() * 2000) + 3000);
    }
    
    console.log(`\n🎉 모든 크롤링 작업 종료! 총 ${totalSavedCount}개의 공고가 데이터베이스에 반영되었습니다.`);
    await mongoose.connection.close();
    console.log('🔌 몽고DB 연결 종료.');
}

crawlMassiveJobs();