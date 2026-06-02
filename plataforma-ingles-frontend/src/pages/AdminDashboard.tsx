import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface Option { id?: number; text: string; isCorrect: boolean; }
interface Question { id?: number; text: string; order: number; options: Option[]; }
interface Exam { id: number; courseId: number; title: string; description: string; active: boolean; questions: Question[]; }

const emptyQuestion = (): Question => ({
  text: '',
  order: 1,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});

const emptyExam = () => ({
  courseId: 0,
  title: '',
  description: '',
  active: true,
  questions: [emptyQuestion()],
});

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const adminKey = localStorage.getItem('adminKey');

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingExam, setEditingExam] = useState<any>(emptyExam());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!adminKey) { navigate('/admin'); return; }
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exams', { headers: { 'x-admin-key': adminKey } });
      setExams(res.data);
    } catch {
      setError('Error al cargar exámenes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (view === 'edit' && editingExam.id) {
        await api.put(`/exams/${editingExam.id}`, editingExam, { headers: { 'x-admin-key': adminKey } });
        setSuccess('Examen actualizado correctamente ✅');
      } else {
        await api.post('/exams', editingExam, { headers: { 'x-admin-key': adminKey } });
        setSuccess('Examen creado correctamente ✅');
      }
      await fetchExams();
      setTimeout(() => { setSuccess(''); setView('list'); }, 1500);
    } catch {
      setError('Error al guardar el examen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que querés eliminar este examen?')) return;
    try {
      await api.delete(`/exams/${id}`, { headers: { 'x-admin-key': adminKey } });
      setSuccess('Examen eliminado ✅');
      await fetchExams();
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Error al eliminar');
    }
  };

  const addQuestion = () => {
    setEditingExam((prev: any) => ({
      ...prev,
      questions: [...prev.questions, { ...emptyQuestion(), order: prev.questions.length + 1 }],
    }));
  };

  const removeQuestion = (qi: number) => {
    setEditingExam((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((_: any, i: number) => i !== qi),
    }));
  };

  const updateQuestion = (qi: number, field: string, value: any) => {
    setEditingExam((prev: any) => {
      const questions = [...prev.questions];
      questions[qi] = { ...questions[qi], [field]: value };
      return { ...prev, questions };
    });
  };

  const updateOption = (qi: number, oi: number, field: string, value: any) => {
    setEditingExam((prev: any) => {
      const questions = [...prev.questions];
      const options = [...questions[qi].options];
      // Si marcamos isCorrect, desmarcamos las demás
      if (field === 'isCorrect' && value === true) {
        options.forEach((o, i) => { options[i] = { ...o, isCorrect: i === oi }; });
      } else {
        options[oi] = { ...options[oi], [field]: value };
      }
      questions[qi] = { ...questions[qi], options };
      return { ...prev, questions };
    });
  };

  const s = {
    container: { padding: '30px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' } as React.CSSProperties,
    btn: (color: string) => ({ background: color, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' } as React.CSSProperties),
    card: { background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
    input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' as const, marginBottom: '12px' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#444' } as React.CSSProperties,
    questionBox: { background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' } as React.CSSProperties,
  };

  // VISTA: Lista de exámenes
  if (view === 'list') {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={{ margin: 0 }}>📋 Panel Admin — Exámenes</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/admin/carpetas')} style={s.btn('#00897b')}>
              📂 Carpetas
            </button>
            <button onClick={() => { setEditingExam(emptyExam()); setView('create'); }} style={s.btn('#1a237e')}>
              + Nuevo Examen
            </button>
            <button onClick={() => { localStorage.removeItem('adminKey'); navigate('/admin'); }} style={s.btn('#dc3545')}>
              Cerrar Sesión
            </button>
          </div>
        </div>

        {success && <p style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{success}</p>}
        {error && <p style={{ background: '#fce4ec', color: '#c62828', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#666', textAlign: 'center' }}>Cargando exámenes...</p>
        ) : exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
            <p style={{ fontSize: '40px' }}>📝</p>
            <p>No hay exámenes todavía. ¡Creá el primero!</p>
          </div>
        ) : (
          exams.map(exam => (
            <div key={exam.id} style={s.card}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0 }}>{exam.title}</h3>
                  <span style={{ background: exam.active ? '#e8f5e9' : '#fce4ec', color: exam.active ? '#2e7d32' : '#c62828', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    {exam.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  Curso ID: {exam.courseId} · {exam.questions?.length ?? 0} preguntas
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setEditingExam(exam); setView('edit'); }} style={s.btn('#ff9800')}>
                  ✏️ Editar
                </button>
                <button onClick={() => handleDelete(exam.id)} style={s.btn('#dc3545')}>
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // VISTA: Crear / Editar examen
  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={{ margin: 0 }}>{view === 'create' ? '➕ Nuevo Examen' : '✏️ Editar Examen'}</h1>
        <button onClick={() => setView('list')} style={s.btn('#666')}>← Volver</button>
      </div>

      {success && <p style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{success}</p>}
      {error && <p style={{ background: '#fce4ec', color: '#c62828', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

      {/* Datos básicos */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '25px', marginBottom: '25px' }}>
        <h3 style={{ marginTop: 0 }}>Datos del examen</h3>

        <label style={s.label}>Título</label>
        <input style={s.input} value={editingExam.title} onChange={e => setEditingExam((p: any) => ({ ...p, title: e.target.value }))} placeholder="Ej: Examen Unidad 1 - Verb To Be" />

        <label style={s.label}>Descripción</label>
        <input style={s.input} value={editingExam.description} onChange={e => setEditingExam((p: any) => ({ ...p, description: e.target.value }))} placeholder="Instrucciones para el alumno" />

        <label style={s.label}>ID del Curso (Moodle)</label>
        <input style={s.input} type="number" value={editingExam.courseId} onChange={e => setEditingExam((p: any) => ({ ...p, courseId: parseInt(e.target.value) }))} placeholder="Ej: 2" />

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={editingExam.active} onChange={e => setEditingExam((p: any) => ({ ...p, active: e.target.checked }))} />
          <span style={{ fontWeight: 'bold' }}>Examen activo (visible para alumnos)</span>
        </label>
      </div>

      {/* Preguntas */}
      <h3>Preguntas ({editingExam.questions.length})</h3>

      {editingExam.questions.map((q: Question, qi: number) => (
        <div key={qi} style={s.questionBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#1a237e' }}>Pregunta {qi + 1}</h4>
            {editingExam.questions.length > 1 && (
              <button onClick={() => removeQuestion(qi)} style={{ background: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                Eliminar
              </button>
            )}
          </div>

          <label style={s.label}>Enunciado</label>
          <input
            style={s.input}
            value={q.text}
            onChange={e => updateQuestion(qi, 'text', e.target.value)}
            placeholder="Escribí la pregunta acá"
          />

          <label style={s.label}>Opciones (marcá la correcta)</label>
          {q.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={opt.isCorrect}
                onChange={() => updateOption(qi, oi, 'isCorrect', true)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
              />
              <input
                style={{ ...s.input, marginBottom: 0, flex: 1 }}
                value={opt.text}
                onChange={e => updateOption(qi, oi, 'text', e.target.value)}
                placeholder={`Opción ${oi + 1}`}
              />
            </div>
          ))}
        </div>
      ))}

      <button onClick={addQuestion} style={{ ...s.btn('#9c27b0'), marginBottom: '30px', width: '100%', padding: '14px' }}>
        + Agregar Pregunta
      </button>

      <button onClick={handleSave} disabled={saving} style={{ ...s.btn(saving ? '#ccc' : '#2e7d32'), width: '100%', padding: '16px', fontSize: '16px' }}>
        {saving ? 'Guardando...' : view === 'create' ? '💾 Crear Examen' : '💾 Guardar Cambios'}
      </button>
    </div>
  );
};