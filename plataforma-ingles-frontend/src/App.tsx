import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ProtectedAdminRoute,
  ProtectedStudentRoute,
} from '@/core/components/ProtectedRoute';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Login } from '@/features/auth/components/Login';
import { AdminLogin } from '@/features/auth/components/AdminLogin';
import { AdminMicrolearning } from '@/features/microlearning/components/AdminMicrolearning';
import { AdminLayout } from '@/layouts/AdminLayout';
import { StudentLayout } from '@/layouts/StudentLayout';
import { AdminCalendar } from '@/pages/admin/AdminCalendar';
import { AdminCourseCatalog } from '@/pages/admin/AdminCourseCatalog';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminHome } from '@/pages/admin/AdminHome';
import { AdminRecordings } from '@/pages/admin/AdminRecordings';
import { AttendancePage } from '@/pages/student/AttendancePage';
import { CalendarPage } from '@/pages/student/CalendarPage';
import { ClassDetailPage } from '@/pages/student/ClassDetailPage';
import { CoursesListPage } from '@/pages/student/CoursesListPage';
import { CourseViewPage } from '@/pages/student/CourseViewPage';
import { ExamTakePage } from '@/pages/student/ExamTakePage';
import { ExamsPage } from '@/pages/student/ExamsPage';
import { ForumPage } from '@/pages/student/ForumPage';
import { HomePage } from '@/pages/student/HomePage';
import { MicrolearningPage } from '@/pages/student/MicrolearningPage';
import { ProfilePage } from '@/pages/student/ProfilePage';
import { ProgramPage } from '@/pages/student/ProgramPage';
import { ProgressView } from '@/pages/student/ProgressView';
import { RecordingPlayerPage } from '@/pages/student/RecordingPlayerPage';
import { RecordingsPage } from '@/pages/student/RecordingsPage';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route
            path="/app"
            element={
              <ProtectedStudentRoute>
                <StudentLayout />
              </ProtectedStudentRoute>
            }
          >
            <Route index element={<Navigate to="/app/inicio" replace />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="programa" element={<ProgramPage />} />
            <Route path="programa/clase/:classId" element={<ClassDetailPage />} />
            <Route path="cursos" element={<CoursesListPage />} />
            <Route path="asistencia" element={<AttendancePage />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="grabaciones" element={<RecordingsPage />} />
            <Route path="grabaciones/:id" element={<RecordingPlayerPage />} />
            <Route path="progreso" element={<ProgressView />} />
            <Route path="cursos/:id" element={<CourseViewPage />} />
            <Route path="examenes/:examId/take" element={<ExamTakePage />} />
            <Route path="microlearning" element={<MicrolearningPage />} />
            <Route path="foro" element={<ForumPage />} />
            <Route path="examenes" element={<ExamsPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>

          <Route path="/courses/:id" element={<Navigate to="/app/cursos/:id" replace />} />
          <Route path="/exams/:examId/take" element={<Navigate to="/app/examenes/:examId/take" replace />} />
          <Route path="/dashboard" element={<Navigate to="/app/inicio" replace />} />
          <Route path="/mis-cursos" element={<Navigate to="/app/programa" replace />} />
          <Route path="/mis-cursos/*" element={<Navigate to="/app/programa" replace />} />

          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<Navigate to="/admin/examenes" replace />} />

          <Route
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route path="/admin/inicio" element={<AdminHome />} />
            <Route path="/admin/carpetas" element={<AdminCourseCatalog />} />
            <Route path="/admin/grabaciones" element={<AdminRecordings />} />
            <Route path="/admin/calendario" element={<AdminCalendar />} />
            <Route path="/admin/microlearning" element={<AdminMicrolearning />} />
            <Route path="/admin/examenes" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
