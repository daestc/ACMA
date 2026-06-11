require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Notice = require('./models/Notice'); 
const CertificationsJobsFile = require('./models/Certifications_jobs'); 
const User = require('./models/User'); 

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB 연결 성공');
    } catch (error) {
        console.error(' DB 연결 실패:', error.message);
        process.exit(1);
    }
};

const getAndProcessQnetData = async () => {
    try {
        const modelNames = mongoose.modelNames();
        const targetModelName = modelNames.find(name => name.toLowerCase().includes('certi')) || 'Certification';
        const CertModel = mongoose.model(targetModelName);

        const certsInDb = await CertModel.find({}, 'jmcd').lean();
        const targetJmCds = certsInDb.map(c => c.jmcd).filter(Boolean);

        if (targetJmCds.length === 0) {
            console.log(' 현재 DB에 등록된 자격증 종목 코드가 없습니다.');
            return [];
        } 

        console.log(` 마스터 자격증 총 ${targetJmCds.length}개의  일정을 크롤링합니다. `);

        const serviceKey = process.env.API_Key;
        const url = 'http://openapi.q-net.or.kr/api/service/rest/InquiryTestInformationNTQSVC/getJMList';
        const allNotices = [];

        // 종목 코드를 순회하며 Q-Net API를 호출
        for (const jmCd of targetJmCds) {
            try {
                console.log(` Q-Net API 요청 [종목코드: ${jmCd}]`);
                
                const response = await axios.get(url, {
                    params: { serviceKey, jmCd: jmCd, _type: 'json' },
                    timeout: 10000 //  10초 설정
                });

                const root = response.data?.response?.body?.items?.item;
                if (!root) continue; 

                const safeStr = (val) => val ? String(val) : "";
                const toDate = (dateVal) => {
                    const s = safeStr(dateVal);
                    return (s.length === 8) ? new Date(s.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null;
                };
               
                const itemList = Array.isArray(root) ? root : [root];

                itemList.forEach(item => {
                    const round = safeStr(item.implplannm); 
                    const name = safeStr(item.jmfldnm);    
                    const currentJmcd = safeStr(item.jmcd).trim() || safeStr(jmCd).trim();
                    
                    const schedules = [
                        { type: "필기 원서접수", start: toDate(item.docregstartdt), end: toDate(item.docregenddt) },
                        { type: "필기 시험", start: toDate(item.docexamstartdt), end: toDate(item.docexamstartdt) }, 
                        { type: "필기 결과발표", start: toDate(item.docpassdt), end: toDate(item.docpassdt) },
                        { type: "실기 원서접수", start: toDate(item.pracregstartdt), end: toDate(item.pracregenddt) },
                        { type: "실기 시험", start: toDate(item.pracexamstartdt), end: toDate(item.pracexamenddt) },
                        { type: "실기 결과발표", start: toDate(item.pracpassdt), end: toDate(item.pracpassdt) }
                    ];

                    schedules.forEach(sched => {
                        if (sched.start) { 
                            allNotices.push({
                                category: 'certification',
                                source: 'q-net',
                                jmcd: currentJmcd, 
                                title: `${round} ${name} ${sched.type}`, 
                                organization: '한국산업인력공단',
                                startDate: sched.start,
                                endDate: sched.end || sched.start,
                                externalId: `qnet-${name}-${round}-${sched.type}`, 
                                isPublished: true,
                                details: {
                                    round: round,
                                    examType: sched.type
                                }
                            });
                        }
                    });
                });

            } catch (apiError) {
                console.error(` [종목코드: ${jmCd}] API 호출 실패 :`, apiError.message);
            }
        }

        return allNotices;
    } catch (error) {
        console.error("  API  에러:", error.message);
        return [];
    }
};

const seedData = async () => {
    await connectDB();
    
    console.log(" 기존 Notice  있던 모든 데이터를 완전히 포맷");
    await Notice.deleteMany({}); 

    const processedData = await getAndProcessQnetData();

    if (processedData.length > 0) {
        let successCount = 0;
        for (const notice of processedData) {
            await Notice.findOneAndUpdate(
                { externalId: notice.externalId }, 
                notice,
                { upsert: true, returnDocument: 'after' } 
            );
            successCount++;
        }
        console.log(` 총 ${successCount}개의 자격증 일정 생성`);
    } else {
        console.log(' 시드할 데이터가 없습니다.');
    }

    mongoose.connection.close();
};

seedData();