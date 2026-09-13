import React from 'react';
import { DAY_LABELS, type Shift, type ShiftFormState } from './calendarAdminTypes';
import type { CourseFolderNode } from '@/core/types/courses-catalog';

interface ShiftFormProps {
  shiftForm: ShiftFormState;
  setShiftForm: React.Dispatch<React.SetStateAction<ShiftFormState>>;
  allFlat: { node: CourseFolderNode; depth: number }[];
  shifts: Shift[];
  onToggleDay: (d: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export const ShiftForm: React.FC<ShiftFormProps> = ({
  shiftForm,
  setShiftForm,
  allFlat,
  shifts,
  onToggleDay,
  onCreate,
  onDelete,
}) => (
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
              onChange={() => onToggleDay(i)}
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
        <button type="button" className="admin-btn primary" onClick={onCreate}>
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
              <button type="button" className="admin-btn danger" onClick={() => onDelete(s.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </>
);
