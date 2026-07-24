import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MoodleCourse } from '@/core/types/courses-catalog';

interface MoodleCourseAutocompleteProps {
  courses: MoodleCourse[];
  valueId: string;
  onChange: (courseId: string) => void;
  placeholder?: string;
}

export const MoodleCourseAutocomplete: React.FC<MoodleCourseAutocompleteProps> = ({
  courses,
  valueId,
  onChange,
  placeholder = 'Search Moodle course by name…',
}) => {
  const selected = courses.find((c) => String(c.id) === valueId);
  const [query, setQuery] = useState(selected ? selected.name : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses.slice(0, 12);
    return courses
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          String(c.id).includes(q) ||
          (c.code || '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [courses, query]);

  const pick = (course: MoodleCourse) => {
    onChange(String(course.id));
    setQuery(course.name);
    setOpen(false);
  };

  return (
    <div className="moodle-ac" ref={wrapRef}>
      <input
        className="admin-input"
        style={{ width: '100%', minWidth: 0 }}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange('');
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(filtered[activeIndex]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="moodle-ac__list" role="listbox">
          {filtered.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              role="option"
              className={`moodle-ac__item ${idx === activeIndex ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
            >
              {c.name}
              <small>
                ID {c.id}
                {c.code ? ` · ${c.code}` : ''}
              </small>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="moodle-ac__list">
          <div className="moodle-ac__item" style={{ cursor: 'default' }}>
            No results for “{query}”
          </div>
        </div>
      )}
    </div>
  );
};
