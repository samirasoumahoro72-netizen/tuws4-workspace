import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notificationsService } from '../../services/notificationsService';
import { Notification } from '../../types/database';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { formatRelativeTime } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

type FilterTab = 'ALL' | 'UNREAD' | 'MESSAGE' | 'FILE' | 'PROJECT';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationsService.getAll(user?.id);
      setNotifications(data);
    } catch (err) {
      console.error('Erreur chargement notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();

    const unsubscribe = notificationsService.subscribeToNotifications(user?.id, () => {
      loadNotifications();
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, loadNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead(user?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('Toutes les notifications ont été marquées comme lues', 'success');
    } catch (err) {
      console.error(err);
      showToast('Impossible de marquer comme lues', 'error');
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await notificationsService.markAsRead(notif.id, user?.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error('Erreur marquage notification:', err);
      }
    }

    if (notif.link) {
      navigate(notif.link);
    }
  };

  const typeIcons: Record<string, string> = {
    SUBMISSION: 'rule_folder',
    VALIDATION: 'verified',
    MESSAGE: 'chat_bubble',
    PROJECT: 'rocket_launch',
    SYSTEM: 'info',
    FILE: 'folder_shared',
  };

  const typeColors: Record<string, string> = {
    SUBMISSION: 'bg-amber-600',
    VALIDATION: 'bg-emerald-600',
    MESSAGE: 'bg-primary-container',
    PROJECT: 'bg-blue-600',
    SYSTEM: 'bg-slate-600',
    FILE: 'bg-brand-orange',
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'UNREAD') return !notif.is_read;
    if (activeTab === 'MESSAGE') return notif.type === 'MESSAGE';
    if (activeTab === 'FILE') return notif.type === 'FILE';
    if (activeTab === 'PROJECT') return notif.type === 'PROJECT';
    return true;
  });

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-primary-container tracking-tight">
            Centre de Notifications
          </h1>
          <p className="text-sm text-secondary mt-1">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Toutes vos notifications sont à jour'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon="done_all"
            onClick={handleMarkAllAsRead}
            className="self-start sm:self-auto"
          >
            Tout marquer lu
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'ALL'
              ? 'bg-primary-container text-white shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span>Toutes</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
          }`}>
            {notifications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('UNREAD')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'UNREAD'
              ? 'bg-primary-container text-white shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span>Non lues</span>
          {unreadCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'UNREAD' ? 'bg-white text-primary-container' : 'bg-red-500 text-white'
            }`}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('MESSAGE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'MESSAGE'
              ? 'bg-primary-container text-white shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <Icon name="chat_bubble" className="text-sm" />
          <span>Messages</span>
        </button>

        <button
          onClick={() => setActiveTab('FILE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'FILE'
              ? 'bg-primary-container text-white shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <Icon name="folder_shared" className="text-sm" />
          <span>Fichiers</span>
        </button>

        <button
          onClick={() => setActiveTab('PROJECT')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'PROJECT'
              ? 'bg-primary-container text-white shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <Icon name="rocket_launch" className="text-sm" />
          <span>Projets</span>
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex flex-col gap-3 py-8 items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary-container border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-secondary">Chargement des notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-outline/30 bg-surface-container-lowest flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-secondary mb-3">
            <Icon name="notifications_off" className="text-2xl" />
          </div>
          <p className="text-sm font-semibold text-on-surface">Aucune notification</p>
          <p className="text-xs text-secondary max-w-xs mt-1">
            {activeTab === 'UNREAD'
              ? "Vous n'avez aucune notification non lue pour le moment."
              : "Aucune notification n'a été trouvée pour ce filtre."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer group ${
                notif.is_read
                  ? 'bg-surface-container-lowest/80 border-surface-container text-secondary hover:bg-surface-container-low/60 hover:text-on-surface'
                  : 'bg-surface-container-lowest border-primary-container/30 shadow-sm hover:shadow-md hover:border-primary-container text-on-surface'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl ${
                  typeColors[notif.type] || 'bg-secondary'
                } text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}
              >
                <Icon name={typeIcons[notif.type] || 'info'} className="text-[20px]" />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-semibold tracking-tight ${
                        notif.is_read ? 'text-on-surface/80' : 'text-on-surface font-bold'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-surface-container text-secondary">
                      {notif.type}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                  )}
                </div>

                <p className="text-xs text-secondary mt-1 leading-relaxed line-clamp-2 group-hover:text-on-surface transition-colors">
                  {notif.message}
                </p>

                <div className="flex items-center gap-3 mt-2.5">
                  <span className="text-[11px] text-secondary/70 font-mono">
                    {formatRelativeTime(notif.created_at)}
                  </span>
                  {notif.link && (
                    <span className="text-[11px] text-primary-container font-medium flex items-center gap-0.5 group-hover:underline">
                      Ouvrir <Icon name="arrow_forward" className="text-xs" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

