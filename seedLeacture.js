require('dotenv').config();
const fs = require('fs');
const csvParser = require('csv-parser');
const connectDB = require('./config/database');
const { Lecture } = require('./models/Calendar');

const CSV_FILE = '2026학년도_1학기_전체강의시간표.csv';

const parseSchedules = (scheduleStr) => {
  if (!scheduleStr) return [];
  
  return scheduleStr.split(',').map(s => {
    const day = s.charAt(0); 
    const timeRange = s.substring(1).split('-'); 
    
    if (timeRange.length !== 2) return null;

    const [startHour, startMin] = timeRange[0].split(':').map(Number);
    const [endHour, endMin] = timeRange[1].split(':').map(Number);

    return {
      day,
      startTime: timeRange[0],
      endTime: timeRange[1],
      startMinute: startHour * 60 + startMin,
      endMinute: endHour * 60 + endMin
    };
  }).filter(Boolean); 
};

const loadCsvAsLectures = async (path) => {
  return new Promise((resolve, reject) => {
    // 💡 중복 제거를 위해 배열 대신 Map 사용
    const lectureMap = new Map(); 

    fs.createReadStream(path, { encoding: 'utf8' })
      .pipe(csvParser({ 
          mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() 
      }))
      .on('data', (row) => {
        const lecture = {
          classification: row['이수구분']?.trim(),
          courseName: row['교과명']?.trim(),
          section: parseInt(row['분반']?.trim(), 10) || null,
          credits: parseInt(row['학점']?.trim(), 10) || null,
          professor: row['담당교수']?.trim() || "미정",
          schedules: parseSchedules(row['강의시간']?.trim())
        };

        if (lecture.courseName && lecture.section !== null) {
          // 💡 고유 키 생성 (예: "사고와표현-19")
          const uniqueKey = `${lecture.courseName}-${lecture.section}`;
          
          // Map에 삽입 (동일 키가 나오면 나중에 나온 데이터로 덮어씌워짐)
          // 만약 먼저 나온 데이터를 유지하고 싶다면 if (!lectureMap.has(uniqueKey)) 로 감싸면 됩니다.
          lectureMap.set(uniqueKey, lecture);
        }
      })
      // Map의 값들만 추출하여 배열로 반환
      .on('end', () => resolve(Array.from(lectureMap.values())))
      .on('error', reject);
  });
};

const seedLectures = async () => {
  try {
    await connectDB();
    const lectures = await loadCsvAsLectures(CSV_FILE);
    
    if (lectures.length > 0) {
        // 기존 데이터 삭제
        await Lecture.deleteMany({}); 
        // 중복이 제거된 배열 삽입
        await Lecture.insertMany(lectures);
        console.log(`✅ 강의 데이터 시드 완료: 총 ${lectures.length}건 삽입됨 (중복 제거됨)`);
    } else {
        console.log(`❌ 삽입할 데이터가 없습니다.`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('시드 실패:', error.message);
    process.exit(1);
  }
};

seedLectures();