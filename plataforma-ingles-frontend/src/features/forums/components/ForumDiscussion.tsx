import React, { useEffect, useState } from 'react';
import api from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import { sanitizeHtml } from '@/core/utils/sanitize';
import { formatRelativeTime, getInitials } from '@/core/utils/format';
import '../styles/widgets-forum.css';

interface Post {
  id: number;
  subject: string;
  message: string;
  authorfullname?: string;
  userfullname?: string;
  author?: { fullname: string };
  created?: number;
  timecreated?: number;
  /** Moodle capability flag when present */
  canreply?: boolean | number;
}

interface ForumDiscussionProps {
  discussionId: number;
  onBack: () => void;
}

export const ForumDiscussion: React.FC<ForumDiscussionProps> = ({
  discussionId,
  onBack,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/forums/discussions/${discussionId}/posts`);
      setPosts(Array.isArray(response.data) ? response.data : response.data?.posts || []);
      setError(null);
    } catch {
      setError('There was an error loading the forum messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPosts();
  }, [discussionId]);

  const canReply =
    posts.length > 0 &&
    posts.some((p) => p.canreply === true || p.canreply === 1);

  // If Moodle omits canreply, keep the form (server will enforce).
  const replyAllowed =
    posts.length === 0 || posts.every((p) => p.canreply === undefined)
      ? true
      : canReply;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || posts.length === 0 || !replyAllowed) return;
    try {
      setIsSubmitting(true);
      const parentPost = posts[0];
      const parentSubject = parentPost.subject?.trim();
      const replySubject = parentSubject
        ? parentSubject.toLowerCase().startsWith('re:')
          ? parentSubject
          : `Re: ${parentSubject}`
        : 'Re:';
      await api.post(`/forums/discussions/posts/${parentPost.id}/reply`, {
        message: replyMessage,
        subject: replySubject.slice(0, 255),
      });
      setReplyMessage('');
      await fetchPosts();
    } catch (err: unknown) {
      const raw =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to send the reply. Please try again.';
      alert(Array.isArray(raw) ? raw.join(', ') : String(raw));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="forum-container">
        <div className="skeleton skeleton-card" style={{ height: 120, marginBottom: 12 }} />
        <div className="skeleton skeleton-card" style={{ height: 90 }} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="💬"
        title="Could not load messages"
        description={error}
        actionLabel="Try again"
        onAction={() => void fetchPosts()}
      />
    );
  }

  return (
    <div className="forum-container">
      <button type="button" className="btn-back" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <span>←</span> Back to topics
      </button>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {posts.map((post, index) => {
          const authorName =
            post.author?.fullname || post.userfullname || post.authorfullname || 'User';
          const timestamp = post.timecreated || post.created || 0;
          const isCollapsed = Boolean(collapsed[post.id]);

          return (
            <article
              key={post.id}
              className={`forum-post ${index === 0 ? 'highlight' : ''}`}
            >
              <header
                className="forum-post-header"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                }
              >
                <div className="forum-post-author-wrap">
                  <div className={`forum-avatar ${index === 0 ? '' : 'reply'}`}>
                    {getInitials(authorName)}
                  </div>
                  <div>
                    <div className="forum-post-author">{authorName}</div>
                    <div className="forum-meta">{formatRelativeTime(timestamp)}</div>
                  </div>
                </div>
                <span className="forum-chevron" aria-hidden>
                  {isCollapsed ? '▸' : '▾'}
                </span>
              </header>
              <div
                className={`forum-post-body html-content-render ${isCollapsed ? 'is-collapsed' : ''}`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.message) }}
              />
            </article>
          );
        })}
      </div>

      {replyAllowed ? (
        <form onSubmit={handleReply} className="forum-reply-bar">
          <input
            type="text"
            className="forum-input-box"
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Write your reply here..."
            disabled={isSubmitting}
            style={{ margin: 0, border: 'none', boxShadow: 'none', background: 'var(--bg-color)' }}
          />
          <button
            type="submit"
            className="btn-card primary"
            style={{ width: 'auto', padding: '12px 24px' }}
            disabled={isSubmitting || !replyMessage.trim()}
          >
            {isSubmitting ? 'Sending...' : 'Reply'}
          </button>
        </form>
      ) : (
        <p className="forum-meta" style={{ margin: 0, padding: '12px 0' }}>
          Replies are not allowed in this forum (Moodle permissions or announcements-only forum).
        </p>
      )}
    </div>
  );
};
