import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';

export interface CourseProgress {
  courseId: number;
  name: string;
  percentage: number;
}

export interface GlobalProgressData {
  totalCourses: number;
  completedCourses: number;
  globalPercentage: number;
  details: CourseProgress[];
}

export const progressKeys = {
  all: ['progress'] as const,
  global: () => [...progressKeys.all, 'global'] as const,
};

async function fetchGlobalProgress(): Promise<GlobalProgressData> {
  const res = await api.get<GlobalProgressData>('/progress/global');
  return res.data;
}

export function useProgress(enabled = true) {
  return useQuery({
    queryKey: progressKeys.global(),
    queryFn: fetchGlobalProgress,
    enabled,
  });
}
