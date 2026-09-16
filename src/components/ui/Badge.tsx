import React from 'react';
import { ProjectStatus, SubmissionStatus } from '../../types/database';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'warning' | 'error' | 'success' | 'orange' | 'outline';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'secondary',
  size = 'sm',
  pulse = false,
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-primary-container text-on-primary',
    secondary: 'bg-surface-container text-primary-container',
    warning: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    error: 'bg-error-container text-on-error-container',
    success: 'bg-emerald-100 text-emerald-800',
    orange: 'bg-on-tertiary-container text-on-primary',
    outline: 'border border-outline-variant text-secondary bg-transparent',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: ProjectStatus | SubmissionStatus }> = ({ status }) => {
  switch (status) {
    case 'IN_PROGRESS':
      return (
        <Badge variant="primary" pulse>
          En cours
        </Badge>
      );
    case 'TODO':
      return <Badge variant="secondary">À faire</Badge>;
    case 'COMPLETED':
    case 'APPROVED':
      return <Badge variant="success">Validé / Terminé</Badge>;
    case 'DELAYED':
      return (
        <Badge variant="error" pulse>
          En retard
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="warning" pulse>
          En attente
        </Badge>
      );
    case 'CHANGES_REQUESTED':
      return <Badge variant="warning">Modifs demandées</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};
