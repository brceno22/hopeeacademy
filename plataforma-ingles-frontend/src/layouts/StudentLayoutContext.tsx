import React, { createContext, useContext, useState, useCallback } from 'react';

export interface HeaderTab {
  id: string;
  label: string;
}

interface StudentLayoutContextValue {
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

const StudentLayoutContext = createContext<StudentLayoutContextValue | null>(null);

export const StudentLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('Home');
  const [headerTabs, setHeaderTabsState] = useState<HeaderTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((c) => !c), []);

  const setHeaderTabs = useCallback((tabs: HeaderTab[], activeId?: string) => {
    setHeaderTabsState(tabs);
    setActiveTabId(activeId ?? tabs[0]?.id ?? null);
  }, []);

  const clearHeaderTabs = useCallback(() => {
    setHeaderTabsState([]);
    setActiveTabId(null);
  }, []);

  return (
    <StudentLayoutContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        headerTitle,
        setHeaderTitle,
        headerTabs,
        activeTabId,
        setHeaderTabs,
        setActiveTabId,
        clearHeaderTabs,
      }}
    >
      {children}
    </StudentLayoutContext.Provider>
  );
};

export function useStudentLayout() {
  const ctx = useContext(StudentLayoutContext);
  if (!ctx) throw new Error('useStudentLayout must be used within StudentLayout');
  return ctx;
}
