import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes globales y Auth
import { Login } from '@/features/auth/components/Login';
import { ErrorBoundary } from './core/components/ErrorBoundary';

// Layout Estudiante
import { StudentLayout } from './layouts/StudentLayout';

// Páginas de Alumno (Estructura limpia)
import { HomePage } from './pages/student/HomePage';
import { ProgramPage } from './pages/student/ProgramPage';
import { ClassDetailPage } from './pages/student/ClassDetailPage';
import { CoursesListPage } from './pages/student/CoursesListPage';
import { CourseViewPage } from './pages/student/CourseViewPage'; // <-- Nueva página wrapper
import { ExamTakePage } from './pages/student/ExamTakePage';     // <-- Movido a pages/student/
import { PlaceholderPage } from './pages/student/PlaceholderPage';
import { ForumPage } from './pages/student/ForumPage';

// Páginas de Administración
import { AdminLogin } from './features/auth/components/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminCourseCatalog } from '@/pages/admin/AdminCourseCatalog';
import { AdminMicrolearning } from '@/features/microlearning/components/AdminMicrolearning';

import { ProgressView } from './pages/student/ProgressView';
import { MicrolearningPage } from './pages/student/MicrolearningPage';



function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* RUTA PÚBLICA */}
          <Route path="/" element={<Login />} />

          {/* RUTAS ALUMNO (Todas envueltas bajo el menú lateral y header fijo) */}
          <Route path="/app" element={<StudentLayout />}>
            <Route index element={<Navigate to="/app/inicio" replace />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="programa" element={<ProgramPage />} />
            <Route path="programa/clase/:classId" element={<ClassDetailPage />} />
            <Route path="cursos" element={<CoursesListPage />} />
            <Route path="progreso" element={<ProgressView />} />
            
            {/* INTEGRACIÓN EXITOSA: El visor y el examen ahora respetan el layout */}
            <Route path="cursos/:id" element={<CourseViewPage />} />
            <Route path="examenes/:examId/take" element={<ExamTakePage />} />
            <Route path="microlearning" element={<MicrolearningPage />} />
            <Route path="foro" element={<ForumPage />} />
            
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

          {/* REDIRECCIONES LEGACY (Para mantener compatibilidad absoluta) */}
          <Route path="/courses/:id" element={<Navigate to="/app/cursos/:id" replace />} />
          <Route path="/exams/:examId/take" element={<Navigate to="/app/examenes/:examId/take" replace />} />
          <Route path="/dashboard" element={<Navigate to="/app/inicio" replace />} />
          <Route path="/mis-cursos" element={<Navigate to="/app/programa" replace />} />
          <Route path="/mis-cursos/*" element={<Navigate to="/app/programa" replace />} />

          {/* RUTAS ADMIN */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/carpetas" element={<AdminCourseCatalog />} />
          <Route path="/admin/microlearning" element={<AdminMicrolearning />} />

          {/* FALLBACK GENERAL */}
          <Route path="*" element={<Navigate to="/" replace />} />


         

         
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;