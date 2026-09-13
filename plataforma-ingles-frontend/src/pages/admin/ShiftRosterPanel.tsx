import React from 'react';
import type { Enrollment, Shift, UserSuggestion } from './calendarAdminTypes';

interface ShiftRosterPanelProps {
  role: 'student' | 'teacher';
  shifts: Shift[];
  selectedShiftId: number | null;
  onSelectShift: (id: number) => void;
  members: Enrollment[];
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchOpen: boolean;
  onSearchFocus: () => void;
  searching: boolean;
  suggestions: UserSuggestion[];
  onAssign: (user: UserSuggestion) => void;
  onRemove: (moodleUserId: number) => void;
}

export const ShiftRosterPanel: React.FC<ShiftRosterPanelProps> = ({
  role,
  shifts,
  selectedShiftId,
  onSelectShift,
  members,
  searchRef,
  searchValue,
  onSearchChange,
  searchOpen,
  onSearchFocus,
  searching,
  suggestions,
  onAssign,
  onRemove,
}) => {
  const isStudent = role === 'student';
  return (
    <div className="admin-card">
      <h3>{isStudent ? 'Assign students to a classroom' : 'Assign teachers to a classroom'}</h3>
      <p className="page-description" style={{ marginTop: 0 }}>
        {isStudent
          ? "Assigning a student also enrols them in Moodle on every class (course) linked to this classroom's program folder and its subfolders."
          : "Assigning a teacher also enrols them as teacher in Moodle on every class linked to this classroom's program folder and its subfolders."}
      </p>
      <select
        className="admin-select"
        value={selectedShiftId ?? ''}
        onChange={(e) => onSelectShift(Number(e.target.value))}
        style={{ marginBottom: 12 }}
      >
        <option value="">{isStudent ? 'Select shift' : 'Select classroom'}</option>
        {shifts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="admin-autocomplete" ref={searchRef} style={{ marginBottom: 12 }}>
        <input
          className="admin-input"
          placeholder="Type a name, username or email…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onSearchFocus}
          style={{ width: '100%' }}
          disabled={!selectedShiftId}
        />
        {searchOpen && searchValue.trim().length >= 2 && (
          <ul className="admin-autocomplete__list" role="listbox">
            {searching && <li className="admin-autocomplete__empty">Searching…</li>}
            {!searching && suggestions.length === 0 && (
              <li className="admin-autocomplete__empty">No users found</li>
            )}
            {!searching &&
              suggestions.map((u) => (
                <li key={u.moodleUserId}>
                  <button
                    type="button"
                    className="admin-autocomplete__item"
                    onClick={() => onAssign(u)}
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
        {members.map((m) => (
          <li key={m.id}>
            <div style={{ flex: 1 }}>
              <strong>{m.fullName || `User #${m.moodleUserId}`}</strong>
              <span className="admin-folder-meta">
                {m.email || m.username || `id ${m.moodleUserId}`}
              </span>
            </div>
            <button
              type="button"
              className="admin-btn ghost"
              onClick={() => onRemove(m.moodleUserId)}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
