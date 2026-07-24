import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import { normalizeTree } from '@/features/courses/utils/courseTree';

export const coursesKeys = {
  all: ['courses'] as const,
  tree: () => [...coursesKeys.all, 'tree'] as const,
  list: () => [...coursesKeys.all, 'list'] as const,
};

async function fetchCoursesTree(): Promise<CourseFolderNode[]> {
  const res = await api.get('/courses/tree');
  return normalizeTree(res.data);
}

export function useCoursesTree(enabled = true) {
  return useQuery({
    queryKey: coursesKeys.tree(),
    queryFn: fetchCoursesTree,
    enabled,
  });
}
