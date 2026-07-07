//ForumView.tsx
import React, { useState, useEffect } from 'react';
import api from '@/core/api/axios';
import { ForumDiscussion } from './ForumDiscussion';
import '../styles/widgets-forum.css';

interface Discussion {
  discussion: number; 
  name: string;
  userfullname?: string;
  author?: { fullname: string; };
  created?: number;
  timemodified?: number;
}

interface ForumViewProps {
  forumId?: number;
  courseId?: number;
}

export const ForumView: React.FC<ForumViewProps> = ({ forumId, courseId }) => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      const url = forumId ? `/forums/${forumId}/discussions` : `/forums/general-discussions/auto`;
      const response = await api.get(url);
      
      if (response.data && response.data.discussions) {
        setDiscussions(response.data.discussions);
      } else if (Array.isArray(response.data)) {
        setDiscussions(response.data);
      } else {
        setDiscussions([]);
      }
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los temas del foro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
    setSelectedDiscussionId(null); 
  }, [forumId, courseId]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    try {
      setIsSubmitting(true);
      await api.post(`/forums/${forumId}/discussions`, { subject: newSubject, message: newMessage });
      setShowForm(false); setNewSubject(''); setNewMessage('');
      await fetchDiscussions();
    } catch (err) {
      alert('Error al crear el tema. Revisá tu conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (selectedDiscussionId) {
    return <ForumDiscussion discussionId={selectedDiscussionId} onBack={() => setSelectedDiscussionId(null)} />;
  }

  if (loading) return <div className="page-description" style={{ padding: '20px' }}>Cargando foro...</div>;
  if (error) return <div style={{ padding: '20px', color: '#ef4444' }}>{error}</div>;

  return (
    <div className="forum-container">
      <div className="forum-header">
        <h2 style={{ margin: 0, color: 'var(--primary-color)', fontFamily: 'var(--font-titles)' }}>Temas del Foro</h2>
        <button 
          className={`btn-card ${showForm ? 'secondary' : 'primary'}`}
          style={{ width: 'auto', padding: '10px 20px' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '➕ Lanzar un tema'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateTopic} className="widget-card" style={{ marginBottom: '24px' }}>
          <input
            type="text"
            className="forum-input-box"
            placeholder="Título del tema"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            style={{ marginBottom: '16px' }}
            disabled={isSubmitting}
          />
          <textarea
            className="forum-input-box"
            placeholder="Escribí tu mensaje acá..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ minHeight: '120px', marginBottom: '16px', resize: 'vertical' }}
            disabled={isSubmitting}
          />
          <button type="submit" className="btn-success" disabled={isSubmitting || !newSubject.trim() || !newMessage.trim()}>
            {isSubmitting ? 'Publicando...' : 'Publicar tema'}
          </button>
        </form>
      )}

      {(!discussions || discussions.length === 0) && !showForm ? (
        <div className="widget-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
          <p className="page-description" style={{ margin: 0 }}>Todavía no hay temas en este foro. ¡Animate a ser el primero!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {discussions.map((disc) => {
            const authorName = disc.userfullname || disc.author?.fullname || 'Usuario desconocido';
            const timestamp = disc.created || disc.timemodified || 0;
            const dateStr = timestamp ? new Date(timestamp * 1000).toLocaleDateString() : 'Fecha desconocida';

            return (
              <div key={disc.discussion} className="forum-topic-card" onClick={() => setSelectedDiscussionId(disc.discussion)}>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>{disc.name}</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', gap: '16px' }}>
                  <span>👤 {authorName}</span>
                  <span>📅 {dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};