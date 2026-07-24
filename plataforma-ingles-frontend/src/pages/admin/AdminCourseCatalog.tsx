import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import type { CourseFolderNode, MoodleCourse } from '@/core/types/courses-catalog';
import { MoodleCourseAutocomplete } from './MoodleCourseAutocomplete';
import './admin.css';

export const AdminCourseCatalog: React.FC = () => {
  const navigate = useNavigate();
  const { adminKey } = useAuth();
  const headers = { 'x-admin-key': adminKey || '' };

  const [tree, setTree] = useState<CourseFolderNode[]>([]);
  const [moodleCourses, setMoodleCourses] = useState<MoodleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState('');
  const [assignFolderId, setAssignFolderId] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');

  const [editing, setEditing] = useState<CourseFolderNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editSort, setEditSort] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CourseFolderNode | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [treeRes, coursesRes] = await Promise.all([
        api.get('/courses/admin/tree', { headers }),
        api.get('/courses/admin/moodle-courses', { headers }),
      ]);
      setTree(treeRes.data);
      setMoodleCourses(coursesRes.data);
    } catch {
      setError('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminKey) navigate('/admin');
    else void load();
  }, [adminKey, navigate]);

  const flatFolders = (
    nodes: CourseFolderNode[],
    depth = 0,
  ): { node: CourseFolderNode; depth: number }[] => {
    const out: { node: CourseFolderNode; depth: number }[] = [];
    for (const n of nodes) {
      out.push({ node: n, depth });
      out.push(...flatFolders(n.children ?? [], depth + 1));
    }
    return out;
  };

  const allFlat = flatFolders(tree);

  const createFolder = async () => {
    try {
      await api.post(
        '/courses/admin/folders',
        {
          name: newFolderName,
          parentId: parentFolderId ? parseInt(parentFolderId, 10) : null,
        },
        { headers },
      );
      setNewFolderName('');
      setSuccess('Folder created');
      await load();
    } catch {
      setError('Could not create folder');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.patch(
        `/courses/admin/folders/${editing.id}`,
        { name: editName, sortOrder: editSort },
        { headers },
      );
      setEditing(null);
      setSuccess('Folder updated');
      await load();
    } catch {
      setError('Could not save changes');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/courses/admin/folders/${deleteTarget.id}`, { headers });
      setSuccess(res.data.message);
      setDeleteTarget(null);
      await load();
    } catch {
      setError('Could not delete folder');
    }
  };

  const assignCourse = async () => {
    const folderId = parseInt(assignFolderId, 10);
    const moodleCourseId = parseInt(assignCourseId, 10);
    if (!folderId || !moodleCourseId) {
      setError('Select a folder and a Moodle course');
      return;
    }
    try {
      await api.post(
        `/courses/admin/folders/${folderId}/courses`,
        { moodleCourseId },
        { headers },
      );
      setSuccess('Course assigned to folder');
      setAssignCourseId('');
      await load();
    } catch {
      setError('Could not assign course');
    }
  };

  const unassign = async (linkId: number) => {
    if (!confirm('Remove this course from the folder? (it will not be deleted in Moodle)')) return;
    try {
      await api.delete(`/courses/admin/links/${linkId}`, { headers });
      setSuccess('Link removed');
      await load();
    } catch {
      setError('Failed to remove course');
    }
  };

  const seed = async () => {
    const res = await api.post('/courses/admin/seed-folders', {}, { headers });
    setSuccess(res.data.message);
    await load();
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Folders / program</h1>
        <p>Organize the Hopee tree and assign Moodle courses to each folder.</p>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-card">
        <button type="button" className="admin-btn primary" onClick={() => void seed()}>
          Create sample B1 / B2 folders
        </button>
      </div>

      <div className="admin-card">
        <h3>New folder</h3>
        <div className="admin-form-row">
          <input
            className="admin-input"
            placeholder="Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <select
            className="admin-select"
            value={parentFolderId}
            onChange={(e) => setParentFolderId(e.target.value)}
          >
            <option value="">Root</option>
            {allFlat.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'—'.repeat(depth)} {node.name}
              </option>
            ))}
          </select>
          <button type="button" className="admin-btn accent" onClick={() => void createFolder()}>
            Create
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h3>Assign Moodle course → folder</h3>
        <p className="page-description" style={{ marginTop: 0 }}>
          Search for the course by name. You no longer need to remember the Moodle ID.
        </p>
        <div className="admin-form-row">
          <select
            className="admin-select"
            value={assignFolderId}
            onChange={(e) => setAssignFolderId(e.target.value)}
          >
            <option value="">Folder</option>
            {allFlat.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'—'.repeat(depth)} {node.name}
              </option>
            ))}
          </select>
          <MoodleCourseAutocomplete
            courses={moodleCourses}
            valueId={assignCourseId}
            onChange={setAssignCourseId}
          />
          <button type="button" className="admin-btn primary" onClick={() => void assignCourse()}>
            Assign
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h3>Folders — edit, sort, or delete</h3>
        {loading ? (
          <p className="page-description">Loading…</p>
        ) : (
          allFlat.map(({ node, depth }) => (
            <div key={node.id} className="admin-folder-row">
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{ color: 'var(--text-muted)' }}>{'│  '.repeat(depth)}</span>
                <strong>{node.name}</strong>
                <span className="admin-folder-meta">
                  #{node.id} · order {node.sortOrder}
                </span>
                {(node.courses ?? []).length > 0 && (
                  <ul className="admin-course-list">
                    {node.courses.map((c) => (
                      <li key={c.linkId ?? c.id}>
                        📘 {c.name}
                        {c.linkId && (
                          <button
                            type="button"
                            className="admin-btn ghost"
                            onClick={() => void unassign(c.linkId!)}
                          >
                            remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="admin-btn accent"
                  onClick={() => {
                    setEditing(node);
                    setEditName(node.name);
                    setEditSort(node.sortOrder ?? 0);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => setDeleteTarget(node)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3 style={{ marginTop: 0 }}>Edit folder</h3>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Name</label>
            <input
              className="admin-input"
              style={{ width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Order (lower = first)
            </label>
            <input
              type="number"
              className="admin-input"
              style={{ width: '100%', marginBottom: 20, boxSizing: 'border-box' }}
              value={editSort}
              onChange={(e) => setEditSort(parseInt(e.target.value, 10) || 0)}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="admin-btn muted" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn primary" onClick={() => void saveEdit()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3 style={{ marginTop: 0, color: '#c62828' }}>
              Delete &quot;{deleteTarget.name}&quot;?
            </h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This will delete <strong>all subfolders</strong> and course <strong>links</strong> in
              this branch. Courses in <strong>Moodle are not deleted</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="admin-btn muted" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn danger" onClick={() => void confirmDelete()}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
