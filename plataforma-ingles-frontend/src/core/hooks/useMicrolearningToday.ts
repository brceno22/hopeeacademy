import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api/axios';

export interface MicroContent {
  id: number;
  title: string;
  type: 'vocabulary' | 'phrasal_verb' | 'audio' | string;
  content: string;
  translation?: string;
  audioUrl?: string;
  level?: string;
}

export interface MicrolearningToday {
  content: MicroContent | null;
  todayCompleted: boolean;
  currentStreak: number;
}

export const microlearningKeys = {
  all: ['microlearning'] as const,
  today: () => [...microlearningKeys.all, 'today'] as const,
};

async function fetchToday(): Promise<MicrolearningToday> {
  const res = await api.get<MicrolearningToday>('/microlearning/today');
  return res.data;
}

export function useMicrolearningToday(enabled = true) {
  return useQuery({
    queryKey: microlearningKeys.today(),
    queryFn: fetchToday,
    enabled,
  });
}

export function useCompleteMicrolearning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contentId: number) => {
      const res = await api.post('/microlearning/complete', { contentId });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: microlearningKeys.today() });
    },
  });
}
