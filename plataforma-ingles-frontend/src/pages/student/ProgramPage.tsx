import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';
import { useCoursesTree } from '@/core/hooks/useCoursesTree';
import type { CourseFolderNode, MoodleCourse } from '@/core/types/courses-catalog';
import { EmptyState, SkeletonGrid } from '@/core/ui/EmptyState';
import {
  progressLabel,
  progressStatus,
  resourceIcon,
} from '@/core/utils/format';
import { findProgramRoot } from '@/features/courses/utils/courseTree';
import '@/features/courses/styles/program-courses.css';
import { useStudentLayout } from '@/layouts/StudentLayoutContext';

interface ProgressDetail {
  courseId: number;
  name?: string;
  percentage: number;
}

export const ProgramPage: React.FC = () => {
  const navigate = useNavigate();
  const { setHeaderTitle, setHeaderTabs, activeTabId } = useStudentLayout();
  const { data: tree = [], isLoading, isError, refetch } = useCoursesTree();

  const { data: progressMap = {} } = useQuery({
    queryKey: ['progress', 'global-map'],
    queryFn: async () => {
      const res = await api.get<{ details?: ProgressDetail[] }>('/progress/global');
      const map: Record<number, number> = {};
      for (const d of res.data.details || []) {
        map[d.courseId] = d.percentage;
      }
      return map;
    },
    staleTime: 60_000,
  });

  const programRoot = useMemo(() => findProgramRoot(tree), [tree]);
  const levels = programRoot?.children ?? [];

  useEffect(() => {
    setHeaderTitle('My program');
    if (levels.length > 0) {
      setHeaderTabs(
        levels.map((l: CourseFolderNode) => ({ id: String(l.id), label: l.name })),
        String(levels[0].id),
      );
    }
  }, [levels, setHeaderTitle, setHeaderTabs]);

  const activeLevel =
    levels.find((l: CourseFolderNode) => String(l.id) === activeTabId) ?? levels[0];

  if (isLoading) {
    return (
      <div className="fade-in-page">
        <div className="skeleton skeleton-line" style={{ width: '55%', height: 18, marginBottom: 24 }} />
        <SkeletonGrid count={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="🎓"
        title="Could not load your program"
        description="There was a problem connecting to the server."
        actionLabel="Try again"
        onAction={() => void refetch()}
      />
    );
  }

  if (!programRoot || levels.length === 0) {
    return (
      <EmptyState
        icon="🗂️"
        title="No programs available"
        description="You’re not enrolled in any program courses yet. Ask your academy to assign you to a classroom, or open My courses."
        actionLabel="Go to my courses"
        onAction={() => navigate('/app/cursos')}
      />
    );
  }

  const classes = activeLevel?.children ?? [];
  const coursesInLevel = activeLevel?.courses ?? [];

  return (
    <div className="fade-in-page">
      <div className="program-hero">
        <p className="program-hero__desc">
          <strong>{activeLevel?.name}</strong> — pick a class or course to continue your path.
        </p>
        <span className="program-level-tag">📚 {activeLevel?.name}</span>
      </div>

      {classes.length > 0 && (
        <>
          <h3 className="section-title">Classes</h3>
          <div className="program-class-grid">
            {classes.map((cls: CourseFolderNode) => {
              const courseCount = (cls.courses?.length ?? 0) + countCoursesInSubtree(cls);
              const avg = averageProgress(cls, progressMap);
              const status = progressStatus(avg);
              return (
                <button
                  key={cls.id}
                  type="button"
                  className="program-class-card"
                  onClick={() => navigate(`/app/programa/clase/${cls.id}`)}
                >
                  <div className="program-card__head">
                    <div className="program-card__icon">📖</div>
                    <span className={`status-pill ${status}`}>{progressLabel(status)}</span>
                  </div>
                  <h4>{cls.name}</h4>
                  <p>{courseCount} resource(s) available</p>
                  {avg != null && (
                    <div className="program-card__progress">
                      <div className="program-card__progress-meta">
                        <span>Progress</span>
                        <span>{avg}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${avg}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="resource-type-row">
                    <span className="resource-type-chip">{resourceIcon('page')} Lessons</span>
                    <span className="resource-type-chip">{resourceIcon('quiz')} Quizzes</span>
                    <span className="resource-type-chip">{resourceIcon('forum')} Forums</span>
                  </div>
                  <span className="card-action-link">View content →</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {coursesInLevel.length > 0 && (
        <>
          <h3 className="section-title">Courses</h3>
          <div className="program-class-grid">
            {coursesInLevel.map((c: MoodleCourse) => (
              <CourseTile
                key={c.id}
                course={c}
                percentage={progressMap[c.id]}
                onOpen={() => navigate(`/app/cursos/${c.id}`)}
              />
            ))}
          </div>
        </>
      )}

      {classes.length === 0 && coursesInLevel.length === 0 && (
        <EmptyState
          icon="📭"
          title="Nothing here yet"
          description="There are no classes or courses available in this program for your account."
        />
      )}
    </div>
  );
};

function countCoursesInSubtree(node: CourseFolderNode): number {
  let n = node.courses?.length ?? 0;
  for (const ch of node.children ?? []) n += countCoursesInSubtree(ch);
  return n;
}

function collectCourseIds(node: CourseFolderNode): number[] {
  const ids = (node.courses ?? []).map((c) => c.id);
  for (const ch of node.children ?? []) ids.push(...collectCourseIds(ch));
  return ids;
}

function averageProgress(
  node: CourseFolderNode,
  map: Record<number, number>,
): number | null {
  const ids = collectCourseIds(node);
  const known = ids.map((id) => map[id]).filter((p) => typeof p === 'number');
  if (known.length === 0) return null;
  return Math.round(known.reduce((a, b) => a + b, 0) / known.length);
}

const CourseTile: React.FC<{
  course: MoodleCourse;
  percentage?: number;
  onOpen: () => void;
}> = ({ course, percentage, onOpen }) => {
  const status = progressStatus(percentage);
  return (
    <button type="button" className="program-class-card" onClick={onOpen}>
      <div className="program-card__head">
        <div className="program-card__icon">{resourceIcon('course')}</div>
        <span className={`status-pill ${status}`}>{progressLabel(status)}</span>
      </div>
      <h4>{course.name}</h4>
      <span className="card-subtitle">{course.code}</span>
      {percentage != null && (
        <div className="program-card__progress">
          <div className="program-card__progress-meta">
            <span>Completed</span>
            <span>{percentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      )}
      <span className="card-action-link">Enter course →</span>
    </button>
  );
};
