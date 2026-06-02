import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useStudentLayout } from '../../context/StudentLayoutContext';
import type { CourseFolderNode } from '../../types/courses-catalog';
import { normalizeTree } from '../../utils/courseTree';

function findNodeById(nodes: CourseFolderNode[], id: number): CourseFolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNodeById(n.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export const ClassDetailPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { setHeaderTitle, setHeaderTabs, activeTabId } = useStudentLayout();
  const [tree, setTree] = useState<CourseFolderNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/courses/tree').then((res) => {
      setTree(normalizeTree(res.data));
      setLoading(false);
    });
  }, []);

  const classNode = useMemo(() => {
    const id = parseInt(classId ?? '0', 10);
    return findNodeById(tree, id);
  }, [tree, classId]);

  const sections = classNode?.children ?? [];

  useEffect(() => {
    if (!classNode) return;
    setHeaderTitle(classNode.name);
    if (sections.length > 0) {
      setHeaderTabs(
        sections.map((s) => ({ id: String(s.id), label: s.name })),
        String(sections[0].id),
      );
    } else {
      setHeaderTabs([{ id: 'general', label: 'General' }], 'general');
    }
  }, [classNode, sections, setHeaderTitle, setHeaderTabs]);

  const activeSection =
    activeTabId === 'general'
      ? null
      : sections.find((s) => String(s.id) === activeTabId) ?? sections[0];

  const coursesToShow =
    activeTabId === 'general' || !sections.length
      ? classNode?.courses ?? []
      : [...(activeSection?.courses ?? []), ...(activeSection?.children?.flatMap((c) => c.courses ?? []) ?? [])];

  if (loading) return <p>Cargando clase...</p>;
  if (!classNode) {
    return (
      <p>
        Clase no encontrada.{' '}
        <button type="button" onClick={() => navigate('/app/programa')}>Volver al programa</button>
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/app/programa')}
        style={{ marginBottom: '20px', background: 'transparent', border: '1px solid #ccc', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
      >
        ← Volver a niveles
      </button>

      <p style={{ color: '#64748b' }}>
        Contenido de <strong>{classNode.name}</strong>
        {activeSection ? ` · ${activeSection.name}` : ''}
      </p>

      {coursesToShow.length === 0 ? (
        <div className="home-card">
          <p style={{ color: '#64748b' }}>No hay cursos enlazados en esta sección todavía.</p>
        </div>
      ) : (
        <div className="program-class-grid">
          {coursesToShow.map((c) => (
            <div
              key={c.id}
              className="program-class-card"
              onClick={() => navigate(`/courses/${c.id}`)}
              role="button"
              tabIndex={0}
            >
              <div style={{ fontSize: '1.5rem' }}>📘</div>
              <h4 style={{ margin: '8px 0' }}>{c.name}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{c.description?.slice(0, 80)}</p>
              <span style={{ display: 'inline-block', marginTop: '12px', color: '#1a237e', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Entrar al curso →
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
