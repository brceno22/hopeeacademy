import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import './admin.css';

interface Option {
  id?: number;
  text: string;
  isCorrect: boolean;
}
interface Question {
  id?: number;
  text: string;
  order: number;
  options: Option[];
}
interface Exam {
  id: number;
  courseId: number;
  title: string;
  description: string;
  active: boolean;
  questions: Question[];
}

const emptyQuestion = (): Question => ({
  text: '',
  order: 1,
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
  questions: [emptyQuestion()],
});

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

  useEffect(() => {
    if (!adminKey) {
      navigate('/admin');
      return;
    }
    void fetchExams();
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
    setSaving(true);
    setError('');
    try {
      if (view === 'edit' && editingExam.id) {
        await api.put(`/exams/${editingExam.id}`, editingExam, {
          headers: { 'x-admin-key': adminKey },
        });
        setSuccess('Exam updated successfully');
      } else {
        await api.post('/exams', editingExam, { headers: { 'x-admin-key': adminKey } });
        setSuccess('Exam created successfully');
      }
      await fetchExams();
      setTimeout(() => {
        setSuccess('');
        setView('list');
      }, 1500);
    } catch {
      setError('Failed to save exam');
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
      questions: [...prev.questions, { ...emptyQuestion(), order: prev.questions.length + 1 }],
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
            <p>Create and edit platform assessments.</p>
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
                      background: exam.active
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: exam.active ? '#047857' : '#b91c1c',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {exam.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="page-description" style={{ margin: 0 }}>
                  Course ID: {exam.courseId} · {exam.questions?.length ?? 0} questions
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="admin-btn accent"
                  onClick={() => {
                    setEditingExam(exam);
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
          <p>Basic details and multiple-choice questions.</p>
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
          Course ID (Moodle)
        </label>
        <input
          className="admin-input"
          type="number"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, minWidth: 0 }}
          value={editingExam.courseId}
          onChange={(e) =>
            setEditingExam((p: Exam) => ({ ...p, courseId: parseInt(e.target.value, 10) || 0 }))
          }
        />
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

      {editingExam.questions.map((q: Question, qi: number) => (
        <div key={qi} className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Question {qi + 1}</h4>
            {editingExam.questions.length > 1 && (
              <button type="button" className="admin-btn ghost" onClick={() => removeQuestion(qi)}>
                Delete
              </button>
            )}
          </div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Prompt</label>
          <input
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, minWidth: 0 }}
            value={q.text}
            onChange={(e) => updateQuestion(qi, 'text', e.target.value)}
            placeholder="Write the question"
          />
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
        </div>
      ))}

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
