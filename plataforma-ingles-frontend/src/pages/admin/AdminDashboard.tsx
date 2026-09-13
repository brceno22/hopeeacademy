import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/auth';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import { ExamEditor } from './ExamEditor';
import { ExamList } from './ExamList';
import { QuestionEditor } from './QuestionEditor';
import {
  emptyExam,
  emptyQuestion,
  extractBlankKeys,
  type Exam,
  type ExamDraft,
  type Option,
  type Question,
  type QuestionType,
} from './adminExams';
import { flattenCatalogCourses, type CatalogCourseItem } from './catalogCourses';
import './admin.css';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingExam, setEditingExam] = useState<ExamDraft>(emptyExam());
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

  const fetchExams = async () => {
    try {
      const res = await api.get('/exams');
      setExams(res.data);
    } catch {
      setError('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get('/exams');
        if (!cancelled) setExams(res.data);
      } catch {
        if (!cancelled) setError('Failed to load exams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void (async () => {
      try {
        const treeRes = await api.get<CourseFolderNode[]>('/courses/admin/tree');
        if (!cancelled) setCatalogItems(flattenCatalogCourses(treeRes.data || []));
      } catch {
        if (!cancelled) setCatalogItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, navigate]);

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
        await api.put(`/exams/${editingExam.id}`, payload);
        setSuccess('Exam updated successfully');
      } else {
        await api.post('/exams', payload);
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
      await api.delete(`/exams/${id}`);
      setSuccess('Exam deleted');
      await fetchExams();
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to delete');
    }
  };

  const addQuestion = () => {
    setEditingExam((prev) => ({
      ...prev,
      questions: [...prev.questions, emptyQuestion(prev.questions.length + 1)],
    }));
  };

  const removeQuestion = (qi: number) => {
    setEditingExam((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== qi),
    }));
  };

  const updateQuestion = (qi: number, field: keyof Question, value: Question[keyof Question]) => {
    setEditingExam((prev) => {
      const questions = [...prev.questions];
      questions[qi] = { ...questions[qi], [field]: value };
      return { ...prev, questions };
    });
  };

  const setQuestionType = (qi: number, type: QuestionType) => {
    setEditingExam((prev) => {
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
        current.options = current.options?.length >= 2 ? current.options : emptyQuestion().options;
      }
      questions[qi] = current;
      return { ...prev, questions };
    });
  };

  const updateOption = (qi: number, oi: number, field: keyof Option, value: Option[keyof Option]) => {
    setEditingExam((prev) => {
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
    if (!file || !isAdmin) return;
    const key = `${qi}-${field}`;
    setMediaUploading(key);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{ url: string }>('/exams/admin/media', form);
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

  const changeQuestionText = (qi: number, text: string) => {
    setEditingExam((prev) => {
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
  };

  if (view === 'list') {
    return (
      <ExamList
        exams={exams}
        loading={loading}
        success={success}
        error={error}
        courseLabelById={courseLabelById}
        onNew={() => {
          setEditingExam(emptyExam());
          setView('create');
        }}
        onEdit={(exam) => {
          setEditingExam(exam);
          setView('edit');
        }}
        onDelete={(id) => void handleDelete(id)}
      />
    );
  }

  return (
    <ExamEditor
      view={view}
      editingExam={editingExam}
      setEditingExam={setEditingExam}
      catalogItems={catalogItems}
      success={success}
      error={error}
      saving={saving}
      onBack={() => setView('list')}
      onSave={() => void handleSave()}
    >
      <h3 style={{ color: 'var(--primary-color)' }}>Questions ({editingExam.questions.length})</h3>
      {editingExam.questions.map((q, qi) => (
        <QuestionEditor
          key={qi}
          q={q}
          qi={qi}
          questionsCount={editingExam.questions.length}
          distractorDraft={distractorDraft}
          setDistractorDraft={setDistractorDraft}
          mediaUploading={mediaUploading}
          onRemove={removeQuestion}
          onUpdateQuestion={updateQuestion}
          onSetQuestionType={setQuestionType}
          onUpdateOption={updateOption}
          onUploadMedia={(i, field, file) => void uploadQuestionMedia(i, field, file)}
          onChangeText={changeQuestionText}
          onSyncGapWordBank={syncGapWordBank}
        />
      ))}
      <button
        type="button"
        className="admin-btn muted"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={addQuestion}
      >
        + Add question
      </button>
    </ExamEditor>
  );
};
