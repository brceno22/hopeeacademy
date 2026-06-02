import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useStudentLayout } from '../../context/StudentLayoutContext';
import type { CourseFolderNode, MoodleCourse } from '../../types/courses-catalog';
import { normalizeTree, findProgramRoot } from '../../utils/courseTree';

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
        levels.map((l) => ({ id: String(l.id), label: l.name })),
        String(levels[0].id),
      );
    }
  }, [levels, setHeaderTitle, setHeaderTabs]);

  const activeLevel = levels.find((l) => String(l.id) === activeTabId) ?? levels[0];

  if (loading) return <p style={{ color: '#64748b' }}>Cargando tu programa...</p>;
  if (error) return <p style={{ color: '#c62828' }}>{error}</p>;

  if (!programRoot || levels.length === 0) {
    return (
      <div className="home-card">
        <h3>Sin niveles configurados</h3>
        <p style={{ color: '#64748b' }}>
          Tu academia aún no organizó los niveles (B1, B2…). Mientras tanto, podés ver todos tus cursos en
          la sección <strong>Mis cursos</strong>.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/cursos')}
          style={{ marginTop: '16px', padding: '12px 20px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Ir a mis cursos
        </button>
      </div>
    );
  }

  const classes = activeLevel?.children ?? [];
  const coursesInLevel = activeLevel?.courses ?? [];

  return (
    <div>
      <p style={{ color: '#64748b', marginBottom: '8px' }}>
        Nivel <strong>{activeLevel?.name}</strong> — elegí una clase o un curso para continuar.
      </p>

      {classes.length > 0 && (
        <>
          <h3 style={{ color: '#1a237e', marginTop: '24px' }}>Clases</h3>
          <div className="program-class-grid">
            {classes.map((cls) => {
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
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📖</div>
                  <h4 style={{ margin: '0 0 8px', color: '#1a237e' }}>{cls.name}</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                    {courseCount} recurso(s) disponible(s)
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {coursesInLevel.length > 0 && (
        <>
          <h3 style={{ color: '#1a237e', marginTop: '28px' }}>Cursos del nivel</h3>
          <div className="program-class-grid">
            {coursesInLevel.map((c) => (
              <CourseTile key={c.id} course={c} onOpen={() => navigate(`/courses/${c.id}`)} />
            ))}
          </div>
        </>
      )}

      {classes.length === 0 && coursesInLevel.length === 0 && (
        <p style={{ color: '#94a3b8' }}>Este nivel aún no tiene clases ni cursos asignados.</p>
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
    <div style={{ fontSize: '1.5rem' }}>📘</div>
    <h4 style={{ margin: '8px 0 4px' }}>{course.name}</h4>
    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{course.code}</span>
  </div>
);
