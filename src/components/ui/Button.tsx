import React from 'react';
import { Icon } from './Icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'orange' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-primary-container text-on-primary hover:opacity-95 shadow-sm active:scale-95',
    orange: 'bg-on-tertiary-container text-on-primary hover:opacity-95 shadow-md active:scale-95',
    secondary: 'bg-surface-container text-primary-container hover:bg-surface-container-high active:scale-95',
    outline: 'border border-outline-variant text-on-surface hover:bg-surface-container-low active:scale-95',
    success: 'bg-emerald-600 text-on-primary hover:bg-emerald-700 shadow-sm active:scale-95',
    danger: 'bg-error text-on-primary hover:opacity-90 active:scale-95',
    ghost: 'text-secondary hover:text-on-surface hover:bg-surface-container/50 active:scale-95',
  };

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1 font-semibold',
    md: 'h-10 px-4 text-sm rounded-lg gap-1.5 font-semibold',
    lg: 'h-12 px-5 text-base rounded-xl gap-2 font-bold',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Icon name="spinner" spin className="text-[16px]" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <Icon name={icon} className="text-[18px]" />}
          {children}
          {icon && iconPosition === 'right' && <Icon name={icon} className="text-[18px]" />}
        </>
      )}
    </button>
  );
};
