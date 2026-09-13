import type { CourseFolderNode } from '@/core/types/courses-catalog';

export interface CatalogCourseItem {
  moodleCourseId: number;
  courseName: string;
  folderPath: string;
}

/** Flatten Hopee folder tree into courses with folder path labels. */
export function flattenCatalogCourses(
  nodes: CourseFolderNode[],
  parentPath: string[] = [],
): CatalogCourseItem[] {
  const out: CatalogCourseItem[] = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    const folderPath = path.join(' / ');
    for (const c of node.courses ?? []) {
      out.push({
        moodleCourseId: c.id,
        courseName: c.name,
        folderPath,
      });
    }
    out.push(...flattenCatalogCourses(node.children ?? [], path));
  }
  return out;
}
