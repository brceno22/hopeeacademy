import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import './admin.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const [tab, setTab] = useState<'shifts' | 'enroll' | 'events'>('shifts');
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
  });

  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [foundUser, setFoundUser] = useState<{
    moodleUserId: number;
    fullname: string;
    email: string;
  } | null>(null);

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
        const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`, {
          headers,
        });
        setEnrollments(res.data);
      } catch {
        setEnrollments([]);
      }
    })();
  }, [selectedShiftId, adminKey]);

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
        },
        { headers },
      );
      setSuccess('Shift created');
      setShiftForm((f) => ({ ...f, name: '' }));
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

  const searchMoodleUser = async () => {
    setFoundUser(null);
    setError('');
    try {
      const q = searchUser.trim();
      const params = q.includes('@') ? { email: q } : { username: q };
      const res = await api.get('/users/buscar', { params });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setFoundUser({
        moodleUserId: res.data.moodleUserId,
        fullname: res.data.fullname,
        email: res.data.email,
      });
    } catch {
      setError('User not found in Moodle');
    }
  };

  const enrollUser = async () => {
    if (!selectedShiftId || !foundUser) return;
    try {
      await api.post(
        `/calendar/admin/shifts/${selectedShiftId}/enrollments`,
        { moodleUserId: foundUser.moodleUserId },
        { headers },
      );
      setSuccess(`Assigned: ${foundUser.fullname}`);
      setSearchUser('');
      setFoundUser(null);
      const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`, {
        headers,
      });
      setEnrollments(res.data);
    } catch {
      setError('Could not assign');
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
        <h1>Calendar / Shifts</h1>
        <p>Recurring rules, students per shift, and one-off events.</p>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-nav" style={{ marginBottom: 16 }}>
          {(
            [
              ['shifts', 'Shifts'],
              ['enroll', 'Shift students'],
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
            <h3>Assign students to a shift</h3>
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
            <div className="admin-form-row" style={{ marginBottom: 12 }}>
              <input
                className="admin-input"
                placeholder="Moodle username or email"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="admin-btn accent" onClick={() => void searchMoodleUser()}>
                Search
              </button>
              {foundUser && (
                <button type="button" className="admin-btn primary" onClick={() => void enrollUser()}>
                  Assign {foundUser.fullname}
                </button>
              )}
            </div>
            {foundUser && (
              <p className="page-description">
                Found: {foundUser.fullname} (id {foundUser.moodleUserId}) — {foundUser.email}
              </p>
            )}
            <ul className="admin-course-list">
              {enrollments.map((e) => (
                <li key={e.id}>
                  <span>Moodle user #{e.moodleUserId}</span>
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
