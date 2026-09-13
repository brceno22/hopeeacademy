import { createContext, useContext } from 'react';

export interface HeaderTab {
  id: string;
  label: string;
}

export interface StudentLayoutContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  headerTitle: string;
  setHeaderTitle: (title: string) => void;
  headerTabs: HeaderTab[];
  activeTabId: string | null;
  setHeaderTabs: (tabs: HeaderTab[], activeId?: string) => void;
  setActiveTabId: (id: string) => void;
  clearHeaderTabs: () => void;
}

export const studentLayoutContext = createContext<StudentLayoutContextValue | null>(null);

export function useStudentLayout(): StudentLayoutContextValue {
  const ctx = useContext(studentLayoutContext);
  if (!ctx) throw new Error('useStudentLayout must be used within StudentLayout');
  return ctx;
}
