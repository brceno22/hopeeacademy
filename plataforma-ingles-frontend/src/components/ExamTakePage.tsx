import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{
    score: number;
    correct: number;
    total: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/exams/${examId}`);
        const data: Exam = res.data;
        setExam({
          ...data,
          questions: data.questions
            .sort((a, b) => a.order - b.order)
            .map((q) => ({
              ...q,
              options: [...q.options].sort(() => Math.random() - 0.5),
            })),
        });
      } catch {
        setError('No se pudo cargar el examen.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId]);

  const submitExam = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    try {
      const userId = parseInt(localStorage.getItem('moodleUserId') || '0', 10);
      const response = await api.post(`/exams/${exam.id}/submit`, {
        userId,
        answers: respuestas,
      });
      setResultado(response.data);
    } catch {
      setError('Error al enviar el examen.');
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return <p style={{ padding: '40px', textAlign: 'center' }}>Cargando examen...</p>;
  }

  if (error || !exam) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#c62828' }}>{error || 'Examen no encontrado'}</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '16px', padding: '10px 20px' }}>
          Volver
        </button>
      </div>
    );
  }

  if (resultado) {
    const aprobado = resultado.score >= 60;
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2 style={{ color: aprobado ? '#2e7d32' : '#c62828' }}>{resultado.message}</h2>
        <p style={{ fontSize: '48px', fontWeight: 'bold' }}>{resultado.score}%</p>
        <p>{resultado.correct} de {resultado.total} correctas</p>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: '24px', background: '#9c27b0', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Volver a mis cursos
        </button>
      </div>
    );
  }

  if (showConfirm) {
    const respondidas = Object.keys(respuestas).length;
    const faltantes = exam.questions.length - respondidas;
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>¿Finalizar examen?</h2>
        <p>
          Respondiste {respondidas} de {exam.questions.length}
          {faltantes > 0 && <span style={{ color: 'red' }}> — faltan {faltantes}</span>}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={() => setShowConfirm(false)}>Revisar</button>
          <button onClick={submitExam} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    );
  }

  const q = exam.questions[currentIndex];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px', fontFamily: 'system-ui' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border: '1px solid #ccc', background: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>
        ⬅ Volver
      </button>
      <h1 style={{ marginTop: 0 }}>{exam.title}</h1>
      {exam.description && <p style={{ color: '#666' }}>{exam.description}</p>}
      <p style={{ fontWeight: 'bold', color: '#666' }}>
        Pregunta {currentIndex + 1} de {exam.questions.length}
      </p>
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '24px', marginTop: '16px' }}>
        <h3>{q.text}</h3>
        {q.options.map((opt) => {
          const selected = respuestas[q.id] === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setRespuestas((prev) => ({ ...prev, [q.id]: opt.id }))}
              style={{
                display: 'block',
                width: '100%',
                marginBottom: '10px',
                padding: '14px',
                textAlign: 'left',
                border: selected ? '2px solid #9c27b0' : '1px solid #ddd',
                background: selected ? '#f3e5f5' : '#fafafa',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {opt.text}
            </button>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          {currentIndex > 0 ? (
            <button onClick={() => setCurrentIndex((i) => i - 1)}>Anterior</button>
          ) : (
            <span />
          )}
          {currentIndex < exam.questions.length - 1 ? (
            <button onClick={() => setCurrentIndex((i) => i + 1)}>Siguiente</button>
          ) : (
            <button onClick={() => setShowConfirm(true)} style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px' }}>
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
