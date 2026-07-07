//ExamView.tsx
import React, { useState} from 'react';
import api from '../../../core/api/axios';
import '../styles/course-view.css';

interface Option { id: number; text: string; }
interface Question { id: number; text: string; order: number; options: Option[]; }
interface Exam { id: number; title: string; description: string; questions: Question[]; }

interface ExamViewProps {
  module: { id: number; name: string; description: string; instanceId?: number; };
  courseId?: number;
}

export const ExamView: React.FC<ExamViewProps> = ({ module, courseId }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ score: number; correct: number; total: number; message: string } | null>(null);
  const [examList, setExamList] = useState<Exam[]>([]);

  const fetchExam = async () => {
    const idABuscar = courseId ?? module.instanceId;
    if (!idABuscar) { setError('Falta el ID del curso.'); return; }
    setLoading(true); setError('');
    try {
      const response = await api.get(`/exams/course/${idABuscar}`);
      setExamList(response.data || []);
      if (!response.data || response.data.length === 0) setError('No hay exámenes disponibles.');
    } catch {
      setError('Error al cargar los exámenes.');
    } finally {
      setLoading(false);
    }
  };

  const seleccionarExam = (examSeleccionado: Exam) => {
    const examConOpciones = {
      ...examSeleccionado,
      questions: examSeleccionado.questions
        .sort((a, b) => a.order - b.order)
        .map(q => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) })),
    };
    setExam(examConOpciones);
  };

  const submitExam = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    try {
      const userId = localStorage.getItem('moodleUserId') || '0';
      const response = await api.post(`/exams/${exam.id}/submit`, {
        userId: parseInt(userId), answers: respuestas,
      });
      setResultado(response.data);
      try {
        await api.post('/progress/mark', { courseId, moduleId: module.id, type: 'auto' });
      } catch (e) { console.error(e); }
    } catch (err) {
      setError('Error al enviar el examen. Intentá de nuevo.');
    } finally {
      setIsSubmitting(false); setShowConfirm(false);
    }
  };

  if (resultado) {
    const aprobado = resultado.score >= 60;
    return (
      <div className="exam-container" style={{ textAlign: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>{aprobado ? '🏆' : '💪'}</div>
        <h2 style={{ color: aprobado ? '#10B981' : 'var(--text-main)' }}>{resultado.message}</h2>
        <div className="exam-question-card" style={{ marginTop: '20px', maxWidth: '400px', margin: '20px auto' }}>
          <p style={{ fontSize: '3rem', fontFamily: 'var(--font-titles)', color: aprobado ? '#10B981' : 'var(--text-main)', margin: 0 }}>
            {resultado.score}%
          </p>
          <p className="page-description">Respondidas correctas: {resultado.correct} de {resultado.total}</p>
        </div>
        <button className="btn-card primary" style={{ maxWidth: '250px', margin: '0 auto' }} onClick={() => { setResultado(null); setExam(null); setRespuestas({}); setCurrentIndex(0); }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  if (showConfirm && exam) {
    const respondidas = Object.keys(respuestas).length;
    const faltantes = exam.questions.length - respondidas;
    return (
      <div className="exam-container" style={{ textAlign: 'center', justifyContent: 'center' }}>
        <div className="exam-header-icon">⚠️</div>
        <h2 style={{ color: 'var(--secondary-color)' }}>¿Estás seguro de finalizar?</h2>
        <div className="exam-question-card" style={{ maxWidth: '500px', margin: '0 auto 30px' }}>
          <p>Has respondido <strong>{respondidas}</strong> de {exam.questions.length} preguntas.</p>
          {faltantes > 0 && <p style={{ color: '#ef4444', fontWeight: 'bold' }}>¡Te faltan {faltantes} sin responder!</p>}
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button className="btn-back" onClick={() => setShowConfirm(false)} disabled={isSubmitting}>Volver a revisar</button>
          <button className="btn-success" onClick={submitExam} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Sí, enviar examen'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-container">
      {error && <p style={{ color: '#ef4444', textAlign: 'center', fontWeight: 'bold', marginBottom: '15px' }}>{error}</p>}
      {!exam ? (
        <div style={{ textAlign: 'center' }}>
          <div className="exam-header-icon" style={{ background: 'rgba(0, 113, 188, 0.1)', color: 'var(--primary-color)' }}>📝</div>
          <h2>{module.name}</h2>
          
          {examList.length > 0 ? (
            <div style={{ marginTop: '30px', textAlign: 'left' }}>
              <h3 className="section-title">Exámenes disponibles</h3>
              {examList.map(e => (
                <div key={e.id} className="program-class-card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{e.title}</h4>
                    <p style={{ margin: 0 }}>{e.questions.length} preguntas</p>
                  </div>
                  <button className="btn-card primary" style={{ width: 'auto' }} onClick={() => seleccionarExam(e)}>Comenzar →</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: '30px' }}>
              {module.description && <div className="page-description" dangerouslySetInnerHTML={{ __html: module.description }} />}
              <button className="btn-card primary" style={{ maxWidth: '250px' }} onClick={fetchExam} disabled={loading}>
                {loading ? 'Cargando...' : 'Cargar evaluaciones'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <span>Pregunta {currentIndex + 1} de {exam.questions.length}</span>
            <span style={{ color: 'var(--secondary-color)' }}>{Math.round(((currentIndex + 1) / exam.questions.length) * 100)}%</span>
          </div>
          
          <div className="exam-progress-bar-bg">
            <div className="exam-progress-bar-fill" style={{ width: `${((currentIndex + 1) / exam.questions.length) * 100}%` }} />
          </div>

          <div className="exam-question-card">
            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary-color)', marginBottom: '30px' }}>
              {exam.questions[currentIndex].text}
            </h3>

            <div>
              {exam.questions[currentIndex].options.map(option => {
                const isSelected = respuestas[exam.questions[currentIndex].id] === option.id;
                return (
                  <button
                    key={option.id}
                    className={`exam-option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setRespuestas(prev => ({ ...prev, [exam.questions[currentIndex].id]: option.id }))}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn-back" 
                style={{ visibility: currentIndex > 0 ? 'visible' : 'hidden', margin: 0 }} 
                onClick={() => setCurrentIndex(i => i - 1)}
              >
                ← Anterior
              </button>
              
              {currentIndex < exam.questions.length - 1 ? (
                <button className="btn-card primary" style={{ width: 'auto' }} onClick={() => setCurrentIndex(i => i + 1)}>
                  Siguiente →
                </button>
              ) : (
                <button className="btn-success" onClick={() => setShowConfirm(true)}>
                  Finalizar Examen
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};