import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/database';
import { Icon } from '../components/ui/Icon';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireAdmin = false,
}) => {
  const { isAuthenticated, loading, role, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Icon name="spinner" spin className="text-4xl text-brand-orange" />
          <span className="font-headline text-sm font-semibold text-primary-container">
            Chargement de TUWSHIUAH Workspace...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirige vers /login en mémorisant l'URL demandée
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Vérification de restriction administrateur
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Vérification par liste de rôles autorisés
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : null;
};

export default ProtectedRoute;
