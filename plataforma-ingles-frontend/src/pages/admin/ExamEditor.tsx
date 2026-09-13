import React from 'react';
import type { CatalogCourseItem } from './catalogCourses';
import { CatalogCoursePicker } from './CatalogCoursePicker';
import type { ExamDraft } from './adminExams';

interface ExamEditorProps {
  view: 'create' | 'edit';
  editingExam: ExamDraft;
  setEditingExam: React.Dispatch<React.SetStateAction<ExamDraft>>;
  catalogItems: CatalogCourseItem[];
  success: string;
  error: string;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export const ExamEditor: React.FC<ExamEditorProps> = ({
  view,
  editingExam,
  setEditingExam,
  catalogItems,
  success,
  error,
  saving,
  onBack,
  onSave,
  children,
}) => (
  <div className="admin-page">
    <header
      className="admin-page__header"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
    >
      <div>
        <h1>{view === 'create' ? 'New exam' : 'Edit exam'}</h1>
        <p>Multiple choice, true/false, gap-fill, and media URLs.</p>
      </div>
      <button type="button" className="admin-btn muted" onClick={onBack}>
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
        onChange={(e) => setEditingExam((p) => ({ ...p, title: e.target.value }))}
        placeholder="E.g.: Unit 1 Exam"
      />
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
      <input
        className="admin-input"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, minWidth: 0 }}
        value={editingExam.description}
        onChange={(e) => setEditingExam((p) => ({ ...p, description: e.target.value }))}
        placeholder="Instructions for the student"
      />
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        Course (catalog)
      </label>
      <p className="page-description" style={{ marginTop: 0, marginBottom: 8 }}>
        Search by course name or folder/program. Students see this exam inside that Moodle course.
      </p>
      <div style={{ marginBottom: 12 }}>
        <CatalogCoursePicker
          items={catalogItems}
          valueId={editingExam.courseId || ''}
          onChange={(id) => setEditingExam((p) => ({ ...p, courseId: id }))}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Max attempts</label>
          <input
            className="admin-input"
            type="number"
            min={1}
            max={20}
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={editingExam.maxAttempts ?? 3}
            onChange={(e) =>
              setEditingExam((p) => ({
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
              setEditingExam((p) => ({
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
          onChange={(e) => setEditingExam((p) => ({ ...p, active: e.target.checked }))}
        />
        Exam active (visible to students)
      </label>
    </div>

    {children}

    <button
      type="button"
      className="admin-btn primary"
      style={{ width: '100%' }}
      disabled={saving}
      onClick={onSave}
    >
      {saving ? 'Saving…' : view === 'create' ? 'Create exam' : 'Save changes'}
    </button>
  </div>
);
