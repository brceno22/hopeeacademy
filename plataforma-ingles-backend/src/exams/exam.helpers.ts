import { QuestionType } from './entities/question.entity';

export type MyExamStatus = 'pending' | 'passed' | 'failed' | 'exhausted';

export interface MyExamSummary {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  description: string | null;
  maxAttempts: number;
  passThreshold: number;
  attemptsUsed: number;
  bestScore: number | null;
  status: MyExamStatus;
}

export interface ShiftGradeExamColumn {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  maxAttempts: number;
  passThreshold: number;
}

export interface ShiftGradeCell {
  examId: number;
  attemptsUsed: number;
  bestScore: number | null;
  lastScore: number | null;
  lastFinishedAt: string | null;
  status: MyExamStatus;
}

export interface ShiftGradeStudentRow {
  moodleUserId: number;
  fullName: string;
  email: string | null;
  results: ShiftGradeCell[];
}

export interface ShiftGradebook {
  shift: {
    id: number;
    name: string;
    folderId: number;
    folderName: string | null;
  };
  exams: ShiftGradeExamColumn[];
  students: ShiftGradeStudentRow[];
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_PASS_THRESHOLD = 60;

const BLANK_RE = /\{\{(\d+)\}\}/g;

export function extractBlankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export function resolveType(q: { type?: string | null }): QuestionType {
  if (q.type === 'true_false' || q.type === 'gap_fill' || q.type === 'multiple_choice') {
    return q.type;
  }
  return 'multiple_choice';
}

export function resolveAttemptStatus(
  attemptsUsed: number,
  bestScore: number | null,
  maxAttempts: number,
  passThreshold: number,
): MyExamStatus {
  if (bestScore != null && bestScore >= passThreshold) return 'passed';
  if (attemptsUsed >= maxAttempts) return 'exhausted';
  if (attemptsUsed > 0) return 'failed';
  return 'pending';
}
