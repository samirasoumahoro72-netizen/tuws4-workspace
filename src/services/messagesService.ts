import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Message, MessageAttachment, Profile, Project } from '../types/database';
import { projectService } from './projectService';
import { profileService } from './profileService';
import { notificationsService } from './notificationsService';
import { mockMessages, mockProfiles } from './mockData';
import { sanitizeFileName } from '../lib/security';

export type DiscussionType = 'project' | 'direct';

export interface UnifiedDiscussion {
  id: string; // project.id OU channelId 'dm_userA_userB'
  type: DiscussionType;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  partner?: Profile;
  project?: Project;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

// Rétrocompatibilité avec les composants existants
export interface ProjectDiscussion {
  project: Project;
  lastMessage?: Message;
  unreadCount: number;
}

const LOCAL_MESSAGES_KEY = 'tuws_messages_cache_v1';


// Formats de fichiers interdits (exécutables et scripts dangereux)
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.com', '.scr', '.pif'];
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 Mo

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getStoredLocalMessages = (): Message[] => {
  const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
  if (!raw) {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(mockMessages));
    return [...mockMessages];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [...mockMessages];
  }
};

const saveLocalMessages = (messages: Message[]) => {
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
  // Déclencher un événement inter-composants et inter-onglets
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tuws_messages_updated'));
  }
};

/**
 * Génère un identifiant déterministe et unique de canal direct pour deux utilisateurs.
 * Quel que soit l'utilisateur qui l'invoque (Sarah ou Marc), l'ID retourné est rigoureusement identique.
 */
