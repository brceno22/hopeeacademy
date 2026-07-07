import type { CourseFolderNode } from '@/core/types/courses-catalog';

export function normalizeTree(nodes: unknown): CourseFolderNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId ?? null,
    name: n.name ?? 'Sin nombre',
    slug: n.slug ?? null,
    sortOrder: n.sortOrder ?? 0,
    children: normalizeTree(n.children),
    courses: Array.isArray(n.courses) ? n.courses : [],
  }));
}

/** Raíz del programa: slug mis-cursos o primer nodo raíz. */
export function findProgramRoot(tree: CourseFolderNode[]): CourseFolderNode | null {
  if (!tree.length) return null;
  const bySlug = tree.find((n) => n.slug === 'mis-cursos');
  if (bySlug) return bySlug;
  return tree[0];
}
