import React, { useMemo, useState } from 'react';
import { API_BASE_URL } from '@/core/api/axios';

export type QuestionType = 'multiple_choice' | 'true_false' | 'gap_fill';

export interface ExamOption {
  id: number;
  text: string;
}

export interface ExamQuestionView {
  id: number;
  text: string;
  type?: QuestionType;
  imageUrl?: string | null;
  audioUrl?: string | null;
  wordBank?: string[];
  options: ExamOption[];
}

export type AnswerValue = number | Record<string, string>;

function resolveMediaSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return path;
}

const BLANK_RE = /\{\{(\d+)\}\}/g;

function blankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

function renderPromptWithBlanks(
  text: string,
  blanks: Record<string, string>,
  onClearBlank: (key: string) => void,
  activeBlank: string | null,
  setActiveBlank: (key: string) => void,
) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(BLANK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const key = m[1];
    const filled = blanks[key];
    parts.push(
      <button
        key={`blank-${key}-${m.index}`}
        type="button"
        className={`exam-blank ${filled ? 'filled' : ''} ${activeBlank === key ? 'active' : ''}`}
        onClick={() => {
          if (filled) onClearBlank(key);
          else setActiveBlank(key);
        }}
      >
        {filled || `___${key}___`}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

interface Props {
  question: ExamQuestionView;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  optionClassName?: (selected: boolean) => string;
  /** Prefer exam-option-btn styling when true */
  useCourseStyles?: boolean;
}

export const ExamQuestionBody: React.FC<Props> = ({
  question,
  value,
  onChange,
  useCourseStyles = false,
}) => {
  const type = question.type || 'multiple_choice';
  const keys = useMemo(() => blankKeys(question.text), [question.text]);
  const blanks =
    type === 'gap_fill' && value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {};
  const [activeBlank, setActiveBlank] = useState<string | null>(keys[0] ?? null);

  const usedWords = new Set(Object.values(blanks).filter(Boolean));
  const bank = question.wordBank || [];

  const placeWord = (word: string) => {
    const target =
      activeBlank && !blanks[activeBlank]
        ? activeBlank
        : keys.find((k) => !blanks[k]) ?? activeBlank;
    if (!target) return;
    const nextBlanks = { ...blanks, [target]: word };
    onChange(nextBlanks);
    const remaining = keys.find((k) => !nextBlanks[k]);
    setActiveBlank(remaining ?? target);
  };

  const clearBlank = (key: string) => {
    const next = { ...blanks };
    delete next[key];
    onChange(next);
    setActiveBlank(key);
  };

  return (
    <div className="exam-question-body">
      {resolveMediaSrc(question.imageUrl) ? (
        <img
          src={resolveMediaSrc(question.imageUrl)!}
          alt=""
          className="exam-media-image"
          style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 12 }}
        />
      ) : null}
      {resolveMediaSrc(question.audioUrl) ? (
        <audio
          controls
          src={resolveMediaSrc(question.audioUrl)!}
          style={{ width: '100%', marginBottom: 12 }}
        >
          Your browser does not support audio.
        </audio>
      ) : null}

      {type === 'gap_fill' ? (
        <>
          <p className="exam-gap-prompt" style={{ fontSize: 18, lineHeight: 1.7 }}>
            {renderPromptWithBlanks(
              question.text,
              blanks,
              clearBlank,
              activeBlank,
              setActiveBlank,
            )}
          </p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
            Tap a blank, then a word from the box. Tap a filled blank to clear it.
          </p>
          <div className="exam-word-bank" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bank.map((word, i) => {
              const used = usedWords.has(word);
              return (
                <button
                  key={`${word}-${i}`}
                  type="button"
                  disabled={used}
                  onClick={() => placeWord(word)}
                  className={useCourseStyles ? 'exam-option-btn' : undefined}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: used ? '#eee' : '#fff8e1',
                    cursor: used ? 'default' : 'pointer',
                    opacity: used ? 0.45 : 1,
                  }}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h3 style={{ marginTop: 0 }}>{question.text}</h3>
          {(question.options || []).map((opt) => {
            const selected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={
                  useCourseStyles
                    ? `exam-option-btn ${selected ? 'selected' : ''}`
                    : undefined
                }
                onClick={() => onChange(opt.id)}
                style={
                  useCourseStyles
                    ? undefined
                    : {
                        display: 'block',
                        width: '100%',
                        marginBottom: 10,
                        padding: 14,
                        textAlign: 'left',
                        border: selected ? '2px solid #9c27b0' : '1px solid #ddd',
                        background: selected ? '#f3e5f5' : '#fafafa',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }
                }
              >
                {opt.text}
              </button>
            );
          })}
        </>
      )}
      <style>{`
        .exam-blank {
          display: inline-block;
          margin: 0 4px;
          padding: 2px 10px;
          border: 2px dashed #0071bc;
          border-radius: 6px;
          background: #e3f2fd;
          cursor: pointer;
          font: inherit;
        }
        .exam-blank.filled {
          border-style: solid;
          background: #fff3e0;
          border-color: #ff7b00;
        }
        .exam-blank.active {
          box-shadow: 0 0 0 2px rgba(0,113,188,0.35);
        }
      `}</style>
    </div>
  );
};

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
