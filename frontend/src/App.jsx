import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StudyTimerProvider } from './context/StudyTimerContext'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import RequireStaff from './components/RequireStaff'
import AppShell from './components/AppShell/AppShell'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Suggestions from './pages/Suggestions'
import MyStatus from './pages/MyStatus'
import Notice from './pages/Notice'
import Academic from './pages/Academic'
import Study from './pages/Study'
import Career from './pages/Career'
import Recruit from './pages/Recruit'
import CareerPlan from './pages/CareerPlan'
import CareerPortfolio from './pages/CareerPortfolio'
import CareerDiagnosis from './pages/CareerDiagnosis'
import AdminUsers from './pages/AdminUsers'
import AdminStaff from './pages/AdminStaff'
import AdminStatistics from './pages/AdminStatistics'
import Payment from './pages/Payment'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentFail from './pages/PaymentFail'
import PaymentHistory from './pages/PaymentHistory'
import StaffHome from './pages/StaffHome'
import LectureAdmin from './pages/LectureAdmin'
import StaffSchedule from './pages/StaffSchedule'
import StaffGraduation from './pages/StaffGraduation'
import StaffStudents from './pages/StaffStudents'
import StaffSuggestions from './pages/StaffSuggestions'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

function App() {
  return (
    <AuthProvider>
      <StudyTimerProvider>
        <Routes>

        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <AppShell currentPage="home" pageTitle="홈">
                <Home />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <AppShell currentPage="calendar" pageTitle="캘린더">
                <Calendar />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/suggestions"
          element={
            <RequireAuth>
              <AppShell currentPage="suggestions" pageTitle="건의 게시판">
                <Suggestions />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/mystatus"
          element={
            <RequireAuth>
              <AppShell currentPage="mystatus" pageTitle="MyStatus">
                <MyStatus />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/notice"
          element={
            <AppShell currentPage="notice" pageTitle="공지사항">
              <Notice />
            </AppShell>
          }
        />

        <Route
          path="/academic"
          element={
            <RequireAuth>
              <AppShell currentPage="academic" pageTitle="학사관리">
                <Academic />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/study"
          element={
            <RequireAuth>
              <AppShell currentPage="study" pageTitle="공부">
                <Study />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/career"
          element={
            <RequireAuth>
              <AppShell currentPage="career" pageTitle="진로정보">
                <Career />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/recruit"
          element={
            <AppShell currentPage="recruit" pageTitle="채용정보">
              <Recruit />
            </AppShell>
          }
        />

        <Route
          path="/career/plan"
          element={
            <RequireAuth>
              <AppShell currentPage="careerPlan" pageTitle="주간 계획">
                <CareerPlan />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/career/portfolio"
          element={
            <RequireAuth>
              <AppShell currentPage="careerPortfolio" pageTitle="포트폴리오">
                <CareerPortfolio />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/career/diagnosis"
          element={
            <RequireAuth>
              <AppShell currentPage="careerDiagnosis" pageTitle="진단">
                <CareerDiagnosis />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AppShell currentPage="adminUsers" pageTitle="사용자 관리">
                <AdminUsers />
              </AppShell>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <RequireAdmin>
              <AppShell currentPage="adminStaff" pageTitle="가입 승인">
                <AdminStaff />
              </AppShell>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/adminStatistics"
          element={
            <RequireAdmin>
              <AppShell currentPage="adminStatistics" pageTitle="관리자 통계">
                <AdminStatistics />
              </AppShell>
            </RequireAdmin>
          }
        />

        <Route
          path="/payment"
          element={
            <RequireAuth>
              <AppShell currentPage="payment" pageTitle="플랜">
                <Payment />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/payment/success"
          element={
            <RequireAuth>
              <AppShell currentPage="payment" pageTitle="결제 완료">
                <PaymentSuccess />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/payment/fail"
          element={
            <RequireAuth>
              <AppShell currentPage="payment" pageTitle="결제 실패">
                <PaymentFail />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/payment/history"
          element={
            <RequireAuth>
              <AppShell currentPage="payment" pageTitle="결제 내역">
                <PaymentHistory />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/staff/home"
          element={
            <RequireStaff>
              <AppShell currentPage="staffHome" pageTitle="홈">
                <StaffHome />
              </AppShell>
            </RequireStaff>
          }
        />
        <Route
          path="/staff/lectures"
          element={
            <RequireStaff>
              <AppShell currentPage="lectureAdmin" pageTitle="강의 관리">
                <LectureAdmin />
              </AppShell>
            </RequireStaff>
          }
        />
        <Route
          path="/staff/schedules"
          element={
            <RequireStaff>
              <AppShell currentPage="staffSchedule" pageTitle="학교 일정 등록">
                <StaffSchedule />
              </AppShell>
            </RequireStaff>
          }
        />
        <Route
          path="/staff/graduation"
          element={
            <RequireStaff>
              <AppShell currentPage="staffGraduation" pageTitle="졸업요건 설정">
                <StaffGraduation />
              </AppShell>
            </RequireStaff>
          }
        />
        <Route
          path="/staff/students"
          element={
            <RequireStaff>
              <AppShell currentPage="staffStudents" pageTitle="학생 관리">
                <StaffStudents />
              </AppShell>
            </RequireStaff>
          }
        />
        <Route
          path="/staff/suggestions"
          element={
            <RequireStaff>
              <AppShell currentPage="staffSuggestions" pageTitle="학생 건의 관리">
                <StaffSuggestions />
              </AppShell>
            </RequireStaff>
          }
        />

        <Route path="*" element={<p style={{ padding: 24 }}>페이지를 찾을 수 없습니다.</p>} />
        </Routes>
      </StudyTimerProvider>
    </AuthProvider>
  )
}

export default App
