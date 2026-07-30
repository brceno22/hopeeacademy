import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import { useStudentLayout } from '@/layouts/StudentLayoutContext';
import '@/core/ui/ui.css';
import './exams-page.css';

type ExamStatus = 'pending' | 'passed' | 'failed' | 'exhausted';

interface MyExam {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  description: string | null;
  maxAttempts: number;
  passThreshold: number;
  attemptsUsed: number;
  bestScore: number | null;
  status: ExamStatus;
}

interface TeacherShift {
  id: number;
  name: string;
  folderId: number;
  folderName: string | null;
}

interface GradeCell {
  examId: number;
  attemptsUsed: number;
  bestScore: number | null;
  lastScore: number | null;
  lastFinishedAt: string | null;
  status: ExamStatus;
}

interface Gradebook {
  shift: {
    id: number;
    name: string;
    folderId: number;
    folderName: string | null;
  };
  exams: Array<{
    id: number;
    courseId: number;
    courseName: string;
    title: string;
    maxAttempts: number;
    passThreshold: number;
  }>;
  students: Array<{
    moodleUserId: number;
    fullName: string;
    email: string | null;
    results: GradeCell[];
  }>;
}

const STATUS_LABEL: Record<ExamStatus, string> = {
  pending: 'Pending',
  failed: 'Retry available',
  exhausted: 'No attempts left',
  passed: 'Passed',
};

function cellLabel(cell: GradeCell | undefined): string {
  if (!cell || cell.status === 'pending') return '—';
  if (cell.bestScore == null) return '—';
  return `${cell.bestScore}%`;
}

