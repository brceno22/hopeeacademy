import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="empty-state fade-in-page">
    <div className="empty-state__icon" aria-hidden>
      {icon}
    </div>
    <h3 className="empty-state__title">{title}</h3>
    {description && <p className="empty-state__desc">{description}</p>}
    {actionLabel && onAction && (
      <button type="button" className="btn-card primary" style={{ maxWidth: 220, margin: '0 auto' }} onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="program-class-grid" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton skeleton-card" />
    ))}
  </div>
);
