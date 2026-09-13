import type { CourseFolderNode } from '@/core/types/courses-catalog';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SEARCH_DEBOUNCE_MS = 300;

export interface Shift {
  id: number;
  name: string;
  folderId: number;
  folderName: string | null;
  moodleCourseId: number | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  title: string;
  description: string | null;
  meetUrl: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

export interface Enrollment {
  id: number;
  shiftId: number;
  moodleUserId: number;
  fullName?: string;
  email?: string | null;
  username?: string | null;
}

export interface UserSuggestion {
  moodleUserId: number;
  fullname: string;
  email: string;
  username: string;
}

export interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  meetUrl: string | null;
  startsAt: string;
  endsAt: string;
  shiftId: number;
  shiftName: string | null;
  isActive: boolean;
}

export interface ShiftFormState {
  name: string;
  folderId: string;
  moodleCourseId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  meetUrl: string;
  validFrom: string;
  validTo: string;
}

export interface EventFormState {
  shiftId: string;
  title: string;
  meetUrl: string;
  startsAt: string;
  endsAt: string;
}

export function flatFolders(
  nodes: CourseFolderNode[],
  depth = 0,
): { node: CourseFolderNode; depth: number }[] {
  const out: { node: CourseFolderNode; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    out.push(...flatFolders(n.children ?? [], depth + 1));
  }
  return out;
}
