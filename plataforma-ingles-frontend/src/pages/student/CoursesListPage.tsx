import React, { useEffect } from 'react';
import { useStudentLayout } from '@/layouts/useStudentLayout';
import { useCoursesList } from '@/core/hooks/useCoursesList';
import { CourseCard } from '@/features/courses/components/CourseCard';
import '@/features/courses/styles/program-courses.css';

export const CoursesListPage: React.FC = () => {
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();
  const { data: courses = [], isPending, isError } = useCoursesList();

  useEffect(() => {
    setHeaderTitle('My courses');
    clearHeaderTabs();
  }, [setHeaderTitle, clearHeaderTabs]);

  if (isPending) return <p className="page-description">Loading courses...</p>;

  if (isError) {
    return (
      <div className="home-card">
        <p className="page-description" style={{ margin: 0 }}>
          Could not load your courses. Try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in-page">
      <p className="page-description">
        All your active Moodle courses. Click to view lessons, assignments, and materials.
      </p>

      <div className="courses-grid">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            id={course.id}
            name={course.name}
            code={course.code}
            description={course.description}
          />
        ))}
      </div>

      {courses.length === 0 && (
        <div className="home-card">
          <p className="page-description" style={{ margin: 0 }}>
            You&apos;re not enrolled in any courses yet.
          </p>
        </div>
      )}
    </div>
  );
};
