import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '@/core/api/axios';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import {
  CatalogCoursePicker,
  flattenCatalogCourses,
  type CatalogCourseItem,
} from './CatalogCoursePicker';
import './admin.css';

type QuestionType = 'multiple_choice' | 'true_false' | 'gap_fill';

interface Option {
  id?: number;
  text: string;
  isCorrect: boolean;
}

interface Question {
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

interface Exam {
  id: number;
  courseId: number;
  title: string;
  description: string;
  active: boolean;
  maxAttempts?: number;
  passThreshold?: number;
  questions: Question[];
}

const BLANK_RE = /\{\{(\d+)\}\}/g;

function extractBlankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

const emptyQuestion = (order = 1): Question => ({
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

const emptyExam = () => ({
  courseId: 0,
  title: '',
  description: '',
  active: true,
  maxAttempts: 3,
  passThreshold: 60,
  questions: [emptyQuestion()],
});

function resolveExamMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return path;
}

function normalizeLoadedQuestion(q: Partial<Question> & { options?: Option[] }): Question {
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

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const adminKey = localStorage.getItem('adminKey');

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingExam, setEditingExam] = useState<any>(emptyExam());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [distractorDraft, setDistractorDraft] = useState<Record<number, string>>({});
  const [catalogItems, setCatalogItems] = useState<CatalogCourseItem[]>([]);
  const [mediaUploading, setMediaUploading] = useState<string | null>(null);

  const courseLabelById = useMemo(() => {
    const map = new Map<number, CatalogCourseItem>();
    for (const item of catalogItems) {
      if (!map.has(item.moodleCourseId)) map.set(item.moodleCourseId, item);
    }
    return map;
  }, [catalogItems]);

  useEffect(() => {
    if (!adminKey) {
      navigate('/admin');
      return;
    }
    void fetchExams();
    void (async () => {
      try {
        const treeRes = await api.get<CourseFolderNode[]>('/courses/admin/tree', {
          headers: { 'x-admin-key': adminKey },
        });
        setCatalogItems(flattenCatalogCourses(treeRes.data || []));
      } catch {
        setCatalogItems([]);
      }
    })();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exams', { headers: { 'x-admin-key': adminKey } });
      setExams(res.data);
    } catch {
      setError('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingExam.courseId || editingExam.courseId < 1) {
      setError('Select a course from the catalog');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: editingExam.title,
        description: editingExam.description ?? '',
        courseId: editingExam.courseId,
        active: editingExam.active,
        maxAttempts: editingExam.maxAttempts ?? 3,
        passThreshold: editingExam.passThreshold ?? 60,
        questions: editingExam.questions.map((q: Question) => ({
          id: q.id,
          text: q.text,
          type: q.type || 'multiple_choice',
          order: q.order,
          imageUrl: q.imageUrl || null,
          audioUrl: q.audioUrl || null,
          wordBank: q.type === 'gap_fill' ? q.wordBank || [] : undefined,
          correctBlanks: q.type === 'gap_fill' ? q.correctBlanks || {} : undefined,
          options:
            q.type === 'gap_fill'
              ? []
              : (q.options || []).map((o) => ({
                  id: o.id,
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
        })),
      };
      if (view === 'edit' && editingExam.id) {
        await api.put(`/exams/${editingExam.id}`, payload, {
          headers: { 'x-admin-key': adminKey },
        });
        setSuccess('Exam updated successfully');
      } else {
        await api.post('/exams', payload, { headers: { 'x-admin-key': adminKey } });
        setSuccess('Exam created successfully');
      }
      await fetchExams();
      setTimeout(() => {
        setSuccess('');
        setView('list');
      }, 1500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to save exam';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    try {
      await api.delete(`/exams/${id}`, { headers: { 'x-admin-key': adminKey } });
      setSuccess('Exam deleted');
      await fetchExams();
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to delete');
    }
  };

  const addQuestion = () => {
    setEditingExam((prev: any) => ({
      ...prev,
      questions: [...prev.questions, emptyQuestion(prev.questions.length + 1)],
    }));
  };

  const removeQuestion = (qi: number) => {
    setEditingExam((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((_: any, i: number) => i !== qi),
    }));
  };

  const updateQuestion = (qi: number, field: string, value: any) => {
    setEditingExam((prev: any) => {
      const questions = [...prev.questions];
      questions[qi] = { ...questions[qi], [field]: value };
      return { ...prev, questions };
    });
  };

  const setQuestionType = (qi: number, type: QuestionType) => {
    setEditingExam((prev: any) => {
      const questions = [...prev.questions];
      const current = { ...questions[qi], type };
      if (type === 'true_false') {
        current.options = [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ];
        current.wordBank = [];
        current.correctBlanks = {};
      } else if (type === 'gap_fill') {
        current.options = [];
        current.wordBank = current.wordBank || [];
        current.correctBlanks = current.correctBlanks || {};
        if (!current.text.includes('{{')) current.text = 'They {{1}} students.';
      } else {
        current.options =
          current.options?.length >= 2
            ? current.options
            : emptyQuestion().options;
      }
      questions[qi] = current;
      return { ...prev, questions };
    });
  };

  const updateOption = (qi: number, oi: number, field: string, value: any) => {
    setEditingExam((prev: any) => {
      const questions = [...prev.questions];
      const options = [...questions[qi].options];
      if (field === 'isCorrect' && value === true) {
        options.forEach((o, i) => {
          options[i] = { ...o, isCorrect: i === oi };
        });
      } else {
        options[oi] = { ...options[oi], [field]: value };
      }
      questions[qi] = { ...questions[qi], options };
      return { ...prev, questions };
    });
  };

  const uploadQuestionMedia = async (
    qi: number,
    field: 'imageUrl' | 'audioUrl',
    file: File | null,
  ) => {
    if (!file || !adminKey) return;
    const key = `${qi}-${field}`;
    setMediaUploading(key);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{ url: string }>('/exams/admin/media', form, {
        headers: { 'x-admin-key': adminKey },
      });
      updateQuestion(qi, field, res.data.url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Upload failed';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setMediaUploading(null);
    }
  };

  const syncGapWordBank = (qi: number, correctBlanks: Record<string, string>, extra: string[]) => {
    const corrects = Object.values(correctBlanks)
      .map((w) => w.trim())
      .filter(Boolean);
    const merged = [...corrects];
    for (const w of extra) {
      const t = w.trim();
      if (t && !merged.some((x) => x.toLowerCase() === t.toLowerCase())) merged.push(t);
    }
    updateQuestion(qi, 'wordBank', merged);
  };

  if (view === 'list') {
    return (
      <div className="admin-page">
        <header
          className="admin-page__header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1>Exams</h1>
            <p className="page-description">Manage exams and questions on the platform.</p>
          </div>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => {
              setEditingExam(emptyExam());
              setView('create');
            }}
          >
            + New exam
          </button>
        </header>

        {success && <div className="admin-alert ok">{success}</div>}
        {error && <div className="admin-alert err">{error}</div>}

        {loading ? (
          <p className="page-description">Loading exams…</p>
        ) : exams.length === 0 ? (
          <div className="admin-card">
            <p className="page-description" style={{ margin: 0 }}>
              No exams yet. Create the first one.
            </p>
          </div>
        ) : (
          exams.map((exam) => (
            <div
              key={exam.id}
              className="admin-card"
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h3 style={{ margin: 0 }}>{exam.title}</h3>
                  <span
                    style={{
                      background: exam.active ? '#d1fae5' : '#fee2e2',
                      color: exam.active ? '#047857' : '#b91c1c',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {exam.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="page-description" style={{ margin: 0 }}>
                  {(() => {
                    const cat = courseLabelById.get(exam.courseId);
                    return cat
                      ? `${cat.courseName} · ${cat.folderPath}`
                      : `Course ID: ${exam.courseId}`;
                  })()}{' '}
                  · {exam.questions?.length ?? 0} questions
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="admin-btn muted"
                  onClick={() => {
                    setEditingExam({
                      ...exam,
                      questions: (exam.questions || []).map(normalizeLoadedQuestion),
                    });
                    setView('edit');
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => void handleDelete(exam.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header
        className="admin-page__header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
      >
        <div>
          <h1>{view === 'create' ? 'New exam' : 'Edit exam'}</h1>
          <p>Multiple choice, true/false, gap-fill, and media URLs.</p>
        </div>
        <button type="button" className="admin-btn muted" onClick={() => setView('list')}>
          ← Back
        </button>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-card">
        <h3>Exam details</h3>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Title</label>
        <input
          className="admin-input"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, minWidth: 0 }}
          value={editingExam.title}
          onChange={(e) => setEditingExam((p: Exam) => ({ ...p, title: e.target.value }))}
          placeholder="E.g.: Unit 1 Exam"
        />
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
        <input
          className="admin-input"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, minWidth: 0 }}
          value={editingExam.description}
          onChange={(e) => setEditingExam((p: Exam) => ({ ...p, description: e.target.value }))}
          placeholder="Instructions for the student"
        />
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Course (catalog)
        </label>
        <p className="page-description" style={{ marginTop: 0, marginBottom: 8 }}>
          Search by course name or folder/program. Students see this exam inside that Moodle
          course.
        </p>
        <div style={{ marginBottom: 12 }}>
          <CatalogCoursePicker
            items={catalogItems}
            valueId={editingExam.courseId || ''}
            onChange={(id) => setEditingExam((p: Exam) => ({ ...p, courseId: id }))}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Max attempts
            </label>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={20}
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={editingExam.maxAttempts ?? 3}
              onChange={(e) =>
                setEditingExam((p: Exam) => ({
                  ...p,
                  maxAttempts: parseInt(e.target.value, 10) || 3,
                }))
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Pass threshold (%)
            </label>
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={editingExam.passThreshold ?? 60}
              onChange={(e) =>
                setEditingExam((p: Exam) => ({
                  ...p,
                  passThreshold: parseInt(e.target.value, 10) || 60,
                }))
              }
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={editingExam.active}
            onChange={(e) => setEditingExam((p: Exam) => ({ ...p, active: e.target.checked }))}
          />
          Exam active (visible to students)
        </label>
      </div>

      <h3 style={{ color: 'var(--primary-color)' }}>Questions ({editingExam.questions.length})</h3>

      {editingExam.questions.map((q: Question, qi: number) => {
        const blanks = extractBlankKeys(q.text || '');
        const distractors = (q.wordBank || []).filter(
          (w) =>
            !Object.values(q.correctBlanks || {})
              .map((x) => x.trim().toLowerCase())
              .includes(w.trim().toLowerCase()),
        );

        return (
          <div key={qi} className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Question {qi + 1}</h4>
              {editingExam.questions.length > 1 && (
                <button type="button" className="admin-btn ghost" onClick={() => removeQuestion(qi)}>
                  Delete
                </button>
              )}
            </div>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Type</label>
            <select
              className="admin-select"
              style={{ width: '100%', marginBottom: 12 }}
              value={q.type || 'multiple_choice'}
              onChange={(e) => setQuestionType(qi, e.target.value as QuestionType)}
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="gap_fill">Gap fill (word bank)</option>
            </select>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              {q.type === 'gap_fill' ? 'Sentence (use {{1}}, {{2}}, …)' : 'Prompt'}
            </label>
            <textarea
              className="admin-input"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 12,
                minHeight: 72,
                fontFamily: 'inherit',
              }}
              value={q.text}
              onChange={(e) => {
                const text = e.target.value;
                setEditingExam((prev: any) => {
                  const questions = [...prev.questions];
                  const cur = { ...questions[qi], text };
                  if (cur.type === 'gap_fill') {
                    const keys = extractBlankKeys(text);
                    const nextBlanks = { ...(cur.correctBlanks || {}) };
                    for (const k of Object.keys(nextBlanks)) {
                      if (!keys.includes(k)) delete nextBlanks[k];
                    }
                    for (const k of keys) {
                      if (nextBlanks[k] == null) nextBlanks[k] = '';
                    }
                    cur.correctBlanks = nextBlanks;
                  }
                  questions[qi] = cur;
                  return { ...prev, questions };
                });
              }}
              placeholder={
                q.type === 'gap_fill'
                  ? 'They {{1}} happy and she {{2}} tall.'
                  : 'Write the question'
              }
            />

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Image (optional)
              </label>
              {q.imageUrl ? (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={resolveExamMediaUrl(q.imageUrl) || ''}
                    alt=""
                    style={{ maxWidth: 240, maxHeight: 140, borderRadius: 8, border: '1px solid #ddd' }}
                  />
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="admin-btn ghost"
                      onClick={() => updateQuestion(qi, 'imageUrl', '')}
                    >
                      Remove image
                    </button>
                  </div>
                </div>
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={mediaUploading === `${qi}-imageUrl`}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.target.value = '';
                  void uploadQuestionMedia(qi, 'imageUrl', f);
                }}
              />
              {mediaUploading === `${qi}-imageUrl` && (
                <span className="page-description"> Uploading…</span>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Audio (optional)
              </label>
              {q.audioUrl ? (
                <div style={{ marginBottom: 8 }}>
                  <audio controls src={resolveExamMediaUrl(q.audioUrl) || ''} style={{ width: '100%' }} />
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="admin-btn ghost"
                      onClick={() => updateQuestion(qi, 'audioUrl', '')}
                    >
                      Remove audio
                    </button>
                  </div>
                </div>
              ) : null}
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
                disabled={mediaUploading === `${qi}-audioUrl`}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.target.value = '';
                  void uploadQuestionMedia(qi, 'audioUrl', f);
                }}
              />
              {mediaUploading === `${qi}-audioUrl` && (
                <span className="page-description"> Uploading…</span>
              )}
            </div>

            {q.type === 'true_false' && (
              <>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  Correct answer
                </label>
                {(q.options || []).map((opt, oi) => (
                  <label
                    key={oi}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                  >
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={opt.isCorrect}
                      onChange={() => updateOption(qi, oi, 'isCorrect', true)}
                    />
                    {opt.text}
                  </label>
                ))}
              </>
            )}

            {q.type === 'multiple_choice' && (
              <>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  Options (mark the correct one)
                </label>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="admin-form-row" style={{ marginBottom: 8 }}>
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={opt.isCorrect}
                      onChange={() => updateOption(qi, oi, 'isCorrect', true)}
                    />
                    <input
                      className="admin-input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={opt.text}
                      onChange={(e) => updateOption(qi, oi, 'text', e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                    />
                  </div>
                ))}
              </>
            )}

            {q.type === 'gap_fill' && (
              <>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  Correct words per blank
                </label>
                {blanks.length === 0 ? (
                  <p className="page-description">Add blanks like {'{{1}}'} in the sentence.</p>
                ) : (
                  blanks.map((key) => (
                    <div key={key} className="admin-form-row" style={{ marginBottom: 8 }}>
                      <span style={{ minWidth: 48, fontWeight: 600 }}>{`{{${key}}}`}</span>
                      <input
                        className="admin-input"
                        style={{ flex: 1 }}
                        value={q.correctBlanks?.[key] || ''}
                        onChange={(e) => {
                          const next = { ...(q.correctBlanks || {}), [key]: e.target.value };
                          updateQuestion(qi, 'correctBlanks', next);
                          syncGapWordBank(qi, next, distractors);
                        }}
                        placeholder="Correct word"
                      />
                    </div>
                  ))
                )}
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, marginTop: 12 }}>
                  Extra words in the box (distractors)
                </label>
                <div className="admin-form-row" style={{ marginBottom: 8 }}>
                  <input
                    className="admin-input"
                    style={{ flex: 1 }}
                    value={distractorDraft[qi] || ''}
                    onChange={(e) =>
                      setDistractorDraft((d) => ({ ...d, [qi]: e.target.value }))
                    }
                    placeholder="e.g. am"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const w = (distractorDraft[qi] || '').trim();
                        if (!w) return;
                        syncGapWordBank(qi, q.correctBlanks || {}, [...distractors, w]);
                        setDistractorDraft((d) => ({ ...d, [qi]: '' }));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn muted"
                    onClick={() => {
                      const w = (distractorDraft[qi] || '').trim();
                      if (!w) return;
                      syncGapWordBank(qi, q.correctBlanks || {}, [...distractors, w]);
                      setDistractorDraft((d) => ({ ...d, [qi]: '' }));
                    }}
                  >
                    Add
                  </button>
                </div>
                <p className="page-description" style={{ margin: 0 }}>
                  Word bank: {(q.wordBank || []).join(', ') || '—'}
                </p>
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="admin-btn muted"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={addQuestion}
      >
        + Add question
      </button>
      <button
        type="button"
        className="admin-btn primary"
        style={{ width: '100%' }}
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : view === 'create' ? 'Create exam' : 'Save changes'}
      </button>
    </div>
  );
};
