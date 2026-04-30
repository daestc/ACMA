const mongoose = require('mongoose');
require('dotenv').config();
const xlsx = require('xlsx'); // 엑셀 라이브러리
const {JobSearch} = require('./models/Certifications_jobs');

const seedDatabase = async () => {
    try {
        // 1. DB 연결 (주소는 본인 환경에 맞게 수정)
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ DB 연결 성공!');

        // 2. 엑셀 파일 읽어오기 (파일명 정확히 일치해야 함)
        console.log('엑셀 파일 읽는 중...');
        const workbook = xlsx.readFile('한국표준직업분류 (1).xls');
        const sheetName = workbook.SheetNames[0]; // 첫 번째 시트 선택
        const sheet = workbook.Sheets[sheetName];

        // 3. 엑셀 시트를 2차원 배열 형태로 변환
        // header: 1 옵션을 주면 A열, B열이 각각 배열의 0번, 1번 인덱스로 들어옵니다.
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // 4. 데이터 가공 (빈칸 채워넣기 로직 적용)
        const jobData = [];
        
        // 이전 행의 부모 카테고리 이름을 기억할 변수들
        let currentDepth1 = '';
        let currentDepth2 = '';
        let currentDepth3 = '';

        const rows = rawData.slice(2);
        for (const row of rows) {
            const categoryId = row[0] ? String(row[0]).trim() : '';
            if (!categoryId) continue; // ID가 없는 빈 줄은 무시
            // 현재 줄의 데이터 읽기
            const d1 = row[1] ? String(row[1]).trim() : '';
            const d2 = row[2] ? String(row[2]).trim() : '';
            const d3 = row[3] ? String(row[3]).trim() : '';
            const d4 = row[4] ? String(row[4]).trim() : '';
            // 값이 있으면 기억해두고, 하위 카테고리는 초기화
            if (d1) {
                currentDepth1 = d1;
                currentDepth2 = ''; // 대분류가 바뀌면 중분류, 소분류 초기화
                currentDepth3 = '';
            }
            if (d2) {
                currentDepth2 = d2;
                currentDepth3 = ''; // 중분류가 바뀌면 소분류 초기화
            }
            if (d3) {
                currentDepth3 = d3;
            }
            // DB에 넣을 객체 생성 (기억해둔 부모 카테고리 이름으로 꽉꽉 채워넣음)
            jobData.push({
                categoryId: categoryId,
                depth1_name: currentDepth1,
                depth2_name: currentDepth2,
                depth3_name: currentDepth3,
                depth4_name: d4 // 세분류는 가장 말단이라 그대로 사용
            });
        }
        console.log(`총 ${jobData.length}개의 유효한 직무 데이터를 찾았습니다.`);
        // 5. DB에 밀어넣기
        await JobSearch.deleteMany({}); // 혹시 모를 중복 방지를 위해 기존 데이터 싹 지우기
        console.log('🗑️ 기존 직무 데이터 초기화 완료.');

        await JobSearch.insertMany(jobData);
        console.log('🎉 한국표준직업분류 엑셀 데이터 DB 저장 완료!');

        // 작업 끝났으니 DB 연결 끊기
        mongoose.connection.close();
    } catch (error) {
        console.error('❌ 에러 발생:', error);
    }
};

seedDatabase();