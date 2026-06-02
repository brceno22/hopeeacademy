import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { CourseView } from './components/CourseView';
import { ExamTakePage } from './components/ExamTakePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentLayout } from './layouts/StudentLayout';
import { HomePage } from './pages/student/HomePage';
import { ProgramPage } from './pages/student/ProgramPage';
import { ClassDetailPage } from './pages/student/ClassDetailPage';
import { CoursesListPage } from './pages/student/CoursesListPage';
import { PlaceholderPage } from './pages/student/PlaceholderPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminCourseCatalog } from './pages/AdminCourseCatalog';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/app" element={<StudentLayout />}>
            <Route index element={<Navigate to="/app/inicio" replace />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="programa" element={<ProgramPage />} />
            <Route path="programa/clase/:classId" element={<ClassDetailPage />} />
            <Route path="cursos" element={<CoursesListPage />} />
            <Route
              path="examenes"
              element={
                <PlaceholderPage
                  title="Exámenes"
                  icon="📝"
                  description="Próximamente verás aquí todos tus exámenes de la plataforma. Mientras tanto, entrá al curso correspondiente desde Mi programa o Mis cursos."
                />
              }
            />
            <Route
              path="perfil"
              element={
                <PlaceholderPage
                  title="Mi perfil"
                  icon="👤"
                  description="Datos de tu cuenta Moodle, progreso y certificados. Sección en desarrollo."
                />
              }
            />
          </Route>

          <Route path="/courses/:id" element={<CourseView />} />
          <Route path="/exams/:examId/take" element={<ExamTakePage />} />

          <Route path="/dashboard" element={<Navigate to="/app/inicio" replace />} />
          <Route path="/mis-cursos" element={<Navigate to="/app/programa" replace />} />
          <Route path="/mis-cursos/*" element={<Navigate to="/app/programa" replace />} />

          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/carpetas" element={<AdminCourseCatalog />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
