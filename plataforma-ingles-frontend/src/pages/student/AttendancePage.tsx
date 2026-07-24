import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import '@/core/ui/ui.css';
import './attendance-page.css';

interface TeacherCourse {
  id: number;
  name: string;
}

interface AttendanceSessionDto {
  id: number;
  moodleCourseId: number;
  sessionDate: string;
  title: string | null;
  status: 'open' | 'closed';
  openedAt: string | null;
  closedAt: string | null;
  courseName?: string;
  alreadyCheckedIn?: boolean;
  checkInCount?: number;
}

interface RosterRow {
  moodleUserId: number;
  fullName: string;
  email: string | null;
  present: boolean;
  checkedInAt: string | null;
}

interface RosterResponse {
  session: AttendanceSessionDto;
  presentCount: number;
  absentCount: number;
  roster: RosterRow[];
}

interface HistoryItem {
  id: number;
  checkedInAt: string;
  courseName: string | null;
  session: AttendanceSessionDto | null;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export const AttendancePage: React.FC = () => {
  const [loadingRole, setLoadingRole] = useState(true);
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([]);
  const [error, setError] = useState('');

  // Teacher state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [todaySession, setTodaySession] = useState<AttendanceSessionDto | null>(null);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [teacherBusy, setTeacherBusy] = useState(false);

  // Student state
  const [openSessions, setOpenSessions] = useState<AttendanceSessionDto[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const isTeacher = teacherCourses.length > 0;

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const loadTeacherCourses = useCallback(async () => {
    const { data } = await api.get<TeacherCourse[]>('/attendance/teacher/courses');
    setTeacherCourses(data);
    setSelectedCourseId((prev) => (prev == null && data.length ? data[0].id : prev));
    return data;
  }, []);

  const loadStudentData = useCallback(async () => {
    const [openRes, histRes] = await Promise.all([
      api.get<AttendanceSessionDto[]>('/attendance/open'),
      api.get<HistoryItem[]>('/attendance/me'),
    ]);
    setOpenSessions(openRes.data);
    setHistory(histRes.data);
  }, []);

  const refreshTeacherSession = useCallback(
    async (courseId: number) => {
      const { data: sessions } = await api.get<AttendanceSessionDto[]>(
        `/attendance/teacher/sessions?courseId=${courseId}`,
      );
      const today =
        sessions.find((s) => String(s.sessionDate).slice(0, 10) === todayStr) || null;
      setTodaySession(today);

      if (today) {
        const { data: rosterData } = await api.get<RosterResponse>(
          `/attendance/sessions/${today.id}`,
        );
        setRoster(rosterData);
      } else {
        setRoster(null);
      }
    },
    [todayStr],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRole(true);
      setError('');
      try {
        const courses = await loadTeacherCourses();
        if (cancelled) return;
        if (!courses.length) {
          await loadStudentData();
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Could not load attendance';
        if (!cancelled) setError(typeof message === 'string' ? message : 'Failed to load');
      } finally {
        if (!cancelled) setLoadingRole(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTeacherCourses, loadStudentData]);

  useEffect(() => {
    if (!isTeacher || selectedCourseId == null) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshTeacherSession(selectedCourseId);
      } catch {
        if (!cancelled) setError('Could not load the course session');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacher, selectedCourseId, refreshTeacherSession]);

  // Poll roster while session is open
  useEffect(() => {
    if (!isTeacher || !todaySession || todaySession.status !== 'open' || !selectedCourseId) {
      return;
    }
    const id = window.setInterval(() => {
      void refreshTeacherSession(selectedCourseId);
    }, 8000);
    return () => window.clearInterval(id);
  }, [isTeacher, todaySession, selectedCourseId, refreshTeacherSession]);

  const handleOpenToday = async () => {
    if (!selectedCourseId) return;
    setTeacherBusy(true);
    setError('');
    try {
      await api.post('/attendance/sessions', {
        moodleCourseId: selectedCourseId,
        sessionDate: todayStr,
        open: true,
      });
      await refreshTeacherSession(selectedCourseId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not open attendance';
      setError(typeof message === 'string' ? message : 'Could not open attendance');
    } finally {
      setTeacherBusy(false);
    }
  };

  const handleCloseToday = async () => {
    if (!todaySession) return;
    setTeacherBusy(true);
    setError('');
    try {
      await api.patch(`/attendance/sessions/${todaySession.id}/close`);
      if (selectedCourseId) await refreshTeacherSession(selectedCourseId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not close attendance';
      setError(typeof message === 'string' ? message : 'Could not close attendance');
    } finally {
      setTeacherBusy(false);
    }
  };

  const handleCheckIn = async (sessionId: number) => {
    setCheckingId(sessionId);
    setError('');
    try {
      await api.post(`/attendance/sessions/${sessionId}/check-in`);
      await loadStudentData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not check in';
      setError(typeof message === 'string' ? message : 'Could not check in');
    } finally {
      setCheckingId(null);
    }
  };

  if (loadingRole) {
    return (
      <div className="attendance-page fade-in-page">
        <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, width: '100%', borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="attendance-page fade-in-page">
      <header className="attendance-header">
        <div>
          <h1>Attendance</h1>
          <p>
            {isTeacher
              ? "Open today's attendance so your students can check in."
              : 'When your teacher opens the class, check in here.'}
          </p>
        </div>
        {isTeacher && (
          <span className="status-pill in-progress">Teacher view</span>
        )}
      </header>

      {error && (
        <div className="attendance-alert" role="alert">
          {error}
        </div>
      )}

      {isTeacher ? (
        <section className="attendance-panel">
          <div className="attendance-toolbar">
            <label className="attendance-select-label">
              Course
              <select
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              >
                {teacherCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="attendance-actions">
              {todaySession?.status === 'open' ? (
                <button
                  type="button"
                  className="btn-card secondary"
                  disabled={teacherBusy}
                  onClick={() => void handleCloseToday()}
                >
                  Close attendance
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-card primary"
                  disabled={teacherBusy || !selectedCourseId}
                  onClick={() => void handleOpenToday()}
                >
                  Open today's attendance
                </button>
              )}
            </div>
          </div>

          <div className="attendance-today-card">
            <div>
              <h2>Today's class</h2>
              <p className="attendance-meta">{todayStr}</p>
            </div>
            {todaySession ? (
              <span
                className={`status-pill ${todaySession.status === 'open' ? 'available' : 'locked'}`}
              >
                {todaySession.status === 'open' ? 'Open' : 'Closed'}
              </span>
            ) : (
              <span className="status-pill locked">No session</span>
            )}
          </div>

          {roster ? (
            <>
              <div className="attendance-stats">
                <div>
                  <strong>{roster.presentCount}</strong>
                  <span>Present</span>
                </div>
                <div>
                  <strong>{roster.absentCount}</strong>
                  <span>Absent</span>
                </div>
              </div>
              <ul className="attendance-roster">
                {roster.roster.map((row) => (
                  <li key={row.moodleUserId} className={row.present ? 'present' : 'absent'}>
                    <div>
                      <strong>{row.fullName}</strong>
                      {row.email && <small>{row.email}</small>}
                    </div>
                    <div className="roster-status">
                      {row.present ? (
                        <>
                          <span className="success-badge">Present</span>
                          <small>{formatTime(row.checkedInAt)}</small>
                        </>
                      ) : (
                        <span className="status-pill locked">Absent</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="No session for today yet"
              description={"Tap \"Open today's attendance\" so students can check in."}
            />
          )}
        </section>
      ) : (
        <section className="attendance-panel">
          <h2 className="attendance-section-title">Open sessions</h2>
          {openSessions.length === 0 ? (
            <EmptyState
              title="No open attendance"
              description="When your teacher opens the class, the check-in button will appear here."
            />
          ) : (
            <ul className="attendance-open-list">
              {openSessions.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.courseName || `Course ${s.moodleCourseId}`}</strong>
                    <p>
                      {s.title || 'Class'} · {String(s.sessionDate).slice(0, 10)}
                    </p>
                  </div>
                  {s.alreadyCheckedIn ? (
                    <span className="success-badge">Already checked in</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-success"
                      disabled={checkingId === s.id}
                      onClick={() => void handleCheckIn(s.id)}
                    >
                      {checkingId === s.id ? 'Checking in…' : 'Check in'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="attendance-section-title" style={{ marginTop: 32 }}>
            Your history
          </h2>
          {history.length === 0 ? (
            <p className="attendance-meta">You haven&apos;t checked in yet.</p>
          ) : (
            <ul className="attendance-history">
              {history.map((h) => (
                <li key={h.id}>
                  <strong>{h.courseName || 'Course'}</strong>
                  <span>
                    {h.session ? String(h.session.sessionDate).slice(0, 10) : '—'} ·{' '}
                    {formatTime(h.checkedInAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
