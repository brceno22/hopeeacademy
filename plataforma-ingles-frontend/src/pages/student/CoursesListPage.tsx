//CoursesListPage.tsx
import React, { useEffect, useState } from 'react';
import { useStudentLayout } from '@/layouts/StudentLayoutContext';
import api from '@/core/api/axios';
import { CourseCard } from '@/features/courses/components/CourseCard';
import type { MoodleCourse } from '@/core/types/courses-catalog';
import "@/features/courses/styles/program-courses.css";

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

  if (loading) return <p className="page-description">Cargando cursos...</p>;

  return (
    <div className="fade-in-page">
      <p className="page-description">
        Todos tus cursos activos en Moodle. Hacé clic para ver lecciones, tareas y material.
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
          <p className="page-description" style={{ margin: 0 }}>No tenés cursos inscriptos actualmente.</p>
        </div>
      )}
    </div>
  );
};