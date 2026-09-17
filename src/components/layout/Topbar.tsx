import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';
import { Notification } from '../../types/database';
import { notificationsService } from '../../services/notificationsService';
import { formatRelativeTime } from '../../lib/utils';
import { isSupabaseConfigured } from '../../lib/supabase';

interface TopbarProps {
  pageTitle?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ pageTitle = 'Dashboard' }) => {
  const isExplicitDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';
  const isDemoMode = isExplicitDemo || (!isExplicitProd && !isSupabaseConfigured);

  const { user, profile, isAdmin, signOut, availableProfiles, switchUser } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotificationsData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [count, notifs] = await Promise.all([
        notificationsService.getUnreadCount(user.id),
        notificationsService.getAll(user.id),
      ]);
      setUnreadCount(count);
      setRecentNotifications(notifs.slice(0, 10));
    } catch (err) {
      console.error('Erreur chargement notifications Topbar:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotificationsData();

    const unsubscribe = notificationsService.subscribeToNotifications(user?.id, () => {
      loadNotificationsData();
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user?.id, loadNotificationsData]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await notificationsService.markAllAsRead(user.id);
      setUnreadCount(0);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Erreur markAllAsRead:', err);
    }
  };

  const handleOpenNotification = async (n: Notification) => {
    setShowNotificationsMenu(false);
    if (!n.is_read) {
      try {
        await notificationsService.markAsRead(n.id, user?.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setRecentNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
      } catch (err) {
        console.error('Erreur markAsRead:', err);
      }
    }

    if (n.link) {
      navigate(n.link);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl border-b border-surface-container/60 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-3">
        {/* Left: Logo & Context Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="shrink-0 flex items-center">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="hidden sm:flex items-center gap-2 border-l border-surface-container pl-3">
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-container text-[10px] font-bold tracking-wider shrink-0 uppercase">
              Workspace Privé
            </span>
            <span className="text-xs text-secondary font-medium truncate">
              {pageTitle}
            </span>
          </div>
        </div>

        {/* Centre / Indicateur de rôle officiel ou sélecteur démo */}
        {isDemoMode ? (
          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-semibold text-primary-container shadow-xs"
              title="Changer de profil / rôle rapidement"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden md:inline">Rôle actif :</span>
              <span className="font-bold text-on-tertiary-container">
                {isAdmin ? 'Direction (Admin)' : 'Collaborateur'}
              </span>
              <Icon name="swap_horiz" className="text-[16px] text-secondary" />
            </button>

            {showRoleSwitcher && (
              <div
                className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 w-64 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container p-2 z-50 animate-in fade-in"
                onClick={() => setShowRoleSwitcher(false)}
              >
                <div className="px-2 py-1.5 text-[11px] font-bold text-secondary uppercase tracking-wider border-b border-surface-container mb-1">
                  Changer d'utilisateur (Démo)
                </div>
                {availableProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => switchUser(p.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs transition-colors ${
                      (profile?.id === p.id || user?.id === p.id)
                        ? 'bg-surface-container text-primary-container font-bold'
                        : 'hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <img src={p.avatar_url} alt={p.full_name} className="w-6 h-6 rounded-full object-cover" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-medium">{p.full_name}</span>
                      <span className="text-[10px] text-secondary truncate">
                        {p.role?.toLowerCase() === 'admin' ? (
                          <span className="inline-flex items-center text-brand-orange font-semibold">
                            <Icon name="crown" className="mr-1 text-[9px]" /> Direction (Admin)
                          </span>
                        ) : (
                          p.job_title
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-semibold text-primary-container shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="hidden md:inline text-secondary font-medium">Rôle :</span>
            <span className="font-bold text-on-tertiary-container">
              {isAdmin ? 'Direction (Admin)' : (profile?.job_title || (user as any)?.user_metadata?.job_title || 'Collaborateur')}
            </span>
          </div>
        )}

        {/* Right: Notification Bell & Profile Avatar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Menu & Cloche de notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-secondary hover:text-primary-container hover:bg-surface-container transition-colors relative cursor-pointer"
              title="Centre de notifications"
            >
              <Icon name="notifications" className="text-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-on-tertiary-container text-white text-[10px] font-bold flex items-center justify-center shadow-xs ring-2 ring-surface">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotificationsMenu && (
              <div
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
              >
                <div className="p-3.5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/30">
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-xs font-bold text-primary-container">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange text-[10px] font-bold">
                        {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-brand-orange hover:underline cursor-pointer"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-surface-container/60">
                  {recentNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-secondary p-4">
                      Aucune notification pour le moment.
                    </div>
                  ) : (
                    recentNotifications.map((n) => {
                      const iconName =
                        n.type === 'PROJECT'
                          ? 'rocket_launch'
                          : n.type === 'VALIDATION'
                          ? 'verified'
                          : n.type === 'SUBMISSION'
                          ? 'rule_folder'
                          : 'chat_bubble';

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleOpenNotification(n)}
                          className={`p-3 sm:p-3.5 flex items-start gap-3 hover:bg-surface-container-low/70 cursor-pointer transition-colors ${
                            !n.is_read ? 'bg-brand-orange/5' : ''
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                              !n.is_read
                                ? 'bg-brand-orange text-white shadow-xs'
                                : 'bg-surface-container text-secondary'
                            }`}
                          >
                            <Icon name={iconName} className="text-sm" />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs truncate ${
                                  !n.is_read
                                    ? 'font-bold text-primary-container'
                                    : 'font-semibold text-on-surface'
                                }`}
                              >
                                {n.title}
                              </span>
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-secondary line-clamp-2 mt-0.5">
                              {n.message}
                            </p>
                            <span className="text-[10px] text-secondary/80 font-mono mt-1">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-surface-container bg-surface-container-low/40 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotificationsMenu(false)}
                    className="inline-flex items-center justify-center w-full py-1.5 text-xs font-bold text-primary-container hover:text-brand-orange transition-colors"
                  >
                    Voir tout le centre de notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative w-10 h-10 flex items-center justify-center rounded-full ring-2 ring-surface-container hover:ring-brand-orange transition-all"
            >
              <img
                alt={profile?.full_name || 'Profile'}
                className="w-8 h-8 rounded-full object-cover"
                src={
                  profile?.avatar_url ||
                  (user as any)?.user_metadata?.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.full_name || user?.email || 'user')}`
                }
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container p-1.5 z-50 animate-in fade-in"
                onClick={() => setShowProfileMenu(false)}
              >
                <div className="p-2 border-b border-surface-container">
                  <div className="font-headline text-xs font-bold text-primary-container truncate">
                    {profile?.full_name || (user as any)?.user_metadata?.full_name || user?.email}
                  </div>
                  <div className="text-[11px] text-secondary truncate">{profile?.email || user?.email}</div>
                  <div className="mt-1">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-semibold text-primary-container">
                      {isAdmin ? 'Direction Générale' : (profile?.job_title || (user as any)?.user_metadata?.job_title || 'Collaborateur')}
                    </span>
                  </div>
                </div>

                <div className="py-1 flex flex-col gap-0.5">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <Icon name="person" className="text-[18px] text-secondary" />
                    <span>Mon Profil</span>
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <Icon name="settings" className="text-[18px] text-secondary" />
                    <span>Paramètres</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-error hover:bg-error-container/40 transition-colors text-left"
                  >
                    <Icon name="logout" className="text-[18px]" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
