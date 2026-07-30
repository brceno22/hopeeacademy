import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api, { API_BASE_URL } from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import '@/core/ui/ui.css';
import './calendar-page.css';

interface Occurrence {
  id: string;
  source: 'shift' | 'event';
  sourceId: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  meetUrl: string | null;
  shiftId: number;
  shiftName: string;
  folderName: string | null;
  googleUrl?: string;
}

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const CalendarPage: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(ymdLocal(now));
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to } = useMemo(() => monthBounds(year, month), [year, month]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Occurrence[]>('/calendar/me', { params: { from, to } });
      setOccurrences(data);
    } catch {
      setError('Could not load the calendar');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const day = ymdLocal(new Date(o.startsAt));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(o);
    }
    return map;
  }, [occurrences]);

  const daysInGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ ymd: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ ymd: null, dayNum: null });
    for (let d = 1; d <= totalDays; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ ymd, dayNum: d });
    }
    return cells;
  }, [year, month]);

  const selectedEvents = byDay.get(selectedDay) || [];

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  const exportIcs = () => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}/calendar/me/ics?from=${from}&to=${to}`;
    void (async () => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `hopee-${from}_${to}.ics`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        setError('Could not download the .ics file');
      }
    })();
  };

  const monthTitle = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="calendar-page fade-in-page">
      <header className="calendar-header">
        <div>
          <h1>Calendar</h1>
          <p>Your classes this month and upcoming meets.</p>
        </div>
        <button type="button" className="btn-card secondary calendar-export" onClick={exportIcs}>
          Export month (.ics)
        </button>
      </header>

      {error && <div className="calendar-alert">{error}</div>}

      <div className="calendar-toolbar">
        <button type="button" className="btn-card secondary" onClick={prevMonth}>
          ←
        </button>
        <h2 style={{ textTransform: 'capitalize', margin: 0 }}>{monthTitle}</h2>
        <button type="button" className="btn-card secondary" onClick={nextMonth}>
          →
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
      ) : (
        <div className="calendar-layout">
          <div className="calendar-grid-wrap">
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {daysInGrid.map((cell, idx) => {
                if (!cell.ymd) return <div key={`pad-${idx}`} className="calendar-cell empty" />;
                const count = byDay.get(cell.ymd)?.length ?? 0;
                const active = cell.ymd === selectedDay;
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    className={`calendar-cell ${active ? 'active' : ''} ${count ? 'has-events' : ''}`}
                    onClick={() => setSelectedDay(cell.ymd!)}
                  >
                    <span className="day-num">{cell.dayNum}</span>
                    {count > 0 && <span className="day-dot">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-day-panel">
            <h3>{selectedDay}</h3>
            {selectedEvents.length === 0 ? (
              <EmptyState
                icon="📅"
                title="No events"
                description="You have no classes or shift events on this day."
              />
            ) : (
              <ul className="calendar-event-list">
                {selectedEvents.map((o) => (
                  <li key={o.id}>
                    <strong>{o.title}</strong>
                    <p>
                      {formatTime(o.startsAt)} – {formatTime(o.endsAt)}
                      {o.shiftName ? ` · ${o.shiftName}` : ''}
                    </p>
                    {o.meetUrl && (
                      <a href={o.meetUrl} target="_blank" rel="noopener noreferrer">
                        Join meet
                      </a>
                    )}
                    {o.googleUrl && (
                      <a
                        className="calendar-gcal"
                        href={o.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Add to Google Calendar
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
