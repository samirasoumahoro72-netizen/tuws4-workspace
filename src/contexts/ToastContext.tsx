import React, { createContext, useContext, useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
}

interface ToastContextType {
  showToast: (message: string, icon?: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, icon = 'check_circle', type: Toast['type'] = 'success') => {
    const id = Math.random().toString();
    setToast({ id, message, icon, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2800);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed bottom-20 md:bottom-8 left-4 right-4 md:left-auto md:right-8 z-50 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-primary-container text-on-primary px-space-md py-space-sm rounded-xl shadow-xl flex items-center gap-space-sm max-w-md border border-white/10">
            <Icon
              name={toast.icon || 'check_circle'}
              className="text-[18px] text-brand-orange"
            />
            <span className="font-body-sm text-sm font-medium flex-1 truncate">
              {toast.message}
            </span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
