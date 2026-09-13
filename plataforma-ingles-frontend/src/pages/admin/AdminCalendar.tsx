import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/auth';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import {
  SEARCH_DEBOUNCE_MS,
  flatFolders,
  type CalEvent,
  type Enrollment,
  type EventFormState,
  type Shift,
  type ShiftFormState,
  type UserSuggestion,
} from './calendarAdminTypes';
import { ShiftEventsPanel } from './ShiftEventsPanel';
import { ShiftForm } from './ShiftForm';
import { ShiftRosterPanel } from './ShiftRosterPanel';
import './admin.css';

export const AdminCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [tab, setTab] = useState<'shifts' | 'enroll' | 'teachers' | 'events'>('shifts');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const [folders, setFolders] = useState<CourseFolderNode[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);

  const [shiftForm, setShiftForm] = useState<ShiftFormState>({
    name: '',
    folderId: '',
    moodleCourseId: '',
    daysOfWeek: [1, 2, 3, 4],
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
  const [studentResultsFor, setStudentResultsFor] = useState('');
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [teacherSearchUser, setTeacherSearchUser] = useState('');
  const [teacherSuggestions, setTeacherSuggestions] = useState<UserSuggestion[]>([]);
  const [teacherResultsFor, setTeacherResultsFor] = useState('');
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);
  const teacherSearchRef = useRef<HTMLDivElement>(null);

  const [eventForm, setEventForm] = useState<EventFormState>({
    shiftId: '',
    title: '',
    meetUrl: '',
    startsAt: '',
    endsAt: '',
  });

  const allFlat = useMemo(() => flatFolders(folders), [folders]);

  const studentQ = searchUser.trim();
  const studentSearching = isAdmin && studentQ.length >= 2 && studentResultsFor !== studentQ;
  const visibleStudentSuggestions = studentResultsFor === studentQ ? studentSuggestions : [];
  const teacherQ = teacherSearchUser.trim();
  const teacherSearching = isAdmin && teacherQ.length >= 2 && teacherResultsFor !== teacherQ;
  const visibleTeacherSuggestions = teacherResultsFor === teacherQ ? teacherSuggestions : [];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [treeRes, shiftsRes, eventsRes] = await Promise.all([
        api.get('/courses/admin/tree'),
        api.get('/calendar/admin/shifts'),
        api.get('/calendar/admin/events'),
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
    if (!isAdmin) {
      navigate('/admin');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [treeRes, shiftsRes, eventsRes] = await Promise.all([
          api.get('/courses/admin/tree'),
          api.get('/calendar/admin/shifts'),
          api.get('/calendar/admin/events'),
        ]);
        if (cancelled) return;
        setFolders(treeRes.data);
        setShifts(shiftsRes.data);
        setEvents(eventsRes.data);
        if (!selectedShiftId && shiftsRes.data.length) {
          setSelectedShiftId(shiftsRes.data[0].id);
        }
      } catch {
        if (!cancelled) setError('Failed to load calendar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!selectedShiftId || !isAdmin) return;
    void (async () => {
      try {
        const [enrollRes, teacherRes] = await Promise.all([
          api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`),
          api.get(`/calendar/admin/shifts/${selectedShiftId}/teachers`),
        ]);
        setEnrollments(enrollRes.data);
        setTeachers(teacherRes.data);
      } catch {
        setEnrollments([]);
        setTeachers([]);
      }
    })();
  }, [selectedShiftId, isAdmin]);

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
    if (!isAdmin || searchUser.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const q = searchUser.trim();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<UserSuggestion[]>('/users/search', {
            params: { q },
          });
          if (!cancelled) {
            setStudentSuggestions(res.data);
            setStudentResultsFor(q);
            setStudentSearchOpen(true);
          }
        } catch {
          if (!cancelled) {
            setStudentSuggestions([]);
            setStudentResultsFor(q);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchUser, isAdmin]);

  useEffect(() => {
    if (!isAdmin || teacherSearchUser.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const q = teacherSearchUser.trim();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<UserSuggestion[]>('/users/search', {
            params: { q },
          });
          if (!cancelled) {
            setTeacherSuggestions(res.data);
            setTeacherResultsFor(q);
            setTeacherSearchOpen(true);
          }
        } catch {
          if (!cancelled) {
            setTeacherSuggestions([]);
            setTeacherResultsFor(q);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [teacherSearchUser, isAdmin]);

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
      await api.post('/calendar/admin/shifts', {
        name: shiftForm.name,
        folderId: Number(shiftForm.folderId),
        moodleCourseId: shiftForm.moodleCourseId ? Number(shiftForm.moodleCourseId) : null,
        daysOfWeek: shiftForm.daysOfWeek,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        title: shiftForm.title,
        description: shiftForm.description || undefined,
        meetUrl: shiftForm.meetUrl || undefined,
        validFrom: shiftForm.validFrom || undefined,
        validTo: shiftForm.validTo || undefined,
      });
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
      await api.delete(`/calendar/admin/shifts/${id}`);
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
      await api.post(`/calendar/admin/shifts/${selectedShiftId}/enrollments`, {
        moodleUserId: user.moodleUserId,
      });
      setSuccess(`Assigned: ${user.fullname}`);
      setSearchUser('');
      setStudentSuggestions([]);
      setStudentSearchOpen(false);
      const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/enrollments`);
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
      await api.delete(`/calendar/admin/shifts/${selectedShiftId}/enrollments/${moodleUserId}`);
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
      await api.post(`/calendar/admin/shifts/${selectedShiftId}/teachers`, {
        moodleUserId: user.moodleUserId,
      });
      setSuccess(`Teacher assigned: ${user.fullname}`);
      setTeacherSearchUser('');
      setTeacherSuggestions([]);
      setTeacherSearchOpen(false);
      const res = await api.get(`/calendar/admin/shifts/${selectedShiftId}/teachers`);
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
      await api.delete(`/calendar/admin/shifts/${selectedShiftId}/teachers/${moodleUserId}`);
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
      await api.post('/calendar/admin/events', {
        shiftId: Number(eventForm.shiftId),
        title: eventForm.title,
        meetUrl: eventForm.meetUrl || undefined,
        startsAt: new Date(eventForm.startsAt).toISOString(),
        endsAt: new Date(eventForm.endsAt).toISOString(),
      });
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
      await api.delete(`/calendar/admin/events/${id}`);
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
        <ShiftForm
          shiftForm={shiftForm}
          setShiftForm={setShiftForm}
          allFlat={allFlat}
          shifts={shifts}
          onToggleDay={toggleDay}
          onCreate={() => void createShift()}
          onDelete={(id) => void deleteShift(id)}
        />
      ) : tab === 'enroll' ? (
        <ShiftRosterPanel
          role="student"
          shifts={shifts}
          selectedShiftId={selectedShiftId}
          onSelectShift={setSelectedShiftId}
          members={enrollments}
          searchRef={studentSearchRef}
          searchValue={searchUser}
          onSearchChange={setSearchUser}
          searchOpen={studentSearchOpen}
          onSearchFocus={() => {
            if (visibleStudentSuggestions.length) setStudentSearchOpen(true);
          }}
          searching={studentSearching}
          suggestions={visibleStudentSuggestions}
          onAssign={(u) => void enrollUser(u)}
          onRemove={(id) => void unenroll(id)}
        />
      ) : tab === 'teachers' ? (
        <ShiftRosterPanel
          role="teacher"
          shifts={shifts}
          selectedShiftId={selectedShiftId}
          onSelectShift={setSelectedShiftId}
          members={teachers}
          searchRef={teacherSearchRef}
          searchValue={teacherSearchUser}
          onSearchChange={setTeacherSearchUser}
          searchOpen={teacherSearchOpen}
          onSearchFocus={() => {
            if (visibleTeacherSuggestions.length) setTeacherSearchOpen(true);
          }}
          searching={teacherSearching}
          suggestions={visibleTeacherSuggestions}
          onAssign={(u) => void assignTeacher(u)}
          onRemove={(id) => void unassignTeacher(id)}
        />
      ) : (
        <ShiftEventsPanel
          eventForm={eventForm}
          setEventForm={setEventForm}
          shifts={shifts}
          events={events}
          onCreate={() => void createEvent()}
          onDelete={(id) => void deleteEvent(id)}
        />
      )}
    </div>
  );
};
