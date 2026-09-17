import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { filesService } from '../../services/filesService';

export const Sidebar: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [counts, setCounts] = useState({
    projects: 0,
    submissions: 0,
    messages: 0,
    team: 0,
    files: 0,
  });

  useEffect(() => {
    let mounted = true;

    const fetchCounts = async () => {
      let fileCount = 0;
      try {
        const fileList = await filesService.getAllFiles(undefined, user?.id);
        fileCount = fileList.length;
      } catch {}

      if (!isSupabaseConfigured) {
        if (mounted) setCounts({ projects: 0, submissions: 0, messages: 0, team: 0, files: fileCount });
        return;
      }

      try {
        const [projRes, subRes, profRes] = await Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
        ]);

        if (mounted) {
          setCounts({
            projects: projRes.count ?? 0,
            submissions: subRes.count ?? 0,
            messages: 0,
            team: profRes.count ?? 0,
            files: fileCount,
          });
        }
      } catch {
        if (mounted) {
          setCounts({ projects: 0, submissions: 0, messages: 0, team: 0, files: fileCount });
        }
      }
    };

    fetchCounts();

    const handleRefresh = () => fetchCounts();
    window.addEventListener('tuws_projects_updated', handleRefresh);
    window.addEventListener('tuws_submissions_updated', handleRefresh);
    window.addEventListener('tuws_files_updated', handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener('tuws_projects_updated', handleRefresh);
      window.removeEventListener('tuws_submissions_updated', handleRefresh);
      window.removeEventListener('tuws_files_updated', handleRefresh);
    };
  }, [user]);

  const navItems = [
    {
      to: '/dashboard',
      label: 'Tableau de bord',
      icon: 'dashboard',
    },
    {
      to: '/projects',
      label: 'Projets',
      icon: 'folder_open',
      badge: String(counts.projects),
    },
    {
      to: '/submissions',
      label: isAdmin ? 'Validations' : 'Mes Livrables',
      icon: 'rule_folder',
      badge: isAdmin ? String(counts.submissions) : undefined,
      badgeColor: counts.submissions > 0 ? 'bg-on-tertiary-container text-on-primary' : 'bg-surface-container text-secondary',
    },
    {
      to: '/files',
      label: 'Fichiers & Docs',
      icon: 'cloud',
      badge: String(counts.files),
    },
    {
      to: '/messages',
      label: 'Discussions',
      icon: 'chat_bubble',
      badge: String(counts.messages),
    },
    {
      to: '/team',
      label: 'Équipe',
      icon: 'groups',
      badge: String(counts.team),
    },
    {
      to: '/activity',
      label: 'Flux d’Activité',
      icon: 'history',
    },
    {
      to: '/settings',
      label: 'Paramètres',
      icon: 'settings',
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-surface-container-lowest border-r border-surface-container h-[calc(100vh-4rem)] fixed top-16 left-0 z-30 p-4 overflow-y-auto no-scrollbar">
      <div className="flex flex-col gap-1.5">
        <div className="px-3 py-2 text-[11px] font-bold text-secondary uppercase tracking-wider">
          Navigation Workspace
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary shadow-sm'
                  : 'text-secondary hover:text-primary-container hover:bg-surface-container'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <Icon
                    name={item.icon}
                    className={`text-[20px] ${isActive ? 'text-tertiary-fixed-dim' : 'text-secondary'}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
