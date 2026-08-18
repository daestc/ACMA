// 환경변수 불러오기
require('dotenv').config();

// 패키지 불러오기
const express     = require('express');
const path        = require('path');
const helmet      = require('helmet');
const session     = require('express-session');
const MongoStore = require('connect-mongo');
const passport    = require('./config/passport');
const connectDB   = require('./config/database');

const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { refreshDailyUsage } = require('./middleware/auth');

// app 생성
const app = express();

//라우터 import
const noticeRouter = require('./routes/noticeRouter');
const notificationRouter = require('./routes/notificationRouter');
const landingRouter = require('./routes/landingRouter');
const userRouter = require('./routes/userRouter');
const calendarRouter = require('./routes/calendarRouter');
const careerRouter = require('./routes/careerRouter');
const academicRouter = require('./routes/academicRouter');
const authRouter = require('./routes/authRouter');
const mystatusRouter = require('./routes/mystatusRouter');
const studyRouter = require('./routes/studyRouter');
const alertRouter = require('./routes/alertRouter');
const staffRouter = require('./routes/staffRouter');
const adminRouter = require('./routes/adminRouter');
const suggestionRouter = require('./routes/suggestionRouter');
const specRouter    = require('./routes/specRouter');
const paymentRouter = require('./routes/paymentRouter');
const recruitRouter = require('./routes/recruitRouter');

//DB 연결
connectDB();

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "views"));

// 미들웨어
app.use(helmet({ contentSecurityPolicy: false })); // CSP는 EJS 인라인 스크립트와 충돌하므로 비활성
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax',
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(refreshDailyUsage);


//라우터 등록
// app.get('/', (req, res)=>{
//     res.render('index', {title : '메인페이지'});
// });
app.use('/notice', noticeRouter);
app.use('/notification', notificationRouter);
app.use('/', landingRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/calendar', calendarRouter);
app.use('/career', careerRouter);
app.use('/academic', academicRouter);
app.use('/mystatus', mystatusRouter);
app.use('/study', studyRouter);
app.use('/suggestions', suggestionRouter);
app.use('/', alertRouter);
app.use('/staff', staffRouter);
app.use('/admin', adminRouter);
app.use('/spec',    specRouter);
app.use('/payment', paymentRouter);
app.use('/recruit', recruitRouter);

// 오류 처리 미들웨어
app.use(notFoundHandler);
app.use(errorHandler);


//서버 시작
app.listen(3000, ()=>{
    console.log(`3000번 포트에서 서버가 실행 중입니다`)
});