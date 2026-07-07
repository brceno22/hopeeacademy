import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../core/api/axios';
import { useStudentLayout } from '../../layouts/StudentLayoutContext';
import type { CourseFolderNode, MoodleCourse } from '../../core/types/courses-catalog';
import { normalizeTree, findProgramRoot } from '@/features/courses/utils/courseTree';
import '@/features/courses/styles/program-courses.css';

export const ProgramPage: React.FC = () => {
  const navigate = useNavigate();
  const { setHeaderTitle, setHeaderTabs, activeTabId } = useStudentLayout();
  const [tree, setTree] = useState<CourseFolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/courses/tree');
        setTree(normalizeTree(res.data));
      } catch {
        setError('No se pudo cargar tu programa.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const programRoot = useMemo(() => findProgramRoot(tree), [tree]);
  const levels = programRoot?.children ?? [];

  useEffect(() => {
    setHeaderTitle('Mi programa');
    if (levels.length > 0) {
      setHeaderTabs(
        levels.map((l:CourseFolderNode) => ({ id: String(l.id), label: l.name })),
        String(levels[0].id),
      );
    }
  }, [levels, setHeaderTitle, setHeaderTabs]);

  const activeLevel = levels.find((l:CourseFolderNode) => String(l.id) === activeTabId) ?? levels[0];

  if (loading) return <p className="page-description">Cargando tu programa...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  if (!programRoot || levels.length === 0) {
    return (
      <div className="home-card fade-in-page">
        <h3>Sin niveles configurados</h3>
        <p className="page-description">
          Tu academia aún no organizó los niveles (B1, B2…). Mientras tanto, podés ver todos tus cursos en
          la sección <strong>Mis cursos</strong>.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/cursos')}
          className="btn-card primary"
          style={{ maxWidth: '200px' }}
        >
          Ir a mis cursos
        </button>
      </div>
    );
  }

  const classes = activeLevel?.children ?? [];
  const coursesInLevel = activeLevel?.courses ?? [];

  return (
    <div className="fade-in-page">
      <p className="page-description">
        Nivel <strong>{activeLevel?.name}</strong> — elegí una clase o un curso para continuar.
      </p>

      {classes.length > 0 && (
        <>
          <h3 className="section-title">Clases del nivel</h3>
          <div className="program-class-grid">
            {classes.map((cls: CourseFolderNode) => {
              const courseCount = (cls.courses?.length ?? 0) + countCoursesInSubtree(cls);
              return (
                <div
                  key={cls.id}
                  className="program-class-card"
                  onClick={() => navigate(`/app/programa/clase/${cls.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/app/programa/clase/${cls.id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ fontSize: '2rem' }}>📖</div>
                  <h4>{cls.name}</h4>
                  <p>{courseCount} recurso(s) disponible(s)</p>
                  <span className="card-action-link">Ver contenido →</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {coursesInLevel.length > 0 && (
        <>
          <h3 className="section-title">Cursos del nivel</h3>
          <div className="program-class-grid">
            {coursesInLevel.map((c: MoodleCourse) => (
              <CourseTile key={c.id} course={c} onOpen={() => navigate(`/app/cursos/${c.id}`)} />
            ))}
          </div>
        </>
      )}

      {classes.length === 0 && coursesInLevel.length === 0 && (
        <div className="home-card">
          <p className="page-description" style={{ margin: 0 }}>Este nivel aún no tiene clases ni cursos asignados.</p>
        </div>
      )}
    </div>
  );
};

function countCoursesInSubtree(node: CourseFolderNode): number {
  let n = node.courses?.length ?? 0;
  for (const ch of node.children ?? []) n += countCoursesInSubtree(ch);
  return n;
}

const CourseTile: React.FC<{ course: MoodleCourse; onOpen: () => void }> = ({ course, onOpen }) => (
  <div className="program-class-card" onClick={onOpen} role="button" tabIndex={0}>
    <div style={{ fontSize: '2rem' }}>📘</div>
    <h4>{course.name}</h4>
    <span className="card-subtitle">{course.code}</span>
    <span className="card-action-link">Entrar al curso →</span>
  </div>
);