export const ExamsPage: React.FC = () => {
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shiftIdFromQuery = searchParams.get('shiftId');

  const [loadingRole, setLoadingRole] = useState(true);
  const [teacherShifts, setTeacherShifts] = useState<TeacherShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [gradesLoading, setGradesLoading] = useState(false);

  const [exams, setExams] = useState<MyExam[]>([]);
  const [error, setError] = useState('');

  const isTeacher = teacherShifts.length > 0;

  useEffect(() => {
    setHeaderTitle('Exams');
    clearHeaderTabs();
  }, [setHeaderTitle, clearHeaderTabs]);

  const loadTeacherShifts = useCallback(async () => {
    const { data } = await api.get<TeacherShift[]>('/exams/teacher/shifts');
    const list = Array.isArray(data) ? data : [];
    setTeacherShifts(list);
    const fromQuery = shiftIdFromQuery ? Number(shiftIdFromQuery) : NaN;
    setSelectedShiftId((prev) => {
      if (Number.isFinite(fromQuery) && list.some((s) => s.id === fromQuery)) {
        return fromQuery;
      }
      if (prev != null && list.some((s) => s.id === prev)) return prev;
      return list.length ? list[0].id : null;
    });
    return list;
  }, [shiftIdFromQuery]);

  const loadStudentExams = useCallback(async () => {
    const { data } = await api.get<MyExam[]>('/exams/mine');
    setExams(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRole(true);
      setError('');
      try {
        const shifts = await loadTeacherShifts();
        if (cancelled) return;
        if (!shifts.length) {
          await loadStudentExams();
        }
      } catch {
        try {
          if (!cancelled) await loadStudentExams();
        } catch {
          if (!cancelled) setError('Could not load exams.');
        }
      } finally {
        if (!cancelled) setLoadingRole(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTeacherShifts, loadStudentExams]);

  useEffect(() => {
    const fromQuery = shiftIdFromQuery ? Number(shiftIdFromQuery) : NaN;
    if (!Number.isFinite(fromQuery)) return;
    if (teacherShifts.some((s) => s.id === fromQuery)) {
      setSelectedShiftId(fromQuery);
    }
  }, [shiftIdFromQuery, teacherShifts]);

  useEffect(() => {
    if (!isTeacher || selectedShiftId == null) return;
    let cancelled = false;
    (async () => {
      setGradesLoading(true);
      setError('');
      try {
        const { data } = await api.get<Gradebook>(
          `/exams/teacher/shifts/${selectedShiftId}/grades`,
        );
        if (!cancelled) setGradebook(data);
      } catch {
        if (!cancelled) {
          setGradebook(null);
          setError('Could not load gradebook for this classroom.');
        }
      } finally {
        if (!cancelled) setGradesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacher, selectedShiftId]);

  const selectedShift = useMemo(
    () => teacherShifts.find((s) => s.id === selectedShiftId) || null,
    [teacherShifts, selectedShiftId],
  );

  if (loadingRole) {
    return <p className="page-description">Loading exams…</p>;
  }

  if (isTeacher) {
    return (
      <div className="exams-page fade-in-page">
        <p className="page-description">
          Exam scores for students in your classroom
          {selectedShift?.folderName ? ` (${selectedShift.folderName})` : ''}.
        </p>

        {error ? (
          <div className="home-card" style={{ marginBottom: 12 }}>
            <p style={{ color: '#c62828', margin: 0 }}>{error}</p>
          </div>
        ) : null}

        <div className="exams-toolbar">
          <label className="exams-select-label">
            Classroom
            <select
              value={selectedShiftId ?? ''}
              onChange={(e) => setSelectedShiftId(Number(e.target.value))}
            >
              {teacherShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.folderName ? ` — ${s.folderName}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {gradesLoading ? (
          <p className="page-description">Loading grades…</p>
        ) : !gradebook ? null : gradebook.students.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No students in this classroom"
            description="Ask an admin to enroll students in this aula."
          />
        ) : gradebook.exams.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No exams for this program"
            description="Create an exam linked to a course in this folder tree."
          />
        ) : (
          <div className="exams-gradebook-wrap">
            <table className="exams-gradebook">
              <thead>
                <tr>
                  <th className="exams-gradebook__student">Student</th>
                  {gradebook.exams.map((exam) => (
                    <th key={exam.id} title={`${exam.courseName} · pass ${exam.passThreshold}%`}>
                      <span className="exams-gradebook__exam-title">{exam.title}</span>
                      <span className="exams-gradebook__exam-sub">{exam.courseName}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradebook.students.map((student) => (
                  <tr key={student.moodleUserId}>
                    <td className="exams-gradebook__student">
                      <strong>{student.fullName}</strong>
                      {student.email ? (
                        <span className="exams-gradebook__email">{student.email}</span>
                      ) : null}
                    </td>
                    {gradebook.exams.map((exam) => {
                      const cell = student.results.find((r) => r.examId === exam.id);
                      return (
                        <td
                          key={exam.id}
                          className={`exams-gradebook__cell exams-gradebook__cell--${cell?.status || 'pending'}`}
                          title={
                            cell
                              ? `${STATUS_LABEL[cell.status]} · ${cell.attemptsUsed}/${exam.maxAttempts} attempts`
                              : 'Pending'
                          }
                        >
                          {cellLabel(cell)}
                          {cell && cell.attemptsUsed > 0 ? (
                            <span className="exams-gradebook__attempts">
                              {cell.attemptsUsed}/{exam.maxAttempts}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-card">
        <p style={{ color: '#c62828', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="No exams yet"
        description="When your courses have platform exams, they will show up here."
        actionLabel="Go to My courses"
        onAction={() => navigate('/app/cursos')}
      />
    );
  }

  const pendingCount = exams.filter((e) => e.status === 'pending' || e.status === 'failed').length;

  return (
    <div className="exams-page fade-in-page">
      <p className="page-description">
        {pendingCount > 0
          ? `${pendingCount} exam${pendingCount === 1 ? '' : 's'} waiting for you.`
          : 'All caught up — no pending exams.'}
      </p>

      <ul className="exams-list">
        {exams.map((exam) => {
          const canTake = exam.status === 'pending' || exam.status === 'failed';
          return (
            <li key={exam.id} className={`exams-card exams-card--${exam.status}`}>
              <div className="exams-card__main">
                <span className={`exams-status exams-status--${exam.status}`}>
                  {STATUS_LABEL[exam.status]}
                </span>
                <h3 className="exams-card__title">{exam.title}</h3>
                <p className="exams-card__course">
                  <Link to={`/app/cursos/${exam.courseId}`}>{exam.courseName}</Link>
                </p>
                {exam.description ? (
                  <p className="exams-card__desc">{exam.description}</p>
                ) : null}
                <p className="exams-card__meta">
                  Attempts {exam.attemptsUsed}/{exam.maxAttempts}
                  {exam.bestScore != null ? ` · Best ${exam.bestScore}%` : ''}
                  {` · Pass at ${exam.passThreshold}%`}
                </p>
              </div>
              <div className="exams-card__actions">
                {canTake ? (
                  <Link className="exams-btn exams-btn--primary" to={`/app/examenes/${exam.id}/take`}>
                    {exam.attemptsUsed > 0 ? 'Retry' : 'Start'}
                  </Link>
                ) : (
                  <Link className="exams-btn" to={`/app/examenes/${exam.id}/take`}>
                    View
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
