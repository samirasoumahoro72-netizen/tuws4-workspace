import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icon';

export const BottomNav: React.FC = () => {
  const tabs = [
    {
      to: '/dashboard',
      label: 'Tableau',
      icon: 'dashboard',
    },
    {
      to: '/projects',
      label: 'Projets',
      icon: 'folder_open',
    },
    {
      to: '/submissions',
      label: 'Livrables',
      icon: 'rule_folder',
      hasAlert: true,
    },
    {
      to: '/files',
      label: 'Fichiers',
      icon: 'cloud',
    },
    {
      to: '/messages',
      label: 'Discussions',
      icon: 'chat_bubble',
      hasBadge: true,
    },
    {
      to: '/team',
      label: 'Équipe',
      icon: 'groups',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 pb-safe bg-surface/85 backdrop-blur-xl border-t border-surface-container/60 shadow-[0_-1px_8px_rgba(0,0,0,0.04)] lg:hidden">
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[44px] min-h-[44px] w-14 h-14 transition-colors gap-0.5 relative ${
                isActive
                  ? 'text-on-tertiary-container font-bold'
                  : 'text-secondary hover:text-primary-container font-medium'
              }`
            }
          >
            <div className="relative">
              <Icon name={tab.icon} className="text-[22px]" />
              {tab.hasBadge && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-on-tertiary-container"></span>
              )}
              {tab.hasAlert && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-brand-orange animate-ping"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
