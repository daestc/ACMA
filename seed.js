require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Notice = require('./models/Notice'); 

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 시드 작업을 위한 DB 연결 성공');
    } catch (error) {
        console.error('❌ DB 연결 실패:', error.message);
        process.exit(1);
    }
};

const getAndProcessQnetData = async () => {
    try {
        const serviceKey = process.env.API_Key;
        const url = 'http://openapi.q-net.or.kr/api/service/rest/InquiryTestInformationNTQSVC/getJMList';
        
        const response = await axios.get(url, {
            params: { serviceKey, jmCd: '2471', _type: 'json' },
            timeout: 30000 
        });

        const root = response.data?.response?.body?.items?.item;
        if (!root) return [];
        
        const safeStr = (val) => val ? String(val) : "";
        const toDate = (dateVal) => {
            const s = safeStr(dateVal);
            return (s.length === 8) ? new Date(s.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null;
        };
       
        const itemList = Array.isArray(root) ? root : [root];
        const allNotices = [];

        itemList.forEach(item => {
            const round = safeStr(item.implplannm); // 예: "2026년 정기 기사 3회"
            const name = safeStr(item.jmfldnm);    // 예: "정보처리기사"
            
            // 💡 6가지 세부 일정 정의
            const schedules = [
                { type: "필기 원서접수", start: toDate(item.docregstartdt), end: toDate(item.docregenddt) },
                { type: "필기 시험", start: toDate(item.docexamstartdt), end: toDate(item.docexamstartdt) }, // 시작/종료 동일 처리
                { type: "필기 결과발표", start: toDate(item.docpassdt), end: toDate(item.docpassdt) },
                { type: "실기 원서접수", start: toDate(item.pracregstartdt), end: toDate(item.pracregenddt) },
                { type: "실기 시험", start: toDate(item.pracexamstartdt), end: toDate(item.pracexamenddt) },
                { type: "실기 결과발표", start: toDate(item.pracpassdt), end: toDate(item.pracpassdt) }
            ];

            schedules.forEach(sched => {
                if (sched.start) { // 날짜 데이터가 있는 경우만 생성
                    allNotices.push({
                        category: 'certification',
                        source: 'q-net',
                        // 💡 제목 예시: "2026년 정기 기사 3회 정보처리기사 실기 시험"
                        title: `${round} ${name} ${sched.type}`, 
                        organization: '한국산업인력공단',
                        startDate: sched.start,
                        endDate: sched.end || sched.start,
                        externalId: `qnet-${name}-${round}-${sched.type}`, // 💡 중복 방지를 위해 type까지 포함
                        isPublished: true,
                        details: {
                            round: round,
                            examType: sched.type
                        }
                    });
                }
            });
        });

        return allNotices;
    } catch (error) {
        console.error("❌ API 호출 에러:", error.message);
        return [];
    }
};

const seedData = async () => {
    await connectDB();
    await Notice.deleteMany({});
    const processedData = await getAndProcessQnetData();

    if (processedData.length > 0) {
        for (const notice of processedData) {
            await Notice.findOneAndUpdate(
                { externalId: notice.externalId }, 
                notice,
                { upsert: true, new: true }
            );
        }
        console.log(`${processedData.length}개의 공고가 성공적으로 시드되었습니다.`);
    }

    mongoose.connection.close();
};

seedData();