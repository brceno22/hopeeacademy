export interface MoodleCourse {
  id: number;
  name: string;
  code: string;
  description: string;
  linkId?: number;
  sortOrder?: number;
}

export interface CourseFolderNode {
  id: number;
  parentId: number | null;
  name: string;
  slug: string | null;
  sortOrder: number;
  children: CourseFolderNode[];
  courses: MoodleCourse[];
}
