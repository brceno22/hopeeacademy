import React, { useEffect, useState } from 'react';
import api from '@/core/api/axios';
import { EmptyState } from '@/core/ui/EmptyState';
import { formatRelativeTime, getInitials } from '@/core/utils/format';
import { ForumDiscussion } from './ForumDiscussion';
import '../styles/widgets-forum.css';

interface Discussion {
  discussion: number;
  name: string;
  userfullname?: string;
  author?: { fullname: string };
  created?: number;
  timemodified?: number;
  numreplies?: number;
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

      if (response.data?.discussions) {
        setDiscussions(response.data.discussions);
      } else if (Array.isArray(response.data)) {
        setDiscussions(response.data);
      } else {
        setDiscussions([]);
      }
      setError(null);
    } catch {
      setError('Could not load forum topics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDiscussions();
    setSelectedDiscussionId(null);
  }, [forumId, courseId]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumId || !newSubject.trim() || !newMessage.trim()) return;
    try {
      setIsSubmitting(true);
      await api.post(`/forums/${forumId}/discussions`, {
        subject: newSubject,
        message: newMessage,
      });
      setShowForm(false);
      setNewSubject('');
      setNewMessage('');
      await fetchDiscussions();
    } catch {
      alert('Failed to create the topic. Check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (selectedDiscussionId) {
    return (
      <ForumDiscussion
        discussionId={selectedDiscussionId}
        onBack={() => setSelectedDiscussionId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="forum-container">
        <div className="skeleton skeleton-line" style={{ width: '40%', height: 28, marginBottom: 20 }} />
        <div className="skeleton skeleton-card" style={{ height: 72, marginBottom: 12 }} />
        <div className="skeleton skeleton-card" style={{ height: 72, marginBottom: 12 }} />
        <div className="skeleton skeleton-card" style={{ height: 72 }} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="💬"
        title="Could not load the forum"
        description={error}
        actionLabel="Try again"
        onAction={() => void fetchDiscussions()}
      />
    );
  }

  return (
    <div className="forum-container">
      <div className="forum-header">
        <h2>Forum topics</h2>
        {forumId ? (
          <button
            type="button"
            className={`btn-card ${showForm ? 'secondary' : 'primary'}`}
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Start a topic'}
          </button>
        ) : null}
      </div>

      {showForm && forumId && (
        <form onSubmit={handleCreateTopic} className="widget-card">
          <input
            type="text"
            className="forum-input-box"
            placeholder="Topic title"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            style={{ marginBottom: '16px' }}
            disabled={isSubmitting}
          />
          <textarea
            className="forum-input-box"
            placeholder="Write your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ minHeight: '120px', marginBottom: '16px', resize: 'vertical' }}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="btn-success"
            disabled={isSubmitting || !newSubject.trim() || !newMessage.trim()}
          >
            {isSubmitting ? 'Publishing...' : 'Publish topic'}
          </button>
        </form>
      )}

      {discussions.length === 0 && !showForm ? (
        <EmptyState
          icon="💬"
          title="No topics yet"
          description="Be the first to start a conversation."
          actionLabel={forumId ? 'Create topic' : undefined}
          onAction={forumId ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="forum-thread-list">
          {discussions.map((disc) => {
            const authorName = disc.userfullname || disc.author?.fullname || 'User';
            const timestamp = disc.created || disc.timemodified || 0;
            return (
              <button
                key={disc.discussion}
                type="button"
                className="forum-topic-card"
                onClick={() => setSelectedDiscussionId(disc.discussion)}
              >
                <div className="forum-avatar">{getInitials(authorName)}</div>
                <div>
                  <h3>{disc.name}</h3>
                  <div className="forum-meta">
                    <span>{authorName}</span>
                    <span>{formatRelativeTime(timestamp)}</span>
                    {typeof disc.numreplies === 'number' && (
                      <span>{disc.numreplies} replies</span>
                    )}
                  </div>
                </div>
                <span className="forum-chevron" aria-hidden>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