export const getDirectChannelId = (userAId: string, userBId: string): string => {
  const sorted = [userAId, userBId].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

export const isDirectChannel = (channelId: string): boolean => {
  return channelId.startsWith('dm_');
};

export const messagesService = {
  /**
   * Récupère la liste unifiée de toutes les discussions autorisées pour l'utilisateur connecté :
   * 1. Canaux de projet (employé : projets assignés, admin : tous les projets).
   * 2. Conversations directes 1-à-1 actives auxquelles participe l'utilisateur.
   */
  async getUnifiedDiscussions(userId?: string, isAdmin: boolean = true): Promise<UnifiedDiscussion[]> {
    try {
      const discussions: UnifiedDiscussion[] = [];
      const currentUserId = userId || 'user-admin';

      // 1. Récupération des canaux Projets autorisés
      const allowedProjects = await projectService.getProjects(userId, isAdmin);
      if (allowedProjects && allowedProjects.length > 0) {
        for (const project of allowedProjects) {
          const messages = await this.getDiscussionMessages(project.id, currentUserId);
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
          // Non lu si le dernier message ne vient pas de l'utilisateur et n'a pas été lu par lui
          const isUnread = lastMessage && lastMessage.sender_id !== currentUserId && !lastMessage.read_at;
          const unreadCount = isUnread ? 1 : 0;
          const updatedAt = lastMessage?.created_at || project.updated_at || project.created_at || new Date().toISOString();

          discussions.push({
            id: project.id,
            type: 'project',
            title: project.name || project.title,
            subtitle: `${project.members?.length || 0} participants • ${project.progress}% achevé`,
            project,
            lastMessage,
            unreadCount,
            updatedAt,
          });
        }
      }

      // 2. Récupération des conversations directes 1-à-1 actives
      const allMessages = getStoredLocalMessages();
      const directChannelIds = new Set<string>();

      // Recherche des canaux directs impliquant cet utilisateur
      allMessages.forEach((msg) => {
        if (msg.project_id && msg.project_id.startsWith('dm_')) {
          const parts = msg.project_id.replace('dm_', '').split('_');
          if (parts.includes(currentUserId)) {
            directChannelIds.add(msg.project_id);
          }
        }
      });

      // Construction des objets discussions directes
      for (const channelId of Array.from(directChannelIds)) {
        const parts = channelId.replace('dm_', '').split('_');
        const partnerId = parts[0] === currentUserId ? parts[1] : parts[0];

        // Résolution du profil du partenaire
        let partnerProfile = await profileService.getProfile(partnerId);
        if (!partnerProfile) {
          partnerProfile = mockProfiles.find((p) => p.id === partnerId || p.user_id === partnerId) || null;
        }

        if (partnerProfile) {
          const messages = await this.getDiscussionMessages(channelId, currentUserId);
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
          const isUnread = lastMessage && lastMessage.sender_id !== currentUserId && !lastMessage.read_at;
          const unreadCount = isUnread ? 1 : 0;
          const updatedAt = lastMessage?.created_at || new Date().toISOString();

          discussions.push({
            id: channelId,
            type: 'direct',
            title: partnerProfile.full_name,
            subtitle: partnerProfile.job_title || 'Collaborateur',
            avatarUrl:
              partnerProfile.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(partnerProfile.full_name)}`,
            isOnline: partnerProfile.is_online ?? true,
            partner: partnerProfile,
            lastMessage,
            unreadCount,
            updatedAt,
          });
        }
      }

      // Tri chronologique : discussion avec le message le plus récent en tête
      discussions.sort((a, b) => {
        const timeA = new Date(a.updatedAt).getTime();
        const timeB = new Date(b.updatedAt).getTime();
        return timeB - timeA;
      });

      return discussions;
    } catch (err) {
      console.warn('[messagesService] Erreur récupération discussions unifiées :', err);
      return [];
    }
  },

  /**
   * Rétro-compatibilité : retourne les discussions projets
   */
  async getDiscussions(userId?: string, isAdmin: boolean = true): Promise<ProjectDiscussion[]> {
    const unified = await this.getUnifiedDiscussions(userId, isAdmin);
    return unified
      .filter((d) => d.type === 'project' && d.project)
      .map((d) => ({
        project: d.project!,
        lastMessage: d.lastMessage,
        unreadCount: d.unreadCount,
      }));
  },

  /**
   * Obtient ou prépare une conversation directe avec un collaborateur donné sans message fictif.
   */
  async getOrCreateDirectDiscussion(
    currentUserId: string,
    partner: Profile
  ): Promise<UnifiedDiscussion> {
    const channelId = getDirectChannelId(currentUserId, partner.id);
    const messages = await this.getDiscussionMessages(channelId);
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;

    return {
      id: channelId,
      type: 'direct',
      title: partner.full_name,
      subtitle: partner.job_title || 'Collaborateur',
      avatarUrl:
        partner.avatar_url ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(partner.full_name)}`,
      isOnline: partner.is_online ?? true,
      partner,
      lastMessage,
      unreadCount: 0,
      updatedAt: lastMessage?.created_at || new Date().toISOString(),
    };
  },

  /**
   * Récupère tous les messages d'un canal (projet ou discussion directe).
   * Optionnellement filtrés par rapport à l'utilisateur (pour masquer les messages supprimés pour lui).
   */
  async getDiscussionMessages(discussionId: string, currentUserId?: string): Promise<Message[]> {
    if (!discussionId) return [];

    let messagesList: Message[] = [];

    // 1. Tenter la récupération depuis Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            project_id,
            sender_id,
            content,
            read_at,
            read_by,
            attachments,
            reactions,
            deleted_at,
            deleted_by,
            deleted_for,
            created_at,
            sender:profiles(id, full_name, email, role)
          `)
          .eq('project_id', discussionId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          messagesList = data.map((row: any) => ({
            id: row.id,
            project_id: row.project_id,
            sender_id: row.sender_id,
            content: row.content,
            read_at: row.read_at,
            read_by: row.read_by || [],
            attachments: row.attachments || [],
            reactions: row.reactions || [],
            deleted_at: row.deleted_at || null,
            deleted_by: row.deleted_by || null,
            deleted_for: row.deleted_for || [],
            created_at: row.created_at,
            sender: row.sender
              ? {
                  id: row.sender.id,
                  full_name: row.sender.full_name || 'Collaborateur',
                  email: row.sender.email || '',
                  role: row.sender.role || 'employee',
                  avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                    row.sender.full_name || row.sender.id
                  )}`,
                }
              : undefined,
          }));
        }
      } catch (err) {
        console.warn('[messagesService] Erreur requête Supabase messages, repli local :', err);
      }
    }

    // 2. Repli vers le store persistant local si vide
    if (messagesList.length === 0) {
      const all = getStoredLocalMessages();
      const filtered = all.filter((m) => m.project_id === discussionId);

      // Initialisation du canal projet démo si vide
      if (filtered.length === 0 && discussionId === 'proj-1') {
        const defaultSamples = all.filter((m) => m.project_id === 'proj-1');
        messagesList = defaultSamples.length > 0 ? defaultSamples : [];
      } else {
        messagesList = filtered;
      }
    }

    // 3. Filtrage : masquer les messages marqués « Supprimer pour moi » par cet utilisateur
    if (currentUserId) {
      return messagesList.filter((m) => !m.deleted_for || !m.deleted_for.includes(currentUserId));
    }

    return messagesList;
  },

  /**
   * Alias de rétro-compatibilité
   */
  async getProjectMessages(projectId: string): Promise<Message[]> {
    return this.getDiscussionMessages(projectId);
  },

  /**
   * Marque automatiquement comme lus tous les messages non lus d'une conversation
   * qui sont destinés à l'utilisateur connecté (c-à-d où sender_id != currentUserId).
   * Ne modifie jamais les messages envoyés par l'utilisateur lui-même.
   */
  async markMessagesAsRead(discussionId: string, currentUserId: string): Promise<number> {
    if (!discussionId || !currentUserId) return 0;
    const now = new Date().toISOString();
    let markedCount = 0;

    // 1. Tenter la mise à jour dans Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('messages')
          .update({ read_at: now })
          .eq('project_id', discussionId)
          .neq('sender_id', currentUserId)
          .is('read_at', null);
      } catch (err) {
        console.warn('[messagesService] Erreur marquage lecture Supabase :', err);
      }
    }

    // 2. Mise à jour dans le cache local
    const all = getStoredLocalMessages();
    let hasChanges = false;

    all.forEach((msg) => {
      if (msg.project_id === discussionId && msg.sender_id !== currentUserId && !msg.read_at) {
        msg.read_at = now;
        markedCount++;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      saveLocalMessages(all);
    }

    return markedCount;
  },

  /**
   * Ajoute ou retire (toggle) une réaction emoji sur un message donné.
   */
  async toggleReaction(messageId: string, emoji: string, user: Profile): Promise<Message | null> {
    const all = getStoredLocalMessages();
    const msg = all.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions) {
      msg.reactions = [];
    }

    const existingIdx = msg.reactions.findIndex(
      (r) => r.user_id === user.id && r.emoji === emoji
    );

    if (existingIdx !== -1) {
      // Retirer la réaction existante
      msg.reactions.splice(existingIdx, 1);
    } else {
      // Ajouter la nouvelle réaction
      msg.reactions.push({
        emoji,
        user_id: user.id,
        user_name: user.full_name || 'Collaborateur',
        created_at: new Date().toISOString(),
      });
    }

    // 1. Tenter la mise à jour dans Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('messages')
          .update({ reactions: msg.reactions })
          .eq('id', messageId);
      } catch (err) {
        console.warn('[messagesService] Erreur mise à jour réaction Supabase :', err);
      }
    }

    // 2. Sauvegarde locale
    saveLocalMessages(all);
    return msg;
  },

  /**
   * Supprime un message pour tout le monde (Suppression logique / Soft Delete).
   * Règle de sécurité stricte : Seul l'expéditeur du message peut déclencher cette action.
   * Supprime également les fichiers associés dans Supabase Storage le cas échéant.
   */
  async deleteMessageForEveryone(messageId: string, currentUserId: string): Promise<boolean> {
    const all = getStoredLocalMessages();
    const msg = all.find((m) => m.id === messageId);
    if (!msg) return false;

    // Règle de sécurité stricte : seul le créateur du message peut le supprimer pour tous
    if (msg.sender_id !== currentUserId) {
      throw new Error("Vous n'êtes pas autorisé à supprimer ce message.");
    }

    const now = new Date().toISOString();

    // 1. Nettoyage des fichiers dans Supabase Storage si présents
    if (isSupabaseConfigured && msg.attachments && msg.attachments.length > 0) {
      const storagePaths = msg.attachments
        .map((att) => att.storage_path)
        .filter((p): p is string => Boolean(p));

      if (storagePaths.length > 0) {
        try {
          await supabase.storage.from('chat-attachments').remove(storagePaths);
        } catch (err) {
          console.warn('[messagesService] Erreur suppression stockage Supabase :', err);
        }
      }
    }

    // 2. Mise à jour de la ligne dans Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('messages')
          .update({
            deleted_at: now,
            deleted_by: currentUserId,
            content: '',
            attachments: [],
            reactions: [],
          })
          .eq('id', messageId)
          .eq('sender_id', currentUserId);
      } catch (err) {
        console.warn('[messagesService] Erreur soft delete Supabase :', err);
      }
    }

    // 3. Mise à jour dans le store local
    msg.deleted_at = now;
    msg.deleted_by = currentUserId;
    msg.content = '';
    msg.attachments = [];
    msg.reactions = [];

    saveLocalMessages(all);
    return true;
  },

  /**
   * Supprime / masque un message uniquement pour l'utilisateur connecté (« Supprimer pour moi »).
   * Les autres participants continuent de voir le message sans altération.
   */
  async deleteMessageForMe(messageId: string, currentUserId: string): Promise<boolean> {
    const all = getStoredLocalMessages();
    const msg = all.find((m) => m.id === messageId);
    if (!msg) return false;

    if (!msg.deleted_for) {
      msg.deleted_for = [];
    }

    if (!msg.deleted_for.includes(currentUserId)) {
      msg.deleted_for.push(currentUserId);
    }

    // 1. Mise à jour dans Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('messages')
          .update({
            deleted_for: msg.deleted_for,
          })
          .eq('id', messageId);
      } catch (err) {
        console.warn('[messagesService] Erreur masquage local Supabase :', err);
      }
    }

    // 2. Sauvegarde locale
    saveLocalMessages(all);
    return true;
  },

  /**
   * Téléverse ou convertit un fichier/image joint de manière sécurisée.
   * Vérifie la taille (< 25 Mo) et rejette les extensions exécutables.
   */
  async uploadAttachment(file: File, discussionId: string): Promise<MessageAttachment> {
    // 1. Vérification de sécurité de la taille
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`Le fichier est trop volumineux (maximum 25 Mo). Taille actuelle : ${formatFileSize(file.size)}.`);
    }

    // 2. Vérification des extensions interdites
    const lowerName = file.name.toLowerCase();
    const hasForbiddenExt = FORBIDDEN_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (hasForbiddenExt) {
      throw new Error(`Pour des raisons de sécurité, les fichiers exécutables ou de script (${lowerName}) ne sont pas autorisés.`);
    }

    const isImage = file.type.startsWith('image/');
    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let fileUrl = '';
    const safeName = sanitizeFileName(file.name);
    const storagePath = `chat-attachments/${discussionId}/${Date.now()}_${safeName}`;

    // 3. Tenter l'upload Supabase Storage si configuré
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, file, { cacheControl: '3600', upsert: true });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(storagePath);
          fileUrl = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.warn('[messagesService] Erreur upload Supabase Storage, repli encodage local :', err);
      }
    }

    // 4. Repli local DataURL/Blob persistant si non disponible
    if (!fileUrl) {
      fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Erreur lors de la lecture locale du fichier.'));
        reader.readAsDataURL(file);
      });
    }

    const attachment: MessageAttachment = {
      id: attachmentId,
      name: file.name,
      size: file.size,
      size_formatted: formatFileSize(file.size),
      type: isImage ? 'image' : 'document',
      mime_type: file.type || 'application/octet-stream',
      url: fileUrl,
      storage_path: storagePath,
    };

    return attachment;
  },

  /**
   * Envoie un nouveau message avec prise en charge du texte, des pièces jointes et accusé de lecture initial.
   */
  async sendMessage(
    discussionId: string,
    content: string,
    sender: Profile,
    partnerId?: string,
    attachments?: MessageAttachment[]
  ): Promise<Message> {
    const trimmed = content.trim();
    const hasAttachments = attachments && attachments.length > 0;

    if (!trimmed && !hasAttachments) {
      throw new Error('Le message ou un fichier joint est requis.');
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: discussionId,
      sender_id: sender.id,
      sender: {
        id: sender.id,
        full_name: sender.full_name || 'Moi',
        email: sender.email || '',
        role: sender.role || 'employee',
        avatar_url:
          sender.avatar_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sender.full_name || sender.id)}`,
      },
      content: trimmed,
      read_at: null, // Initialement non lu par le destinataire (✓ Envoyé)
      read_by: [],
      attachments: attachments || [],
      reactions: [],
      deleted_at: null,
      deleted_by: null,
      deleted_for: [],
      created_at: new Date().toISOString(),
    };

    // 1. Tenter l'enregistrement dans Supabase
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            project_id: discussionId,
            sender_id: sender.id,
            content: trimmed,
            attachments: newMessage.attachments,
            reactions: [],
            read_at: null,
          })
          .select()
          .single();

        if (!error && data) {
          newMessage.id = data.id;
          newMessage.created_at = data.created_at || newMessage.created_at;
        }
      } catch (err) {
        console.warn('[messagesService] Erreur insertion Supabase, persistance locale :', err);
      }
    }

    // 2. Persistance dans le cache local
    const all = getStoredLocalMessages();
    all.push(newMessage);
    saveLocalMessages(all);

    // 3. Notification des destinataires (Direct ou Projet)
    const isDirect = isDirectChannel(discussionId);
    const hasFiles = attachments && attachments.length > 0;
    const firstFileName = hasFiles ? attachments[0].name : '';
    const snippetFormatted =
      trimmed.length > 80 ? `${trimmed.substring(0, 80)}...` : trimmed;

    if (isDirect) {
      // Notification pour message direct 1-à-1
      let targetUserId = partnerId;
      if (!targetUserId) {
        const parts = discussionId.replace('dm_', '').split('_');
        targetUserId = parts[0] === sender.id ? parts[1] : parts[0];
      }

      if (targetUserId && targetUserId !== sender.id) {
        const notifTitle = hasFiles
          ? `Nouveau fichier de ${sender.full_name || 'un collaborateur'}`
          : `Nouveau message de ${sender.full_name || 'un collaborateur'}`;

        const notifMessage = hasFiles
          ? (trimmed ? `« ${firstFileName} » : ${snippetFormatted}` : `Vous a envoyé le fichier « ${firstFileName} »`)
          : (snippetFormatted || 'Vous a envoyé un message');

        notificationsService
          .addNotification({
            user_id: targetUserId,
            sender_id: sender.id,
            title: notifTitle,
            message: notifMessage,
            type: hasFiles ? 'FILE' : 'MESSAGE',
            link: `/messages?contact=${sender.id}`,
          })
          .catch((err) => console.warn('[messagesService] Notification direct message non envoyée :', err));
      }
    } else {
      // Notification pour message dans un canal de projet (aux membres du projet uniquement)
      (async () => {
        try {
          const project = await projectService.getProjectById(discussionId);
          const projectName = project?.name || project?.title || 'Projet';

          let memberUserIds: string[] = [];
          if (isSupabaseConfigured) {
            const { data: memberRows } = await supabase
              .from('project_members')
              .select('user_id')
              .eq('project_id', discussionId);
            if (memberRows && memberRows.length > 0) {
              memberUserIds = memberRows.map((r: any) => r.user_id);
            }
          }

          // Inclure le créateur du projet
          if (project?.created_by) {
            memberUserIds.push(project.created_by);
          }

          // Repli sur les membres associés au projet si vide
          if (project?.members) {
            memberUserIds.push(...project.members.map((m) => m.id || (m as any).user_id));
          }

          // Déduplication et exclusion stricte de l'auteur du message
          const uniqueRecipients = Array.from(new Set(memberUserIds)).filter(
            (uid) => uid && uid !== sender.id && uid !== (sender as any).user_id
          );

          const notifTitle = hasFiles
            ? `${sender.full_name || 'Un collaborateur'} a partagé un fichier`
            : `${sender.full_name || 'Un collaborateur'} dans ${projectName}`;

          const notifMessage = hasFiles
            ? (trimmed ? `Projet ${projectName} : « ${firstFileName} » - ${snippetFormatted}` : `Projet ${projectName} : a partagé le fichier « ${firstFileName} »`)
            : `Projet ${projectName} : ${snippetFormatted}`;

          for (const recipientId of uniqueRecipients) {
            notificationsService
              .addNotification({
                user_id: recipientId,
                sender_id: sender.id,
                title: notifTitle,
                message: notifMessage,
                type: hasFiles ? 'FILE' : 'MESSAGE',
                link: `/messages?project=${discussionId}`,
              })
              .catch((err) => console.warn('[messagesService] Notification projet non envoyée :', err));
          }
        } catch (err) {
          console.warn('[messagesService] Erreur envoi notifications projet :', err);
        }
      })();
    }

    return newMessage;
  },

  /**
   * S'abonne aux modifications en temps réel d'une discussion :
   * - Écouteurs d'événements locaux (CustomEvent)
   * - Écouteurs de stockage inter-onglets (storage)
   * - Heartbeat réactif léger (polling de sécurité toutes les 3s pour détecter les lectures de l'autre personne)
   * - Canal Realtime Supabase si configuré
   */
  subscribeToDiscussion(discussionId: string, onUpdate: () => void): () => void {
    const handleEvent = () => onUpdate();

    // 1. Écoute événement local
    window.addEventListener('tuws_messages_updated', handleEvent);
    // 2. Écoute événement inter-onglets
    window.addEventListener('storage', handleEvent);

    // 3. Polling doux pour réactivité instantanée
    const intervalId = setInterval(onUpdate, 3000);

    // 4. Supabase Realtime si disponible
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      try {
        realtimeChannel = supabase
          .channel(`discussion:${discussionId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `project_id=eq.${discussionId}`,
            },
            () => {
              onUpdate();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[messagesService] Erreur souscription Supabase Realtime :', err);
      }
    }

    // Fonction de nettoyage
    return () => {
      window.removeEventListener('tuws_messages_updated', handleEvent);
      window.removeEventListener('storage', handleEvent);
      clearInterval(intervalId);
      if (realtimeChannel && isSupabaseConfigured) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  },
};
