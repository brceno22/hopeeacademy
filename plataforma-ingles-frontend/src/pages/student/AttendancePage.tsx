import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import '@/core/ui/ui.css';
import './attendance-page.css';

interface TeacherShift {
  id: number;
  name: string;
  folderId: number;
  folderName: string | null;
  meetUrl: string | null;
  startTime: string;
  endTime: string;
}

interface AttendanceSessionDto {
  id: number;
  shiftId: number;
  sessionDate: string;
  title: string | null;
  status: 'open' | 'closed';
  openedAt: string | null;
  closedAt: string | null;
  checkInCount?: number;
}

interface RosterRow {
  moodleUserId: number;
  fullName: string;
  email: string | null;
  status: 'present' | 'absent' | null;
  present: boolean;
  checkedInAt: string | null;
  markedByUserId: number | null;
}

interface RosterResponse {
  session: AttendanceSessionDto;
  shift: {
    id: number;
    name: string;
    folderName: string | null;
    meetUrl: string | null;
    startTime: string;
    endTime: string;
  } | null;
  presentCount: number;
  absentCount: number;
  roster: RosterRow[];
}

interface HistoryItem {
  id: number;
  status: 'present' | 'absent';
  present: boolean;
  checkedInAt: string | null;
  shiftName: string | null;
  folderName: string | null;
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
  const [searchParams] = useSearchParams();
  const shiftIdFromQuery = searchParams.get('shiftId');

  const [loadingRole, setLoadingRole] = useState(true);
  const [teacherShifts, setTeacherShifts] = useState<TeacherShift[]>([]);
  const [error, setError] = useState('');

  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [todaySession, setTodaySession] = useState<AttendanceSessionDto | null>(null);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [teacherBusy, setTeacherBusy] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const isTeacher = teacherShifts.length > 0;
  const canMark = todaySession?.status === 'open';

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const selectedShift = useMemo(
    () => teacherShifts.find((s) => s.id === selectedShiftId) || null,
    [teacherShifts, selectedShiftId],
  );

  const loadTeacherShifts = useCallback(async () => {
    const { data } = await api.get<TeacherShift[]>('/attendance/teacher/shifts');
    setTeacherShifts(data);
    const fromQuery = shiftIdFromQuery ? Number(shiftIdFromQuery) : NaN;
    setSelectedShiftId((prev) => {
      if (Number.isFinite(fromQuery) && data.some((s) => s.id === fromQuery)) {
        return fromQuery;
      }
      if (prev != null && data.some((s) => s.id === prev)) return prev;
      return data.length ? data[0].id : null;
    });
    return data;
  }, [shiftIdFromQuery]);

  useEffect(() => {
    const fromQuery = shiftIdFromQuery ? Number(shiftIdFromQuery) : NaN;
    if (!Number.isFinite(fromQuery)) return;
    if (teacherShifts.some((s) => s.id === fromQuery)) {
      setSelectedShiftId(fromQuery);
    }
  }, [shiftIdFromQuery, teacherShifts]);

  const loadStudentHistory = useCallback(async () => {
    const { data } = await api.get<HistoryItem[]>('/attendance/me');
    setHistory(data);
  }, []);

