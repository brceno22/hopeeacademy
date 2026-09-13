import { useQuery } from '@tanstack/react-query';
import api from '@/core/api/axios';

export interface RecordingItem {
  id: number;
  folderId: number;
  folderName: string | null;
  title: string;
  driveUrl: string;
  embedUrl: string | null;
  recordedAt: string | null;
}

export interface RecordingGroup {
  folderId: number;
  folderName: string;
  parentId: number | null;
  recordings: RecordingItem[];
}

export const recordingsKeys = {
  all: ['recordings'] as const,
  list: () => [...recordingsKeys.all, 'list'] as const,
};

async function fetchRecordings(): Promise<RecordingGroup[]> {
  const res = await api.get<RecordingGroup[]>('/recordings');
  return res.data;
}

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: recordingsKeys.list(),
    queryFn: fetchRecordings,
    enabled,
  });
}
