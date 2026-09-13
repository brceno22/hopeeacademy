import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';

export interface CalendarOccurrence {
  id: string;
  source: 'shift' | 'event';
  sourceId: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  meetUrl: string | null;
  shiftId: number;
  shiftName: string;
  folderName: string | null;
  googleUrl?: string;
}

export const calendarKeys = {
  all: ['calendar'] as const,
  me: (from: string, to: string) => [...calendarKeys.all, 'me', from, to] as const,
};

async function fetchCalendarMe(from: string, to: string): Promise<CalendarOccurrence[]> {
  const res = await api.get<CalendarOccurrence[]>('/calendar/me', { params: { from, to } });
  return res.data;
}

export function useCalendarMe(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: calendarKeys.me(from, to),
    queryFn: () => fetchCalendarMe(from, to),
    enabled,
  });
}
