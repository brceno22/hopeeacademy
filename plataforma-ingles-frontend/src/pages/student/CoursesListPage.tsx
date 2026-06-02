import React, { useEffect, useState } from 'react';
import { useStudentLayout } from '../../context/StudentLayoutContext';
import api from '../../api/axios';
import { CourseCard } from '../../components/CourseCard';
import type { MoodleCourse } from '../../types/courses-catalog';

export const CoursesListPage: React.FC = () => {
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHeaderTitle('Mis cursos');
    clearHeaderTabs();
  }, [setHeaderTitle, clearHeaderTabs]);

  useEffect(() => {
    api.get<MoodleCourse[]>('/courses').then((res) => {
      setCourses(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p style={{ color: '#64748b' }}>Cargando cursos...</p>;

  return (
    <>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Todos tus cursos activos en Moodle. Hacé clic para ver lecciones, tareas y material.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {courses.map((course) => (
          <CourseCard key={course.id} id={course.id} name={course.name} code={course.code} description={course.description} />
        ))}
      </div>
      {courses.length === 0 && <p>No tenés cursos inscriptos.</p>}
    </>
  );
};
