import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Notification } from '../types/database';
import { mockNotifications } from './mockData';

const LOCAL_NOTIFICATIONS_KEY = 'tuws_notifications_cache_v1';

const getStoredLocalNotifications = (): Notification[] => {
  if (typeof window === 'undefined') return [...mockNotifications];
  const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
  if (!raw) {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(mockNotifications));
    return [...mockNotifications];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [...mockNotifications];
  }
};

const saveLocalNotifications = (notifications: Notification[], newNotif?: Notification) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent('tuws_notifications_updated', { detail: { newNotif } }));
};

export const notificationsService = {
  /**
   * Récupère toutes les notifications destinées à un utilisateur donné.
   */
  async getAll(userId?: string): Promise<Notification[]> {
    if (!userId) return [];

    // 1. Tenter la récupération depuis Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, title, message, type, link, is_read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data as Notification[];
        }
      } catch (err) {
        console.warn('[notificationsService] Erreur Supabase, repli local :', err);
      }
    }

    // 2. Repli persistant local
    const all = getStoredLocalNotifications();
    return all
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Alias de getNotifications pour clarté
   */
  async getNotifications(userId?: string): Promise<Notification[]> {
    return this.getAll(userId);
  },

  /**
   * Calcule le nombre de notifications non lues pour l'utilisateur
   */
  async getUnreadCount(userId?: string): Promise<number> {
    if (!userId) return 0;

    if (isSupabaseConfigured) {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (!error && typeof count === 'number') {
          return count;
        }
      } catch (err) {
        console.warn('[notificationsService] Erreur comptage Supabase :', err);
      }
    }

    const all = getStoredLocalNotifications();
    return all.filter((n) => n.user_id === userId && !n.is_read).length;
  },

  /**
   * Marque une notification spécifique comme lue.
   */
  async markAsRead(id: string, userId?: string): Promise<void> {
    // 1. Mise à jour Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (userId) {
          query = query.eq('user_id', userId);
        }
        await query;
      } catch (err) {
        console.warn('[notificationsService] Erreur marquage Supabase :', err);
      }
    }

    // 2. Mise à jour cache local
    const all = getStoredLocalNotifications();
    const idx = all.findIndex((n) => n.id === id);
    if (idx !== -1) {
      all[idx].is_read = true;
      saveLocalNotifications(all);
    }
  },

  /**
   * Marque toutes les notifications de l'utilisateur comme lues.
   */
  async markAllAsRead(userId?: string): Promise<void> {
    if (!userId) return;

    // 1. Mise à jour Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (err) {
        console.warn('[notificationsService] Erreur marquage global Supabase :', err);
      }
    }

    // 2. Mise à jour cache local
    const all = getStoredLocalNotifications();
    let hasChanges = false;
    all.forEach((n) => {
      if (n.user_id === userId && !n.is_read) {
        n.is_read = true;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      saveLocalNotifications(all);
    }
  },

  /**
   * Crée une nouvelle notification avec protection stricte anti-doublon.
   * Ne crée jamais de notification pour l'auteur lui-même.
   */
  async addNotification(payload: {
    user_id: string;
    title: string;
    message: string;
    type?: Notification['type'];
    link?: string;
    is_read?: boolean;
    sender_id?: string;
  }): Promise<Notification | null> {
    if (!payload.user_id) return null;

    // Sécurité : ne jamais notifier l'émetteur pour ses propres actions
    if (payload.sender_id && payload.sender_id === payload.user_id) {
      return null;
    }

    const all = getStoredLocalNotifications();

    // Protection anti-doublons (debounce de 5 secondes pour une notification identique)
    const now = Date.now();
    const isDuplicate = all.some((n) => {
      if (n.user_id !== payload.user_id) return false;
      if (n.link !== payload.link) return false;
      if (n.title !== payload.title) return false;
      const ageMs = now - new Date(n.created_at).getTime();
      return ageMs < 5000;
    });

    if (isDuplicate) {
      return null;
    }

    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: payload.user_id,
      title: payload.title.trim(),
      message: payload.message.trim(),
      type: payload.type || 'MESSAGE',
      link: payload.link,
      is_read: payload.is_read ?? false,
      created_at: new Date().toISOString(),
    };

    // 1. Tenter l'insertion Supabase
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert({
            user_id: newNotif.user_id,
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            link: newNotif.link,
            is_read: newNotif.is_read,
          })
          .select()
          .single();

        if (!error && data) {
          newNotif.id = data.id;
          newNotif.created_at = data.created_at || newNotif.created_at;
        }
      } catch (err) {
        console.warn('[notificationsService] Erreur insertion notification Supabase, repli local :', err);
      }
    }

    // 2. Sauvegarde persistante locale
    all.unshift(newNotif);
    saveLocalNotifications(all, newNotif);

    return newNotif;
  },

  /**
   * Abonnement en temps réel aux notifications d'un utilisateur :
   * - Écoute des événements locaux (CustomEvent)
   * - Écoute des modifications inter-onglets (storage)
   * - Heartbeat réactif léger (polling doux 5s)
   * - Canal Realtime Supabase postgres_changes si configuré
   */
  subscribeToNotifications(
    userId?: string | null,
    onUpdate: (latestNotif?: Notification) => void = () => {}
  ): () => void {
    if (!userId) return () => {};

    const handleEvent = (e?: Event) => {
      const customEvent = e as CustomEvent<{ newNotif?: Notification }>;
      const notif = customEvent?.detail?.newNotif;
      onUpdate(notif);
    };

    // 1. Événements réactifs du navigateur
    window.addEventListener('tuws_notifications_updated', handleEvent);
    window.addEventListener('storage', () => onUpdate());

    // 2. Polling doux
    const intervalId = setInterval(() => onUpdate(), 5000);

    // 3. Supabase Realtime si configuré
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      try {
        realtimeChannel = supabase
          .channel(`user-notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload: any) => {
              onUpdate(payload?.new as Notification);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              onUpdate();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[notificationsService] Erreur canal Realtime notifications :', err);
      }
    }

    // Nettoyage
    return () => {
      window.removeEventListener('tuws_notifications_updated', handleEvent);
      window.removeEventListener('storage', () => onUpdate());
      clearInterval(intervalId);
      if (realtimeChannel && isSupabaseConfigured) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  },
};
