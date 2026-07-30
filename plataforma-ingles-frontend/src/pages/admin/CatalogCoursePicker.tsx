import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CourseFolderNode } from '@/core/types/courses-catalog';

export interface CatalogCourseItem {
  moodleCourseId: number;
  courseName: string;
  folderPath: string;
}

/** Flatten Hopee folder tree into courses with folder path labels. */
export function flattenCatalogCourses(
  nodes: CourseFolderNode[],
  parentPath: string[] = [],
): CatalogCourseItem[] {
  const out: CatalogCourseItem[] = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    const folderPath = path.join(' / ');
    for (const c of node.courses ?? []) {
      out.push({
        moodleCourseId: c.id,
        courseName: c.name,
        folderPath,
      });
    }
    out.push(...flattenCatalogCourses(node.children ?? [], path));
  }
  return out;
}

interface CatalogCoursePickerProps {
  items: CatalogCourseItem[];
  valueId: number | string;
  onChange: (moodleCourseId: number) => void;
  placeholder?: string;
}

export const CatalogCoursePicker: React.FC<CatalogCoursePickerProps> = ({
  items,
  valueId,
  onChange,
  placeholder = 'Search by course or folder/program…',
}) => {
  const valueStr = valueId ? String(valueId) : '';
  const selected = items.find((c) => String(c.moodleCourseId) === valueStr);
  const [query, setQuery] = useState(
    selected ? `${selected.courseName} (${selected.folderPath})` : '',
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      setQuery(`${selected.courseName} (${selected.folderPath})`);
    } else if (!valueStr || valueStr === '0') {
      setQuery('');
    }
  }, [selected?.moodleCourseId, selected?.courseName, selected?.folderPath, valueStr]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? items
      : items.filter(
          (c) =>
            c.courseName.toLowerCase().includes(q) ||
            c.folderPath.toLowerCase().includes(q) ||
            String(c.moodleCourseId).includes(q),
        );
    return list.slice(0, 20);
  }, [items, query]);

  const pick = (item: CatalogCourseItem) => {
    onChange(item.moodleCourseId);
    setQuery(`${item.courseName} (${item.folderPath})`);
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
          onChange(0);
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
              key={`${c.moodleCourseId}-${c.folderPath}`}
              type="button"
              role="option"
              className={`moodle-ac__item ${idx === activeIndex ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
            >
              {c.courseName}
              <small>
                {c.folderPath} · ID {c.moodleCourseId}
              </small>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="moodle-ac__list">
          <div className="moodle-ac__item" style={{ cursor: 'default' }}>
            {items.length === 0
              ? 'No courses linked in the catalog yet'
              : `No results for “${query}”`}
          </div>
        </div>
      )}
    </div>
  );
};
