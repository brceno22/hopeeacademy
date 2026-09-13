import React from 'react';
import type { CourseLabelMap, Exam } from './adminExams';
import { normalizeLoadedQuestion, type ExamDraft } from './adminExams';

interface ExamListProps {
  exams: Exam[];
  loading: boolean;
  success: string;
  error: string;
  courseLabelById: CourseLabelMap;
  onNew: () => void;
  onEdit: (exam: ExamDraft) => void;
  onDelete: (id: number) => void;
}

export const ExamList: React.FC<ExamListProps> = ({
  exams,
  loading,
  success,
  error,
  courseLabelById,
  onNew,
  onEdit,
  onDelete,
}) => (
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
      <button type="button" className="admin-btn primary" onClick={onNew}>
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
                onEdit({
                  ...exam,
                  questions: (exam.questions || []).map(normalizeLoadedQuestion),
                });
              }}
            >
              Edit
            </button>
            <button type="button" className="admin-btn danger" onClick={() => onDelete(exam.id)}>
              Delete
            </button>
          </div>
        </div>
      ))
    )}
  </div>
);
