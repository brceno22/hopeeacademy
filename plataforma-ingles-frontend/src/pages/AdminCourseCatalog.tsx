import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import type { CourseFolderNode, MoodleCourse } from '../types/courses-catalog';

export const AdminCourseCatalog: React.FC = () => {
  const navigate = useNavigate();
  const adminKey = localStorage.getItem('adminKey');
  const headers = { 'x-admin-key': adminKey };

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
      setError('Error al cargar catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminKey) navigate('/admin');
    else load();
  }, []);

  const flatFolders = (nodes: CourseFolderNode[], depth = 0): { node: CourseFolderNode; depth: number }[] => {
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
        { name: newFolderName, parentId: parentFolderId ? parseInt(parentFolderId, 10) : null },
        { headers },
      );
      setNewFolderName('');
      setSuccess('Carpeta creada');
      await load();
    } catch {
      setError('No se pudo crear la carpeta');
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
      setSuccess('Carpeta actualizada');
      await load();
    } catch {
      setError('No se pudo guardar los cambios');
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
      setError('No se pudo eliminar la carpeta');
    }
  };

  const assignCourse = async () => {
    const folderId = parseInt(assignFolderId, 10);
    const moodleCourseId = parseInt(assignCourseId, 10);
    if (!folderId || !moodleCourseId) {
      setError('Elegí carpeta y curso Moodle');
      return;
    }
    try {
      await api.post(`/courses/admin/folders/${folderId}/courses`, { moodleCourseId }, { headers });
      setSuccess('Curso asignado a la carpeta');
      await load();
    } catch {
      setError('No se pudo asignar');
    }
  };

  const unassign = async (linkId: number) => {
    if (!confirm('¿Quitar este curso de la carpeta? (no se borra en Moodle)')) return;
    try {
      await api.delete(`/courses/admin/links/${linkId}`, { headers });
      setSuccess('Enlace eliminado');
      await load();
    } catch {
      setError('Error al quitar curso');
    }
  };

  const seed = async () => {
    const res = await api.post('/courses/admin/seed-folders', {}, { headers });
    setSuccess(res.data.message);
    await load();
  };

  const s = {
    card: { background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' } as React.CSSProperties,
    btn: (bg: string) => ({ background: bg, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' } as React.CSSProperties),
    input: { padding: '10px', border: '1px solid #ddd', borderRadius: '6px', marginRight: '8px' } as React.CSSProperties,
    row: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap' as const },
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>📂 Organizar cursos Moodle</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => navigate('/admin/dashboard')} style={s.btn('#666')}>← Exámenes</button>
          <button type="button" onClick={() => { localStorage.removeItem('adminKey'); navigate('/admin'); }} style={s.btn('#dc3545')}>Salir</button>
        </div>
      </div>

      {success && <p style={{ background: '#e8f5e9', padding: '12px', borderRadius: '6px' }}>{success}</p>}
      {error && <p style={{ background: '#fce4ec', padding: '12px', borderRadius: '6px' }}>{error}</p>}

      <div style={s.card}>
        <button type="button" onClick={seed} style={s.btn('#1a237e')}>Crear carpetas B1 / B2 de ejemplo</button>
      </div>

      <div style={s.card}>
        <h3 style={{ marginTop: 0 }}>Nueva carpeta</h3>
        <input style={s.input} placeholder="Nombre" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
        <select style={s.input} value={parentFolderId} onChange={(e) => setParentFolderId(e.target.value)}>
          <option value="">Raíz</option>
          {allFlat.map(({ node, depth }) => (
            <option key={node.id} value={node.id}>{'—'.repeat(depth)} {node.name}</option>
          ))}
        </select>
        <button type="button" onClick={createFolder} style={s.btn('#2e7d32')}>Crear</button>
      </div>

      <div style={s.card}>
        <h3 style={{ marginTop: 0 }}>Asignar curso Moodle → carpeta</h3>
        <select style={s.input} value={assignFolderId} onChange={(e) => setAssignFolderId(e.target.value)}>
          <option value="">Carpeta</option>
          {allFlat.map(({ node, depth }) => (
            <option key={node.id} value={node.id}>{'—'.repeat(depth)} {node.name}</option>
          ))}
        </select>
        <select style={{ ...s.input, minWidth: '280px' }} value={assignCourseId} onChange={(e) => setAssignCourseId(e.target.value)}>
          <option value="">Curso en Moodle</option>
          {moodleCourses.map((c) => (
            <option key={c.id} value={c.id}>#{c.id} — {c.name}</option>
          ))}
        </select>
        <button type="button" onClick={assignCourse} style={s.btn('#9c27b0')}>Asignar</button>
      </div>

      <div style={s.card}>
        <h3 style={{ marginTop: 0 }}>Carpetas — editar, ordenar o eliminar</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          allFlat.map(({ node, depth }) => (
            <div key={node.id} style={s.row}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <span style={{ color: '#888' }}>{'│  '.repeat(depth)}</span>
                <strong>{node.name}</strong>
                <small style={{ marginLeft: '8px', color: '#aaa' }}>#{node.id} · orden {node.sortOrder}</small>
                {(node.courses ?? []).length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '14px' }}>
                    {node.courses.map((c) => (
                      <li key={c.linkId ?? c.id}>
                        📘 {c.name}
                        {c.linkId && (
                          <button
                            type="button"
                            onClick={() => unassign(c.linkId!)}
                            style={{ marginLeft: '8px', fontSize: '12px', color: '#c62828', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            quitar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={s.btn('#ff9800')}
                  onClick={() => {
                    setEditing(node);
                    setEditName(node.name);
                    setEditSort(node.sortOrder ?? 0);
                  }}
                >
                  ✏️ Editar
                </button>
                <button type="button" style={s.btn('#dc3545')} onClick={() => setDeleteTarget(node)}>
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', width: 'min(400px, 90vw)' }}>
            <h3 style={{ marginTop: 0 }}>Editar carpeta</h3>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Nombre</label>
            <input style={{ ...s.input, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }} value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Orden (número menor = primero)</label>
            <input
              type="number"
              style={{ ...s.input, width: '100%', marginBottom: '20px', boxSizing: 'border-box' }}
              value={editSort}
              onChange={(e) => setEditSort(parseInt(e.target.value, 10) || 0)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditing(null)} style={s.btn('#666')}>Cancelar</button>
              <button type="button" onClick={saveEdit} style={s.btn('#2e7d32')}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', width: 'min(440px, 90vw)' }}>
            <h3 style={{ marginTop: 0, color: '#c62828' }}>¿Eliminar &quot;{deleteTarget.name}&quot;?</h3>
            <p style={{ color: '#555', lineHeight: 1.6 }}>
              Se eliminarán <strong>todas las subcarpetas</strong> y los <strong>enlaces</strong> a cursos de esta rama.
              Los cursos en <strong>Moodle no se borran</strong>. Los alumnos dejarán de ver esta organización.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={s.btn('#666')}>Cancelar</button>
              <button type="button" onClick={confirmDelete} style={s.btn('#dc3545')}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
