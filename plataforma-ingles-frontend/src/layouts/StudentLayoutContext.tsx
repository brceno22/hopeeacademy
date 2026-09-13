import React, { useCallback, useState } from 'react';
import {
  studentLayoutContext,
  type HeaderTab,
  type StudentLayoutContextValue,
} from './useStudentLayout';

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

  const value: StudentLayoutContextValue = {
    sidebarCollapsed,
    toggleSidebar,
    headerTitle,
    setHeaderTitle,
    headerTabs,
    activeTabId,
    setHeaderTabs,
    setActiveTabId,
    clearHeaderTabs,
  };

  return <studentLayoutContext.Provider value={value}>{children}</studentLayoutContext.Provider>;
};
