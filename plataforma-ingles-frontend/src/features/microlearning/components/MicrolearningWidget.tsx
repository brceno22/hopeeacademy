import React, { useMemo, useState } from 'react';
import {
  useCompleteMicrolearning,
  useMicrolearningToday,
} from '@/core/hooks/useMicrolearningToday';
import { EmptyState } from '@/core/ui/EmptyState';
import '@/features/microlearning/styles/microlearning.css';

function estimateMinutes(content?: string | null, type?: string): number {
  if (type === 'audio') return 2;
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(5, Math.ceil(words / 40) || 1));
}

function detectLevel(title?: string, explicit?: string): string | null {
  if (explicit) return explicit.toUpperCase();
  const match = (title || '').match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  return match ? match[1].toUpperCase() : null;
}

export const MicrolearningWidget: React.FC = () => {
  const { data, isLoading, isError, refetch } = useMicrolearningToday();
  const completeMutation = useCompleteMicrolearning();
  const [showTranslation, setShowTranslation] = useState(false);

  const eta = useMemo(
    () => estimateMinutes(data?.content?.content, data?.content?.type),
    [data?.content?.content, data?.content?.type],
  );
  const level = useMemo(
    () => detectLevel(data?.content?.title, data?.content?.level),
    [data?.content?.title, data?.content?.level],
  );

  if (isLoading) {
    return (
      <div className="ml-bite" aria-busy="true">
        <div className="skeleton skeleton-line" style={{ width: '40%', height: 12 }} />
        <div className="skeleton skeleton-line" style={{ width: '70%', height: 28, marginTop: 12 }} />
        <div className="skeleton skeleton-line" style={{ width: '100%', height: 64, marginTop: 20 }} />
        <div className="skeleton skeleton-line" style={{ width: '50%', height: 44, marginTop: 24, borderRadius: 12 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚡"
        title="Couldn't load your daily bite"
        description="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void refetch()}
      />
    );
  }

  if (!data?.content) {
    return (
      <EmptyState
        icon="☕"
        title="No bite for today"
        description="No microlearning content is available yet. Come back later."
      />
    );
  }

  const handleComplete = () => {
    if (!data.content) return;
    completeMutation.mutate(data.content.id, {
      onError: () => alert('Failed to save progress'),
    });
  };

  return (
    <article className="ml-bite" key={data.content.id}>
      <div className="ml-bite__top">
        <div>
          <p className="ml-bite__eyebrow">🔥 Daily bite</p>
          <h3 className="ml-bite__title">{data.content.title}</h3>
        </div>
        <div className="ml-bite__meta">
          {level && <span className="ml-chip level">Level {level}</span>}
          <span className="ml-chip eta">⏱ ~{eta} min</span>
          <span className="ml-chip">
            {data.content.type === 'audio'
              ? '🎧 Audio'
              : data.content.type === 'phrasal_verb'
                ? '💬 Phrasal'
                : '📚 Vocab'}
          </span>
        </div>
      </div>

      <p className="ml-bite__body">{data.content.content}</p>

      {data.content.type === 'audio' && data.content.audioUrl && (
        <audio controls className="ml-bite__audio">
          <source src={data.content.audioUrl} type="audio/mpeg" />
        </audio>
      )}

      <div className="ml-bite__footer">
        {data.todayCompleted ? (
          <>
            <div className="success-badge" style={{ width: '100%', justifyContent: 'center' }}>
              Bite completed! Come back tomorrow for more
            </div>
            <p className="ml-streak-hint">Current streak: {data.currentStreak} days 🔥</p>
          </>
        ) : (
          <>
            {data.content.translation && (
              <>
                <button
                  type="button"
                  className="ml-toggle"
                  onClick={() => setShowTranslation((v) => !v)}
                >
                  {showTranslation ? 'Hide translation' : 'Show translation'}
                </button>
                {showTranslation && (
                  <p className="ml-translation">{data.content.translation}</p>
                )}
              </>
            )}
            <button
              type="button"
              className="btn-card primary"
              onClick={handleComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending
                ? 'Saving…'
                : 'Got it! +1 day to my streak'}
            </button>
          </>
        )}
      </div>
    </article>
  );
};
