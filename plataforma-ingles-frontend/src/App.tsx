import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ProtectedAdminRoute,
  ProtectedStudentRoute,
} from '@/core/components/ProtectedRoute';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Login } from '@/features/auth/components/Login';
import { AdminLogin } from '@/features/auth/components/AdminLogin';

const loadStudent = () => import('@/routes/studentChunk');
const loadAdmin = () => import('@/routes/adminChunk');

const StudentLayout = lazy(() => loadStudent().then((m) => ({ default: m.StudentLayout })));
const HomePage = lazy(() => loadStudent().then((m) => ({ default: m.HomePage })));
const ProgramPage = lazy(() => loadStudent().then((m) => ({ default: m.ProgramPage })));
const ClassDetailPage = lazy(() => loadStudent().then((m) => ({ default: m.ClassDetailPage })));
const CoursesListPage = lazy(() => loadStudent().then((m) => ({ default: m.CoursesListPage })));
const AttendancePage = lazy(() => loadStudent().then((m) => ({ default: m.AttendancePage })));
const CalendarPage = lazy(() => loadStudent().then((m) => ({ default: m.CalendarPage })));
const RecordingsPage = lazy(() => loadStudent().then((m) => ({ default: m.RecordingsPage })));
const RecordingPlayerPage = lazy(() =>
  loadStudent().then((m) => ({ default: m.RecordingPlayerPage })),
);
const ProgressView = lazy(() => loadStudent().then((m) => ({ default: m.ProgressView })));
const CourseViewPage = lazy(() => loadStudent().then((m) => ({ default: m.CourseViewPage })));
const ExamTakePage = lazy(() => loadStudent().then((m) => ({ default: m.ExamTakePage })));
const MicrolearningPage = lazy(() => loadStudent().then((m) => ({ default: m.MicrolearningPage })));
const ForumPage = lazy(() => loadStudent().then((m) => ({ default: m.ForumPage })));
const ExamsPage = lazy(() => loadStudent().then((m) => ({ default: m.ExamsPage })));
const ProfilePage = lazy(() => loadStudent().then((m) => ({ default: m.ProfilePage })));

const AdminLayout = lazy(() => loadAdmin().then((m) => ({ default: m.AdminLayout })));
const AdminHome = lazy(() => loadAdmin().then((m) => ({ default: m.AdminHome })));
const AdminCourseCatalog = lazy(() => loadAdmin().then((m) => ({ default: m.AdminCourseCatalog })));
const AdminRecordings = lazy(() => loadAdmin().then((m) => ({ default: m.AdminRecordings })));
const AdminCalendar = lazy(() => loadAdmin().then((m) => ({ default: m.AdminCalendar })));
const AdminMicrolearning = lazy(() => loadAdmin().then((m) => ({ default: m.AdminMicrolearning })));
const AdminDashboard = lazy(() => loadAdmin().then((m) => ({ default: m.AdminDashboard })));

function RouteFallback() {
  return (
    <div style={{ padding: 24 }} aria-busy="true">
      <div className="skeleton skeleton-line" style={{ width: '40%', height: 28 }} />
      <div className="skeleton skeleton-card" style={{ marginTop: 16 }} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<RouteFallback />}>
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
            <Route
              path="/exams/:examId/take"
              element={<Navigate to="/app/examenes/:examId/take" replace />}
            />
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
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
