import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../core/api/axios';
import { AxiosError } from 'axios';
import {
  ExamQuestionBody,
  isAnswered,
} from '@/features/courses/components/ExamQuestionBody';
import type {
  AnswerValue,
  ExamQuestionView,
} from '@/features/courses/components/ExamQuestionBody';

interface Exam {
  id: number;
  title: string;
  description: string;
  questions: ExamQuestionView[];
  maxAttempts?: number;
  passThreshold?: number;
}

interface Attempt {
  id: number;
  score: number;
  finishedAt: string;
}

function questionOrder(q: ExamQuestionView & { order?: number; sortOrder?: number }): number {
  return (q as { sortOrder?: number }).sortOrder ?? (q as { order?: number }).order ?? 0;
}

export const ExamTakePage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<number, AnswerValue>>({});
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
        const [examRes, attemptsRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.get(`/exams/${examId}/attempts`).catch(() => ({ data: [] as Attempt[] })),
        ]);
        const data: Exam = examRes.data;
        const attempts: Attempt[] = Array.isArray(attemptsRes.data) ? attemptsRes.data : [];
        setAttemptsUsed(attempts.length);
        setExam({
          ...data,
          questions: (data.questions || [])
            .sort((a, b) => questionOrder(a) - questionOrder(b))
            .map((q) => ({
              ...q,
              options: [...(q.options || [])].sort(() => Math.random() - 0.5),
            })),
        });
      } catch {
        setError('Could not load the exam.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examId]);

  const maxAttempts = exam?.maxAttempts ?? 3;
  const passThreshold = exam?.passThreshold ?? 60;
  const attemptsExhausted = attemptsUsed >= maxAttempts;

  const submitExam = async () => {
    if (!exam || attemptsExhausted) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await api.post(`/exams/${exam.id}/submit`, {
        answers: respuestas,
      });
      setResultado(response.data);
      setAttemptsUsed((n) => n + 1);
    } catch (err) {
      const ax = err as AxiosError<{ message?: string | string[] }>;
      const msg = ax.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to submit the exam.');
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return <p style={{ padding: '40px', textAlign: 'center' }}>Loading exam...</p>;
  }

  if ((error && !exam) || !exam) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#c62828' }}>{error || 'Exam not found'}</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '16px', padding: '10px 20px' }}>
          Back
        </button>
      </div>
    );
  }

  if (resultado) {
    const aprobado = resultado.score >= passThreshold;
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2 style={{ color: aprobado ? '#2e7d32' : '#c62828' }}>{resultado.message}</h2>
        <p style={{ fontSize: '48px', fontWeight: 'bold' }}>{resultado.score}%</p>
        <p>
          {resultado.correct} of {resultado.total} correct (pass at {passThreshold}%)
        </p>
        <p style={{ color: '#666' }}>
          Attempts used: {attemptsUsed} / {maxAttempts}
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: '24px',
            background: '#9c27b0',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Back to my courses
        </button>
      </div>
    );
  }

  if (attemptsExhausted) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>No attempts left</h2>
        <p>
          You used {attemptsUsed} of {maxAttempts} attempts for this exam.
        </p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '16px', padding: '10px 20px' }}>
          Back
        </button>
      </div>
    );
  }

  if (showConfirm) {
    const respondidas = exam.questions.filter((q) => isAnswered(respuestas[q.id], q)).length;
    const faltantes = exam.questions.length - respondidas;
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>Finish exam?</h2>
        <p>
          You answered {respondidas} of {exam.questions.length}
          {faltantes > 0 && <span style={{ color: 'red' }}> — {faltantes} left</span>}
        </p>
        {error && <p style={{ color: '#c62828' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={() => setShowConfirm(false)}>Review</button>
          <button onClick={() => void submitExam()} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  const q = exam.questions[currentIndex];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px', fontFamily: 'system-ui' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: '20px',
          border: '1px solid #ccc',
          background: '#fff',
          padding: '8px 14px',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        ⬅ Back
      </button>
      <h1 style={{ marginTop: 0 }}>{exam.title}</h1>
      {exam.description && <p style={{ color: '#666' }}>{exam.description}</p>}
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Attempts: {attemptsUsed} / {maxAttempts} · Pass: {passThreshold}%
      </p>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      <p style={{ fontWeight: 'bold', color: '#666' }}>
        Question {currentIndex + 1} of {exam.questions.length}
      </p>
      <div
        style={{
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '24px',
          marginTop: '16px',
        }}
      >
        <ExamQuestionBody
          question={q}
          value={respuestas[q.id]}
          onChange={(val) => setRespuestas((prev) => ({ ...prev, [q.id]: val }))}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          {currentIndex > 0 ? (
            <button onClick={() => setCurrentIndex((i) => i - 1)}>Previous</button>
          ) : (
            <span />
          )}
          {currentIndex < exam.questions.length - 1 ? (
            <button onClick={() => setCurrentIndex((i) => i + 1)}>Next</button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              style={{
                background: '#4caf50',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
              }}
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
