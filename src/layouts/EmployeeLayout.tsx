import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from './MainLayout';
import { Icon } from '../components/ui/Icon';

export const EmployeeLayout: React.FC = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Icon name="spinner" spin className="text-4xl text-brand-orange" />
          <span className="font-headline text-sm font-semibold text-primary-container">
            Chargement de l'espace collaborateur...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout />;
};

export default EmployeeLayout;
