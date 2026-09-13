import type { AnswerValue, ExamQuestionView } from '@/features/courses/components/ExamQuestionBody';

const BLANK_RE = /\{\{(\d+)\}\}/g;

export function blankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export function isAnswered(value: AnswerValue | undefined, question: ExamQuestionView): boolean {
  if (value === undefined || value === null) return false;
  const type = question.type || 'multiple_choice';
  if (type === 'gap_fill') {
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = blankKeys(question.text);
    return keys.length > 0 && keys.every((k) => Boolean((value as Record<string, string>)[k]));
  }
  return typeof value === 'number' && Number.isFinite(value);
}
