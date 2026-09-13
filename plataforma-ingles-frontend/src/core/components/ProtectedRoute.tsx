import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/context/auth';

export const ProtectedStudentRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { adminStatus } = useAuth();
  const location = useLocation();

  // La sesión vive en una cookie HttpOnly: hay que esperar la respuesta del
  // backend antes de decidir, o expulsaríamos al admin en cada recarga.
  if (adminStatus === 'unknown') {
    return <div className="admin-session-loading">Checking session…</div>;
  }

  if (adminStatus === 'anonymous') {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
