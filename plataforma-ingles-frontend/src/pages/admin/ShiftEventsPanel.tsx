import React from 'react';
import type { CalEvent, EventFormState, Shift } from './calendarAdminTypes';

interface ShiftEventsPanelProps {
  eventForm: EventFormState;
  setEventForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  shifts: Shift[];
  events: CalEvent[];
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export const ShiftEventsPanel: React.FC<ShiftEventsPanelProps> = ({
  eventForm,
  setEventForm,
  shifts,
  events,
  onCreate,
  onDelete,
}) => (
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
        <button type="button" className="admin-btn primary" onClick={onCreate}>
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
            <button type="button" className="admin-btn danger" onClick={() => onDelete(ev.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  </>
);