  const refreshTeacherSession = useCallback(
    async (shiftId: number) => {
      const { data: sessions } = await api.get<AttendanceSessionDto[]>(
        `/attendance/teacher/sessions?shiftId=${shiftId}`,
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
        const shifts = await loadTeacherShifts();
        if (cancelled) return;
        if (!shifts.length) {
          await loadStudentHistory();
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
  }, [loadTeacherShifts, loadStudentHistory]);

  useEffect(() => {
    if (!isTeacher || selectedShiftId == null) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshTeacherSession(selectedShiftId);
      } catch {
        if (!cancelled) setError('Could not load the classroom session');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacher, selectedShiftId, refreshTeacherSession]);

  const handleOpenToday = async () => {
    if (!selectedShiftId) return;
    setTeacherBusy(true);
    setError('');
    try {
      await api.post('/attendance/sessions', {
        shiftId: selectedShiftId,
        sessionDate: todayStr,
        open: true,
      });
      await refreshTeacherSession(selectedShiftId);
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
      if (selectedShiftId) await refreshTeacherSession(selectedShiftId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not close attendance';
      setError(typeof message === 'string' ? message : 'Could not close attendance');
    } finally {
      setTeacherBusy(false);
    }
  };

  const handleTogglePresent = async (moodleUserId: number, present: boolean) => {
    if (!todaySession || todaySession.status !== 'open') return;
    setMarkingId(moodleUserId);
    setError('');
    try {
      const { data } = await api.patch<RosterResponse>(
        `/attendance/sessions/${todaySession.id}/roster/${moodleUserId}`,
        { present },
      );
      setRoster(data);
      setTodaySession(data.session);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not update attendance';
      setError(typeof message === 'string' ? message : 'Could not update attendance');
    } finally {
      setMarkingId(null);
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
              ? 'Open attendance, take roll, then close to lock present/absent.'
              : 'Your attendance history: present or absent by class and date.'}
          </p>
        </div>
        {isTeacher && <span className="status-pill in-progress">Teacher view</span>}
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
              Classroom
              <select
                value={selectedShiftId ?? ''}
                onChange={(e) => setSelectedShiftId(Number(e.target.value))}
              >
                {teacherShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.folderName ? `${s.folderName} — ${s.name}` : s.name}
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
                  disabled={teacherBusy || !selectedShiftId}
                  onClick={() => void handleOpenToday()}
                >
                  Open today&apos;s attendance
                </button>
              )}
            </div>
          </div>

          {selectedShift && (
            <p className="attendance-meta">
              {selectedShift.startTime}–{selectedShift.endTime}
              {selectedShift.meetUrl ? (
                <>
                  {' · '}
                  <a href={selectedShift.meetUrl} target="_blank" rel="noreferrer">
                    Meet link
                  </a>
                </>
              ) : null}
            </p>
          )}

          <div className="attendance-today-card">
            <div>
              <h2>Today&apos;s class</h2>
              <p className="attendance-meta">{todayStr}</p>
            </div>
            {todaySession ? (
              <span
                className={`status-pill ${todaySession.status === 'open' ? 'available' : 'locked'}`}
              >
                {todaySession.status === 'open' ? 'Open — marking enabled' : 'Closed — locked'}
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
                  <span>Absent / unmarked</span>
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
                      {canMark ? (
                        <button
                          type="button"
                          className={row.present ? 'btn-success' : 'btn-card secondary'}
                          disabled={markingId === row.moodleUserId}
                          onClick={() => void handleTogglePresent(row.moodleUserId, !row.present)}
                        >
                          {markingId === row.moodleUserId
                            ? '…'
                            : row.present
                              ? 'Present'
                              : 'Mark present'}
                        </button>
                      ) : (
                        <span className={row.present ? 'success-badge' : 'status-pill locked'}>
                          {row.present ? 'Present' : 'Absent'}
                        </span>
                      )}
                      {row.present && row.checkedInAt && (
                        <small>{formatTime(row.checkedInAt)}</small>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {roster.roster.length === 0 && (
                <EmptyState
                  title="No students in this classroom"
                  description="Ask an admin to assign students to this shift."
                />
              )}
            </>
          ) : (
            <EmptyState
              title="No session for today yet"
              description={'Tap "Open today\'s attendance" to load the student list.'}
            />
          )}
        </section>
      ) : (
        <section className="attendance-panel">
          <h2 className="attendance-section-title">Your history</h2>
          {history.length === 0 ? (
            <EmptyState
              title="No attendance yet"
              description="After your teacher closes a class, present and absent records appear here."
            />
          ) : (
            <ul className="attendance-history">
              {history.map((h) => (
                <li key={`${h.session?.id ?? h.id}-${h.status}`}>
                  <div>
                    <strong>
                      {h.folderName && h.shiftName
                        ? `${h.folderName} — ${h.shiftName}`
                        : h.shiftName || 'Class'}
                    </strong>
                    <span>
                      {h.session ? String(h.session.sessionDate).slice(0, 10) : '—'}
                    </span>
                  </div>
                  <span className={h.present ? 'success-badge' : 'status-pill locked'}>
                    {h.present ? 'Present' : 'Absent'}
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
