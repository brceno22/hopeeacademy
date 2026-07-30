import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import './admin.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SEARCH_DEBOUNCE_MS = 300;

interface Shift {
  id: number;
  name: string;
  folderId: number;
  folderName: string | null;
  moodleCourseId: number | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  title: string;
  description: string | null;
  meetUrl: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

interface Enrollment {
  id: number;
  shiftId: number;
  moodleUserId: number;
  fullName?: string;
  email?: string | null;
  username?: string | null;
}

interface UserSuggestion {
  moodleUserId: number;
  fullname: string;
  email: string;
  username: string;
}

interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  meetUrl: string | null;
  startsAt: string;
  endsAt: string;
  shiftId: number;
  shiftName: string | null;
  isActive: boolean;
}

function flatFolders(nodes: CourseFolderNode[], depth = 0): { node: CourseFolderNode; depth: number }[] {
  const out: { node: CourseFolderNode; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    out.push(...flatFolders(n.children ?? [], depth + 1));
  }
  return out;
}

export const AdminCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { adminKey } = useAuth();
  const headers = { 'x-admin-key': adminKey || '' };

  const [tab, setTab] = useState<'shifts' | 'enroll' | 'teachers' | 'events'>('shifts');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const [folders, setFolders] = useState<CourseFolderNode[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);

  const [shiftForm, setShiftForm] = useState({
    name: '',
    folderId: '',
    moodleCourseId: '',
    daysOfWeek: [1, 2, 3, 4] as number[],
    startTime: '18:00',
    endTime: '20:00',
    title: 'Hopee class — Meet',
    description: '',
    meetUrl: '',
    validFrom: '',
    validTo: '',
  });

  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [teachers, setTeachers] = useState<Enrollment[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<UserSuggestion[]>([]);
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearching, setStudentSearching] = useState(false);
  const [teacherSearchUser, setTeacherSearchUser] = useState('');
  const [teacherSuggestions, setTeacherSuggestions] = useState<UserSuggestion[]>([]);
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);
  const teacherSearchRef = useRef<HTMLDivElement>(null);

  const [eventForm, setEventForm] = useState({
    shiftId: '',
    title: '',
    meetUrl: '',
    startsAt: '',
    endsAt: '',
  });

  const allFlat = useMemo(() => flatFolders(folders), [folders]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [treeRes, shiftsRes, eventsRes] = await Promise.all([
        api.get('/courses/admin/tree', { headers }),
        api.get('/calendar/admin/shifts', { headers }),
        api.get('/calendar/admin/events', { headers }),
      ]);
      setFolders(treeRes.data);
      setShifts(shiftsRes.data);
      setEvents(eventsRes.data);
      if (!selectedShiftId && shiftsRes.data.length) {
        setSelectedShiftId(shiftsRes.data[0].id);
      }
    } catch {
      setError('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminKey) navigate('/admin');
    else void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  useEffect(() => {
    if (!selectedShiftId || !adminKey) return;
    void (async () => {
      try {
        const [enrollRes, teacherRes] = await Promise.all([
          api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`, { headers }),
          api.get(`/calendar/admin/shifts/${selectedShiftId}/teachers`, { headers }),
        ]);
        setEnrollments(enrollRes.data);
        setTeachers(teacherRes.data);
      } catch {
        setEnrollments([]);
        setTeachers([]);
      }
    })();
  }, [selectedShiftId, adminKey]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (studentSearchRef.current && !studentSearchRef.current.contains(t)) {
        setStudentSearchOpen(false);
      }
      if (teacherSearchRef.current && !teacherSearchRef.current.contains(t)) {
        setTeacherSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!adminKey || searchUser.trim().length < 2) {
      setStudentSuggestions([]);
      setStudentSearching(false);
      return;
    }
    let cancelled = false;
    setStudentSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<UserSuggestion[]>('/users/search', {
            params: { q: searchUser.trim() },
            headers,
          });
          if (!cancelled) {
            setStudentSuggestions(res.data);
            setStudentSearchOpen(true);
          }
        } catch {
          if (!cancelled) setStudentSuggestions([]);
        } finally {
          if (!cancelled) setStudentSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchUser, adminKey]);

  useEffect(() => {
    if (!adminKey || teacherSearchUser.trim().length < 2) {
      setTeacherSuggestions([]);
      setTeacherSearching(false);
      return;
    }
    let cancelled = false;
    setTeacherSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<UserSuggestion[]>('/users/search', {
            params: { q: teacherSearchUser.trim() },
            headers,
          });
          if (!cancelled) {
            setTeacherSuggestions(res.data);
            setTeacherSearchOpen(true);
          }
        } catch {
          if (!cancelled) setTeacherSuggestions([]);
        } finally {
          if (!cancelled) setTeacherSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [teacherSearchUser, adminKey]);

  const toggleDay = (d: number) => {
    setShiftForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(d)
        ? prev.daysOfWeek.filter((x) => x !== d)
        : [...prev.daysOfWeek, d].sort(),
    }));
  };

  const createShift = async () => {
    if (!shiftForm.name || !shiftForm.folderId || !shiftForm.daysOfWeek.length) {
      setError('Fill in name, folder, and at least one day');
      return;
    }
    if (shiftForm.validFrom && shiftForm.validTo && shiftForm.validFrom > shiftForm.validTo) {
      setError('Start date must be on or before end date');
      return;
    }
    try {
      await api.post(
        '/calendar/admin/shifts',
        {
          name: shiftForm.name,
          folderId: Number(shiftForm.folderId),
          moodleCourseId: shiftForm.moodleCourseId
            ? Number(shiftForm.moodleCourseId)
            : null,
          daysOfWeek: shiftForm.daysOfWeek,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          title: shiftForm.title,
          description: shiftForm.description || undefined,
          meetUrl: shiftForm.meetUrl || undefined,
          validFrom: shiftForm.validFrom || undefined,
          validTo: shiftForm.validTo || undefined,
        },
        { headers },
      );
      setSuccess('Shift created');
      setShiftForm((f) => ({ ...f, name: '', validFrom: '', validTo: '' }));
      await load();
    } catch {
      setError('Could not create shift');
    }
  };

  const deleteShift = async (id: number) => {
    if (!confirm('Delete shift and its enrollments/events?')) return;
    try {
      await api.delete(`/calendar/admin/shifts/${id}`, { headers });
      setSuccess('Shift deleted');
      if (selectedShiftId === id) setSelectedShiftId(null);
      await load();
    } catch {
      setError('Could not delete');
    }
  };

  const enrollUser = async (user: UserSuggestion) => {
    if (!selectedShiftId) return;
    setError('');
    try {
      await api.post(
        `/calendar/admin/shifts/${selectedShiftId}/enrollments`,
        { moodleUserId: user.moodleUserId },
        { headers },
      );
      setSuccess(`Assigned: ${user.fullname}`);
      setSearchUser('');
      setStudentSuggestions([]);
      setStudentSearchOpen(false);
      const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`, {
        headers,
      });
      setEnrollments(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not assign';
      setError(typeof message === 'string' ? message : 'Could not assign');
    }
  };

  const unenroll = async (moodleUserId: number) => {
    if (!selectedShiftId) return;
    try {
      await api.delete(
        `/calendar/admin/shifts/${selectedShiftId}/enrollments/${moodleUserId}`,
        { headers },
      );
      setEnrollments((prev) => prev.filter((e) => e.moodleUserId !== moodleUserId));
      setSuccess('Student removed');
    } catch {
      setError('Could not remove');
    }
  };

  const assignTeacher = async (user: UserSuggestion) => {
    if (!selectedShiftId) return;
    setError('');
    try {
      await api.post(
        `/calendar/admin/shifts/${selectedShiftId}/teachers`,
        { moodleUserId: user.moodleUserId },
        { headers },
      );
      setSuccess(`Teacher assigned: ${user.fullname}`);
      setTeacherSearchUser('');
      setTeacherSuggestions([]);
      setTeacherSearchOpen(false);
      const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/teachers`, {
        headers,
      });
      setTeachers(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not assign teacher';
      setError(typeof message === 'string' ? message : 'Could not assign teacher');
    }
  };

  const unassignTeacher = async (moodleUserId: number) => {
    if (!selectedShiftId) return;
    try {
      await api.delete(`/calendar/admin/shifts/${selectedShiftId}/teachers/${moodleUserId}`, {
        headers,
      });
      setTeachers((prev) => prev.filter((t) => t.moodleUserId !== moodleUserId));
      setSuccess('Teacher removed');
    } catch {
      setError('Could not remove teacher');
    }
  };

  const createEvent = async () => {
    if (!eventForm.shiftId || !eventForm.title || !eventForm.startsAt || !eventForm.endsAt) {
      setError('Fill in shift, title, and dates');
      return;
    }
    try {
      await api.post(
        '/calendar/admin/events',
        {
          shiftId: Number(eventForm.shiftId),
          title: eventForm.title,
          meetUrl: eventForm.meetUrl || undefined,
          startsAt: new Date(eventForm.startsAt).toISOString(),
          endsAt: new Date(eventForm.endsAt).toISOString(),
        },
        { headers },
      );
      setSuccess('Event created');
      setEventForm({ shiftId: eventForm.shiftId, title: '', meetUrl: '', startsAt: '', endsAt: '' });
      await load();
    } catch {
      setError('Could not create event');
    }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm('Delete event?')) return;
    try {
      await api.delete(`/calendar/admin/events/${id}`, { headers });
      setSuccess('Event deleted');
      await load();
    } catch {
      setError('Could not delete event');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Calendar / Classrooms</h1>
        <p>Recurring classrooms (shifts), students, teachers, and one-off events.</p>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-nav" style={{ marginBottom: 16 }}>
          {(
            [
              ['shifts', 'Classrooms'],
              ['enroll', 'Students'],
              ['teachers', 'Teachers'],
              ['events', 'One-off events'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`admin-btn ${tab === key ? 'primary' : 'muted'}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="page-description">Loading…</p>
        ) : tab === 'shifts' ? (
          <>
            <div className="admin-card">
              <h3>New shift</h3>
              <p className="page-description" style={{ marginTop: 0 }}>
                E.g.: Mon–Thu 18:00–20:00 for a program/folder. Zone: America/Guayaquil.
              </p>
              <div className="admin-form-row" style={{ marginBottom: 10 }}>
                <input
                  className="admin-input"
                  placeholder="Name (B1 Evening)"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                />
                <select
                  className="admin-select"
                  value={shiftForm.folderId}
                  onChange={(e) => setShiftForm({ ...shiftForm, folderId: e.target.value })}
                >
                  <option value="">Folder / program</option>
                  {allFlat.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {'—'.repeat(depth)} {node.name}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="Moodle courseId (Meetings, optional)"
                  value={shiftForm.moodleCourseId}
                  onChange={(e) => setShiftForm({ ...shiftForm, moodleCourseId: e.target.value })}
                />
              </div>
              <div className="admin-form-row" style={{ marginBottom: 10 }}>
                {DAY_LABELS.map((label, i) => (
                  <label key={label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={shiftForm.daysOfWeek.includes(i)}
                      onChange={() => toggleDay(i)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="admin-form-row" style={{ marginBottom: 10 }}>
                <input
                  type="time"
                  className="admin-input"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                />
                <input
                  type="time"
                  className="admin-input"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                />
                <input
                  className="admin-input"
                  style={{ flex: 1 }}
                  placeholder="Event title"
                  value={shiftForm.title}
                  onChange={(e) => setShiftForm({ ...shiftForm, title: e.target.value })}
                />
              </div>
              <div className="admin-form-row" style={{ marginBottom: 10, alignItems: 'center' }}>
                <label className="page-description" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                  From
                </label>
                <input
                  type="date"
                  className="admin-input"
                  value={shiftForm.validFrom}
                  onChange={(e) => setShiftForm({ ...shiftForm, validFrom: e.target.value })}
                />
                <label className="page-description" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                  To
                </label>
                <input
                  type="date"
                  className="admin-input"
                  value={shiftForm.validTo}
                  onChange={(e) => setShiftForm({ ...shiftForm, validTo: e.target.value })}
                />
                <span className="page-description" style={{ margin: 0 }}>
                  Optional. Leave empty for no end (repeats indefinitely).
                </span>
              </div>
              <div className="admin-form-row">
                <input
                  className="admin-input"
                  style={{ flex: 1 }}
                  placeholder="Meet / class URL"
                  value={shiftForm.meetUrl}
                  onChange={(e) => setShiftForm({ ...shiftForm, meetUrl: e.target.value })}
                />
                <button type="button" className="admin-btn primary" onClick={() => void createShift()}>
                  Create shift
                </button>
              </div>
            </div>

            <div className="admin-card">
              <h3>Existing shifts</h3>
              {shifts.length === 0 ? (
                <p className="page-description">No shifts yet.</p>
              ) : (
                <ul className="admin-course-list">
                  {shifts.map((s) => (
                    <li key={s.id}>
                      <div style={{ flex: 1 }}>
                        <strong>{s.name}</strong>
                        <span className="admin-folder-meta">
                          {s.folderName} · {s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')} ·{' '}
                          {s.startTime}–{s.endTime}
                          {s.validFrom || s.validTo
                            ? ` · ${s.validFrom ?? '…'} → ${s.validTo ?? 'ongoing'}`
                            : ' · no date limit'}
                          {!s.isActive ? ' · inactive' : ''}
                        </span>
                      </div>
                      <button type="button" className="admin-btn danger" onClick={() => void deleteShift(s.id)}>
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : tab === 'enroll' ? (
          <div className="admin-card">
            <h3>Assign students to a classroom</h3>
            <p className="page-description" style={{ marginTop: 0 }}>
              Assigning a student also enrols them in Moodle on every class (course) linked to this
              classroom&apos;s program folder and its subfolders.
            </p>
            <select
              className="admin-select"
              value={selectedShiftId ?? ''}
              onChange={(e) => setSelectedShiftId(Number(e.target.value))}
              style={{ marginBottom: 12 }}
            >
              <option value="">Select shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="admin-autocomplete" ref={studentSearchRef} style={{ marginBottom: 12 }}>
              <input
                className="admin-input"
                placeholder="Type a name, username or email…"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                onFocus={() => {
                  if (studentSuggestions.length) setStudentSearchOpen(true);
                }}
                style={{ width: '100%' }}
                disabled={!selectedShiftId}
              />
              {studentSearchOpen && searchUser.trim().length >= 2 && (
                <ul className="admin-autocomplete__list" role="listbox">
                  {studentSearching && (
                    <li className="admin-autocomplete__empty">Searching…</li>
                  )}
                  {!studentSearching && studentSuggestions.length === 0 && (
                    <li className="admin-autocomplete__empty">No users found</li>
                  )}
                  {!studentSearching &&
                    studentSuggestions.map((u) => (
                      <li key={u.moodleUserId}>
                        <button
                          type="button"
                          className="admin-autocomplete__item"
                          onClick={() => void enrollUser(u)}
                        >
                          <strong>{u.fullname}</strong>
                          <span>
                            {u.username}
                            {u.email ? ` · ${u.email}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <ul className="admin-course-list">
              {enrollments.map((e) => (
                <li key={e.id}>
                  <div style={{ flex: 1 }}>
                    <strong>{e.fullName || `User #${e.moodleUserId}`}</strong>
                    <span className="admin-folder-meta">
                      {e.email || e.username || `id ${e.moodleUserId}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    onClick={() => void unenroll(e.moodleUserId)}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : tab === 'teachers' ? (
          <div className="admin-card">
            <h3>Assign teachers to a classroom</h3>
            <p className="page-description" style={{ marginTop: 0 }}>
              Assigning a teacher also enrols them as teacher in Moodle on every class linked to this
              classroom&apos;s program folder and its subfolders.
            </p>
            <select
              className="admin-select"
              value={selectedShiftId ?? ''}
              onChange={(e) => setSelectedShiftId(Number(e.target.value))}
              style={{ marginBottom: 12 }}
            >
              <option value="">Select classroom</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="admin-autocomplete" ref={teacherSearchRef} style={{ marginBottom: 12 }}>
              <input
                className="admin-input"
                placeholder="Type a name, username or email…"
                value={teacherSearchUser}
                onChange={(e) => setTeacherSearchUser(e.target.value)}
                onFocus={() => {
                  if (teacherSuggestions.length) setTeacherSearchOpen(true);
                }}
                style={{ width: '100%' }}
                disabled={!selectedShiftId}
              />
              {teacherSearchOpen && teacherSearchUser.trim().length >= 2 && (
                <ul className="admin-autocomplete__list" role="listbox">
                  {teacherSearching && (
                    <li className="admin-autocomplete__empty">Searching…</li>
                  )}
                  {!teacherSearching && teacherSuggestions.length === 0 && (
                    <li className="admin-autocomplete__empty">No users found</li>
                  )}
                  {!teacherSearching &&
                    teacherSuggestions.map((u) => (
                      <li key={u.moodleUserId}>
                        <button
                          type="button"
                          className="admin-autocomplete__item"
                          onClick={() => void assignTeacher(u)}
                        >
                          <strong>{u.fullname}</strong>
                          <span>
                            {u.username}
                            {u.email ? ` · ${u.email}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <ul className="admin-course-list">
              {teachers.map((t) => (
                <li key={t.id}>
                  <div style={{ flex: 1 }}>
                    <strong>{t.fullName || `User #${t.moodleUserId}`}</strong>
                    <span className="admin-folder-meta">
                      {t.email || t.username || `id ${t.moodleUserId}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    onClick={() => void unassignTeacher(t.moodleUserId)}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="admin-card">
              <h3>New one-off event</h3>
              <div className="admin-form-row" style={{ marginBottom: 10 }}>
                <select
                  className="admin-select"
                  value={eventForm.shiftId}
                  onChange={(e) => setEventForm({ ...eventForm, shiftId: e.target.value })}
                >
                  <option value="">Target shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="Title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
              <div className="admin-form-row">
                <input
                  type="datetime-local"
                  className="admin-input"
                  value={eventForm.startsAt}
                  onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                />
                <input
                  type="datetime-local"
                  className="admin-input"
                  value={eventForm.endsAt}
                  onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
                />
                <input
                  className="admin-input"
                  placeholder="Meet URL"
                  value={eventForm.meetUrl}
                  onChange={(e) => setEventForm({ ...eventForm, meetUrl: e.target.value })}
                />
                <button type="button" className="admin-btn primary" onClick={() => void createEvent()}>
                  Create
                </button>
              </div>
            </div>
            <div className="admin-card">
              <h3>Events</h3>
              <ul className="admin-course-list">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <div style={{ flex: 1 }}>
                      <strong>{ev.title}</strong>
                      <span className="admin-folder-meta">
                        {ev.shiftName} · {new Date(ev.startsAt).toLocaleString('en-US')}
                      </span>
                    </div>
                    <button type="button" className="admin-btn danger" onClick={() => void deleteEvent(ev.id)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
    </div>
  );
};
