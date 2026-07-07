//ForumDiscussion.tsx
import React, { useState, useEffect } from 'react';
import api from '../../../core/api/axios';
import '../styles/widgets-forum.css';

interface Post {
  id: number;
  subject: string;
  message: string;
  authorfullname?: string;
  userfullname?: string;
  author?: { fullname: string; };
  created?: number;
  timecreated?: number;
}

interface ForumDiscussionProps {
  discussionId: number;
  onBack: () => void;
}

export const ForumDiscussion: React.FC<ForumDiscussionProps> = ({ discussionId, onBack }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/forums/discussions/${discussionId}/posts`);
      setPosts(response.data);
      setError(null);
    } catch (err) {
      setError('Hubo un error al cargar los mensajes del foro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [discussionId]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || posts.length === 0) return;
    try {
      setIsSubmitting(true);
      const parentPostId = posts[0].id; 
      await api.post(`/forums/discussions/posts/${parentPostId}/reply`, { message: replyMessage });
      setReplyMessage('');
      await fetchPosts(); 
    } catch (err) {
      alert('Error al enviar la respuesta. Intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="page-description" style={{ padding: '20px' }}>Cargando mensajes...</div>;
  if (error) return <div style={{ padding: '20px', color: '#ef4444' }}>{error}</div>;

  return (
    <div className="forum-container">
      <button className="btn-back" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <span>←</span> Volver a los temas
      </button>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {posts.map((post, index) => {
          const authorName = post.author?.fullname || post.userfullname || post.authorfullname || 'Usuario desconocido';
          const timestamp = post.timecreated || post.created || 0;
          const dateStr = timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Fecha desconocida';

          return (
            <div key={post.id} className={`forum-post ${index === 0 ? 'highlight' : ''}`}>
              <div className="forum-post-header">
                <span className="forum-post-author">👤 {authorName}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{dateStr}</span>
              </div>
              <div className="html-content-render" style={{ lineHeight: '1.6', color: 'var(--text-main)' }} dangerouslySetInnerHTML={{ __html: post.message }} />
            </div>
          );
        })}
      </div>

      <form onSubmit={handleReply} style={{ display: 'flex', gap: '12px', marginTop: 'auto', background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <input
          type="text"
          className="forum-input-box"
          value={replyMessage}
          onChange={(e) => setReplyMessage(e.target.value)}
          placeholder="Escribí tu respuesta acá..."
          disabled={isSubmitting}
          style={{ margin: 0, border: 'none', boxShadow: 'none' }}
        />
        <button type="submit" className="btn-card primary" style={{ width: 'auto', padding: '12px 24px' }} disabled={isSubmitting || !replyMessage.trim()}>
          {isSubmitting ? 'Enviando...' : 'Responder 📤'}
        </button>
      </form>
    </div>
  );
};