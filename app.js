// 환경변수 불러오기
require('dotenv').config();

// 패키지 불러오기
const express = require('express');
const path = require('path');
const connectDB = require('./config/database');

// app 생성
const app = express();

//라우터 import
const landingRouter = require('./routes/landingRouter');
const userRouter = require('./routes/userRouter');
const calendarRouter = require('./routes/calendarRouter');
const careerRouter = require('./routes/careerRouter');
const authRouter = require('./routes/authRouter');
const mystatusRouter = require('./routes/mystatusRouter');
const noticeRouter = require('./routes/noticeRouter');
const studyRouter = require('./routes/studyRouter');

//DB 연결
connectDB();

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "views"));

// 미들웨어
app.use(express.static(path.join(__dirname, 'public')));//정적 파일
app.use(express.urlencoded({extended : true}));//form 데이터 파싱
app.use(express.json()); // JSON 데이터 해석

//라우터 등록
// app.get('/', (req, res)=>{
//     res.render('index', {title : '메인페이지'});
// });
app.use('/', noticeRouter);
app.use('/', landingRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/calendar', calendarRouter);
app.use('/career', careerRouter);
app.use('/mystatus', mystatusRouter);

app.use('/study', studyRouter);

//서버 시작
app.listen(3000, ()=>{
    console.log(`3000번 포트에서 서버가 실행 중입니다`)
});