import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';
import type { MoodleCourse } from '@/core/types/courses-catalog';
import { coursesKeys } from './useCoursesTree';

async function fetchCoursesList(): Promise<MoodleCourse[]> {
  const res = await api.get<MoodleCourse[]>('/courses');
  return Array.isArray(res.data) ? res.data : [];
}

export function useCoursesList(enabled = true) {
  return useQuery({
    queryKey: coursesKeys.list(),
    queryFn: fetchCoursesList,
    enabled,
  });
}
