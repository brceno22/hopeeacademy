import React, { useState } from 'react';
import api from '../api/axios';

interface Option {
  id: number;
  text: string;
}

interface Question {
  id: number;
  text: string;
  order: number;
  options: Option[];
}

interface Exam {
  id: number;
  title: string;
  description: string;
  questions: Question[];
}

interface ExamViewProps {
  module: {
    name: string;
    description: string;
    instanceId?: number;
  };
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
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/exams/course/${idABuscar}`);
        const exams: Exam[] = response.data;
        if (!exams || exams.length === 0) {
          setError('No hay exámenes disponibles para este curso.');
          return;
        }
        setExamList(exams);
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

  const handleSeleccionar = (questionId: number, optionId: number) => {
    setRespuestas(prev => ({ ...prev, [questionId]: optionId }));
  };

  const submitExam = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    try {
      const userId = localStorage.getItem('moodleUserId') || '0';
      const response = await api.post(`/exams/${exam.id}/submit`, {
        userId: parseInt(userId),
        answers: respuestas,
      });
      setResultado(response.data);
    } catch (err) {
      setError('Error al enviar el examen. Intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  // PANTALLA: Resultado final
  if (resultado) {
    const aprobado = resultado.score >= 60;
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
        <div style={{ background: aprobado ? '#e8f5e9' : '#fce4ec', padding: '20px', borderRadius: '50%', fontSize: '50px', marginBottom: '20px' }}>
          {aprobado ? '🎉' : '😔'}
        </div>
        <h2 style={{ color: aprobado ? '#2e7d32' : '#c62828', marginBottom: '10px' }}>
          {resultado.message}
        </h2>
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginTop: '20px', minWidth: '250px' }}>
          <p style={{ fontSize: '48px', fontWeight: 'bold', margin: 0, color: aprobado ? '#2e7d32' : '#c62828' }}>
            {resultado.score}%
          </p>
          <p style={{ color: '#666', margin: '10px 0 0 0' }}>
            {resultado.correct} correctas de {resultado.total}
          </p>
        </div>
        <button
          onClick={() => {
            setResultado(null);
            setExam(null);
            setRespuestas({});
            setCurrentIndex(0);
          }}
          style={{ marginTop: '30px', background: '#9c27b0', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  // PANTALLA: Confirmación
  if (showConfirm && exam) {
    const respondidas = Object.keys(respuestas).length;
    const faltantes = exam.questions.length - respondidas;
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '50%', fontSize: '50px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: '#e65100', marginBottom: '15px' }}>¿Estás seguro de finalizar?</h2>
        <div style={{ background: '#fff', border: '1px solid #ddd', padding: '20px', borderRadius: '8px', marginBottom: '30px', width: '100%', maxWidth: '400px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
            Has respondido <strong>{respondidas}</strong> de {exam.questions.length} preguntas.
          </p>
          {faltantes > 0 && (
            <p style={{ color: 'red', margin: 0, fontWeight: 'bold' }}>¡Te faltan {faltantes} sin responder!</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isSubmitting}
            style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ccc', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ⬅ Volver a revisar
          </button>
          <button
            onClick={submitExam}
            disabled={isSubmitting}
            style={{ background: '#4caf50', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {isSubmitting ? 'Enviando...' : 'Sí, enviar examen ✅'}
          </button>
        </div>
        {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
      </div>
    );
  }

  // PANTALLA: Inicio / Reproductor
  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      {!exam ? (
        <>
          <div style={{ background: '#f3e5f5', padding: '20px', borderRadius: '50%', fontSize: '40px', marginBottom: '20px' }}>🧠</div>
          <h2 style={{ color: '#1a1a1a', marginBottom: '15px' }}>{module.name}</h2>

          {/* Lista de exámenes disponibles */}
          {examList.length > 0 ? (
            <div style={{ width: '100%', maxWidth: '600px' }}>
              <h3 style={{ color: '#555', marginBottom: '15px' }}>Exámenes disponibles:</h3>
              {examList.map(e => (
                <div key={e.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#333' }}>{e.title}</h4>
                    <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{e.questions.length} preguntas</p>
                  </div>
                  <button
                    onClick={() => seleccionarExam(e)}
                    style={{ background: '#9c27b0', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Comenzar ➡
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {module.description && (
                <div
                  style={{ color: '#555', marginBottom: '30px', maxWidth: '600px', textAlign: 'center', background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}
                  dangerouslySetInnerHTML={{ __html: module.description }}
                />
              )}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              <button
                onClick={fetchExam}
                disabled={loading}
                style={{ background: loading ? '#ccc' : '#9c27b0', color: 'white', border: 'none', borderRadius: '6px', padding: '12px 30px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Cargando...' : 'Ver Exámenes'}
              </button>
            </>
          )}
        </>
      ) : (
        <div style={{ width: '100%', maxWidth: '800px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#666', fontWeight: 'bold' }}>
            <span>Pregunta {currentIndex + 1} de {exam.questions.length}</span>
            <span>{Math.round(((currentIndex + 1) / exam.questions.length) * 100)}% Completado</span>
          </div>
          <div style={{ width: '100%', background: '#e0e0e0', borderRadius: '4px', height: '8px', marginBottom: '30px' }}>
            <div style={{ width: `${((currentIndex + 1) / exam.questions.length) * 100}%`, background: '#9c27b0', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' }} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '30px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 25px 0', color: '#333', fontSize: '20px' }}>
              {exam.questions[currentIndex].text}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
              {exam.questions[currentIndex].options.map(option => {
                const questionId = exam.questions[currentIndex].id;
                const isSelected = respuestas[questionId] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSeleccionar(questionId, option.id)}
                    style={{
                      padding: '16px',
                      border: isSelected ? '2px solid #9c27b0' : '2px solid #e0e0e0',
                      background: isSelected ? '#f3e5f5' : '#fafafa',
                      color: isSelected ? '#9c27b0' : '#333',
                      borderRadius: '8px',
                      textAlign: 'left',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {currentIndex > 0 ? (
                <button onClick={() => setCurrentIndex(i => i - 1)} style={{ background: 'transparent', color: '#555', border: '1px solid #ccc', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ⬅ Anterior
                </button>
              ) : <div />}
              {currentIndex < exam.questions.length - 1 ? (
                <button onClick={() => setCurrentIndex(i => i + 1)} style={{ background: '#333', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Siguiente ➡
                </button>
              ) : (
                <button onClick={() => setShowConfirm(true)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Finalizar Examen ✅
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};