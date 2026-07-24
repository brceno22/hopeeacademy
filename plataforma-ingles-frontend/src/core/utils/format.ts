/** Relative date in English (Moodle Unix timestamps in seconds). */
export function formatRelativeTime(unixSeconds?: number | null): string {
  if (!unixSeconds || unixSeconds <= 0) return 'Unknown date';

  const date = new Date(unixSeconds * 1000);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} ${diffWeek === 1 ? 'week' : 'weeks'} ago`;

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export type ProgressStatus = 'completed' | 'in-progress' | 'available' | 'locked';

export function progressStatus(percentage?: number | null): ProgressStatus {
  if (percentage == null) return 'available';
  if (percentage >= 100) return 'completed';
  if (percentage > 0) return 'in-progress';
  return 'available';
}

export function progressLabel(status: ProgressStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in-progress':
      return 'In progress';
    case 'locked':
      return 'Locked';
    default:
      return 'Available';
  }
}

export function resourceIcon(type?: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('forum') || t === 'foro') return '💬';
  if (t.includes('assign') || t === 'tarea') return '📝';
  if (t.includes('quiz') || t.includes('exam') || t === 'test') return '✅';
  if (t.includes('pdf') || t === 'resource') return '📄';
  if (t.includes('video') || t.includes('url')) return '🎬';
  if (t.includes('lesson') || t.includes('page')) return '📖';
  return '📘';
}
