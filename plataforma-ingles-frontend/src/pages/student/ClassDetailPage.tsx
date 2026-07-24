import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCoursesTree } from '@/core/hooks/useCoursesTree';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import '@/features/courses/styles/program-courses.css';
import { useStudentLayout } from '@/layouts/StudentLayoutContext';

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
  const { data: tree = [], isLoading, isError, refetch } = useCoursesTree();

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
      : (sections.find((s) => String(s.id) === activeTabId) ?? sections[0]);

  const coursesToShow =
    activeTabId === 'general' || !sections.length
      ? (classNode?.courses ?? [])
      : [
          ...(activeSection?.courses ?? []),
          ...(activeSection?.children?.flatMap((c) => c.courses ?? []) ?? []),
        ];

  if (isLoading) return <p className="page-description">Loading class...</p>;

  if (isError) {
    return (
      <div className="home-card">
        <p className="page-description">Could not load the class.</p>
        <button type="button" className="btn-card primary" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!classNode) {
    return (
      <p className="page-description">
        Class not found.{' '}
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/app/programa')}
        >
          Back to program
        </button>
      </p>
    );
  }

  return (
    <div className="fade-in-page">
      <button type="button" className="btn-back" onClick={() => navigate('/app/programa')}>
        <span>←</span> Back to levels
      </button>

      <p className="page-description">
        Content for <strong>{classNode.name}</strong>
        {activeSection ? ` · ${activeSection.name}` : ''}
      </p>

      {coursesToShow.length === 0 ? (
        <div className="home-card">
          <p className="page-description" style={{ margin: 0 }}>
            No courses linked in this section yet.
          </p>
        </div>
      ) : (
        <div className="program-class-grid">
          {coursesToShow.map((c) => (
            <div
              key={c.id}
              className="program-class-card"
              onClick={() => navigate(`/app/cursos/${c.id}`)}
              role="button"
              tabIndex={0}
            >
              <div style={{ fontSize: '2rem' }}>📘</div>
              <h4>{c.name}</h4>
              <p>{c.description?.slice(0, 80)}...</p>
              <span className="card-action-link">Enter course →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
