import { API_BASE_URL } from '@/core/api/axios';
import type { CatalogCourseItem } from './catalogCourses';

export type QuestionType = 'multiple_choice' | 'true_false' | 'gap_fill';

export interface Option {
  id?: number;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id?: number;
  text: string;
  type: QuestionType;
  order: number;
  imageUrl?: string;
  audioUrl?: string;
  wordBank?: string[];
  correctBlanks?: Record<string, string>;
  options: Option[];
}

export interface Exam {
  id: number;
  courseId: number;
  title: string;
  description: string;
  active: boolean;
  maxAttempts?: number;
  passThreshold?: number;
  questions: Question[];
}

export type ExamDraft = Omit<Exam, 'id'> & { id?: number };

const BLANK_RE = /\{\{(\d+)\}\}/g;

export function extractBlankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export const emptyQuestion = (order = 1): Question => ({
  text: '',
  type: 'multiple_choice',
  order,
  imageUrl: '',
  audioUrl: '',
  wordBank: [],
  correctBlanks: {},
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});

export const emptyExam = (): ExamDraft => ({
  courseId: 0,
  title: '',
  description: '',
  active: true,
  maxAttempts: 3,
  passThreshold: 60,
  questions: [emptyQuestion()],
});

export function resolveExamMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return path;
}

export function normalizeLoadedQuestion(q: Partial<Question> & { options?: Option[] }): Question {
  const type = (q.type as QuestionType) || 'multiple_choice';
  return {
    id: q.id,
    text: q.text || '',
    type,
    order: q.order ?? 1,
    imageUrl: q.imageUrl || '',
    audioUrl: q.audioUrl || '',
    wordBank: Array.isArray(q.wordBank) ? q.wordBank : [],
    correctBlanks: q.correctBlanks || {},
    options:
      type === 'true_false'
        ? q.options?.length === 2
          ? q.options
          : [
              { text: 'True', isCorrect: true },
              { text: 'False', isCorrect: false },
            ]
        : type === 'gap_fill'
          ? []
          : q.options?.length
            ? q.options
            : emptyQuestion().options,
  };
}

export type CourseLabelMap = Map<number, CatalogCourseItem>;
