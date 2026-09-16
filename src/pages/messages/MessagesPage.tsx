import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { messagesService, UnifiedDiscussion } from '../../services/messagesService';
import { profileService } from '../../services/profileService';
import { Message, MessageAttachment, Profile } from '../../types/database';
import { StatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { EmojiPicker } from '../../components/chat/EmojiPicker';
import { ImageLightbox, PendingAttachmentBar } from '../../components/chat/AttachmentPreviewModal';

/**
 * Formatage éditorial des dates de messages (Aujourd'hui, Hier, ou Date courte)
 */
const formatMessageTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) return `Aujourd'hui, ${timeStr}`;
  if (isYesterday) return `Hier, ${timeStr}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${timeStr}`;
};

/**
 * Formatage éditorial de l'accusé de lecture pour l'expéditeur
 */
const formatReadStatus = (readAt?: string | null): { label: string; icon: string; isRead: boolean } => {
  if (!readAt) {
    return { label: 'Envoyé', icon: 'check', isRead: false };
  }
  const date = new Date(readAt);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { label: `Vu à ${hours}:${minutes}`, icon: 'done_all', isRead: true };
};

export const MessagesPage: React.FC = () => {
  const { user, profile: currentProfile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [discussions, setDiscussions] = useState<UnifiedDiscussion[]>([]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'project'>('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loadingDiscussions, setLoadingDiscussions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Pièces jointes et upload
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Emojis & Lightbox
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<MessageAttachment | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState<string | null>(null);

  // Suppression de message (menu d'actions contextuel et confirmation)
  const [actionMenuMsgId, setActionMenuMsgId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    messageId: string;
    type: 'for_me' | 'for_everyone';
  } | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<boolean>(false);

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);

  // Gestion intelligente du scroll (pas de scroll forcé lors de la lecture d'anciens messages)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const isInitialLoadRef = useRef<boolean>(true);
  const prevDiscussionIdRef = useRef<string | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const currentUserId = user?.id || currentProfile?.id || 'user-admin';

  /**
   * Vérifie si l'utilisateur est proche du bas du conteneur de conversation
   */
  const isUserNearBottom = useCallback((threshold = 120): boolean => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  /**
   * Descend vers le bas du conteneur de conversation
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (behavior === 'auto') {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    isAtBottomRef.current = true;
    setNewMessagesCount(0);
  }, []);

  /**
   * Écouteur de défilement manuel sur le conteneur
   */
  const handleScroll = useCallback(() => {
    const nearBottom = isUserNearBottom(120);
    isAtBottomRef.current = nearBottom;
    if (nearBottom) {
      setNewMessagesCount(0);
    }
  }, [isUserNearBottom]);

  // Réinitialisation de l'état de scroll lors d'un changement de discussion
  useEffect(() => {
    if (selectedDiscussionId !== prevDiscussionIdRef.current) {
      prevDiscussionIdRef.current = selectedDiscussionId;
      isInitialLoadRef.current = true;
      isAtBottomRef.current = true;
      setNewMessagesCount(0);
    }
  }, [selectedDiscussionId]);

  // Profil de l'expéditeur connecté
  const senderProfile: Profile = useMemo(() => {
    return (
      currentProfile || {
        id: currentUserId,
        full_name: (user as any)?.user_metadata?.full_name || user?.email || 'Moi',
        email: user?.email || '',
        role: isAdmin ? 'admin' : 'employee',
        avatar_url: (user as any)?.user_metadata?.avatar_url,
      }
    );
  }, [currentProfile, currentUserId, user, isAdmin]);

  // Charger toutes les discussions unifiées
  const loadDiscussions = useCallback(async () => {
    setLoadingDiscussions(true);
    try {
      const data = await messagesService.getUnifiedDiscussions(currentUserId, isAdmin);
      setDiscussions(data);
      return data;
    } catch (err) {
      console.warn('[MessagesPage] Erreur chargement discussions :', err);
      return [];
    } finally {
      setLoadingDiscussions(false);
    }
  }, [currentUserId, isAdmin]);

  // Intercepter les paramètres d'URL (?contact=... et ?project=...)
  useEffect(() => {
    const handleUrlParams = async () => {
      const contactUserId = searchParams.get('contact');
      const projectParamId = searchParams.get('project');

      const loadedList = await loadDiscussions();

      if (contactUserId) {
        if (contactUserId === currentUserId) {
          searchParams.delete('contact');
          setSearchParams(searchParams, { replace: true });
          return;
        }

        const targetProfile = await profileService.getProfile(contactUserId);
        if (targetProfile) {
          const directDiscussion = await messagesService.getOrCreateDirectDiscussion(
            currentUserId,
            targetProfile
          );

          setDiscussions((prev) => {
            const exists = prev.some((d) => d.id === directDiscussion.id);
            if (!exists) {
              return [directDiscussion, ...prev];
            }
            return prev;
          });

          setSelectedDiscussionId(directDiscussion.id);

          setTimeout(() => {
            inputRef.current?.focus({ preventScroll: true });
          }, 150);
        }
      } else if (projectParamId) {
        const found = loadedList.find((d) => d.id === projectParamId);
        if (found) {
          setSelectedDiscussionId(projectParamId);
        }
      }
    };

    handleUrlParams();
  }, [searchParams, currentUserId]);

  // Charger les messages de la discussion active
  const loadActiveMessages = useCallback(
    async (discussionId: string) => {
      setLoadingMessages(true);
      try {
        const msgList = await messagesService.getDiscussionMessages(discussionId, currentUserId);
        setMessages(msgList);

        // Marquage automatique des messages reçus comme lus
        await messagesService.markMessagesAsRead(discussionId, currentUserId);

        // 1. À l'OUVERTURE D'UNE CONVERSATION : positionner tout en bas
        if (isInitialLoadRef.current) {
          requestAnimationFrame(() => {
            scrollToBottom('auto');
            isInitialLoadRef.current = false;
            isAtBottomRef.current = true;
          });
        }
      } catch (err) {
        console.warn('[MessagesPage] Erreur chargement messages :', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentUserId, scrollToBottom]
  );

  useEffect(() => {
    if (selectedDiscussionId) {
      loadActiveMessages(selectedDiscussionId);
    } else {
      setMessages([]);
    }
  }, [selectedDiscussionId, loadActiveMessages]);

  // Abonnement Temps Réel (Realtime Supabase + événements réactifs)
  useEffect(() => {
    if (!selectedDiscussionId) return;

    const unsubscribe = messagesService.subscribeToDiscussion(selectedDiscussionId, async () => {
      const updated = await messagesService.getDiscussionMessages(selectedDiscussionId, currentUserId);

      setMessages((prevMessages) => {
        // Détecter si de nouveaux messages sont arrivés
        const prevIds = new Set(prevMessages.map((m) => m.id));
        const newArrivals = updated.filter((m) => !prevIds.has(m.id));

        if (newArrivals.length > 0) {
          const latestMsg = newArrivals[newArrivals.length - 1];
          const isFromMe = latestMsg?.sender_id === currentUserId;

          // Si l'utilisateur est en bas OU si c'est lui qui a envoyé -> descendre automatiquement
          if (isFromMe || isAtBottomRef.current) {
            requestAnimationFrame(() => {
              scrollToBottom('smooth');
            });
          } else {
            // L'utilisateur consulte les anciens messages -> NE PAS SCROLLER, incrémenter l'indicateur
            setNewMessagesCount((prev) => prev + newArrivals.length);
          }
        }

        return updated;
      });

      // Si l'utilisateur est en bas, marquer comme lu
      if (isAtBottomRef.current) {
        await messagesService.markMessagesAsRead(selectedDiscussionId, currentUserId);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedDiscussionId, currentUserId, scrollToBottom]);

  const activeDiscussion = discussions.find((d) => d.id === selectedDiscussionId);

  // Focus automatique uniquement au chargement initial d'une discussion
  useEffect(() => {
    if (selectedDiscussionId && isInitialLoadRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [selectedDiscussionId]);

  // Gestion de la sélection de fichier
  const handleFileSelect = async (file: File) => {
    if (!selectedDiscussionId) return;

    setUploading(true);
    setUploadProgress(20);

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev >= 80 ? 80 : prev + 20));
    }, 120);

    try {
      const attachment = await messagesService.uploadAttachment(file, selectedDiscussionId);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setPendingAttachment(attachment);
      showToast(`Fichier prêt à être envoyé : ${file.name}`, 'check_circle', 'success');
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 100);
    } catch (err: any) {
      clearInterval(progressTimer);
      showToast(err.message || 'Impossible de joindre ce fichier.', 'error', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Réinitialiser la valeur pour permettre de re-sélectionner le même fichier si besoin
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Gestion du Drag and Drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Envoi du message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessageText.trim() && !pendingAttachment) || !selectedDiscussionId || sending) return;

    setSending(true);
    try {
      const partnerId = activeDiscussion?.type === 'direct' ? activeDiscussion.partner?.id : undefined;
      const attachmentsToSend = pendingAttachment ? [pendingAttachment] : undefined;

      const sentMsg = await messagesService.sendMessage(
        selectedDiscussionId,
        newMessageText.trim(),
        senderProfile,
        partnerId,
        attachmentsToSend
      );

      setMessages((prev) => [...prev, sentMsg]);
      setNewMessageText('');
      setPendingAttachment(null);
      setIsEmojiPickerOpen(false);

      // Mise à jour de la liste des discussions
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === selectedDiscussionId
            ? { ...d, lastMessage: sentMsg, unreadCount: 0, updatedAt: sentMsg.created_at }
            : d
        )
      );

      // 2. LORSQU'ON ENVOIE UN MESSAGE : descendre automatiquement
      isAtBottomRef.current = true;
      setNewMessagesCount(0);
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });

      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l’envoi du message', 'error', 'error');
    } finally {
      setSending(false);
    }
  };

  // Insertion d'un emoji dans le champ texte
  const handleSelectEmoji = (emoji: string) => {
    setNewMessageText((prev) => prev + emoji);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Toggle d'une réaction sur un message
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const updated = await messagesService.toggleReaction(messageId, emoji, senderProfile);
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...updated } : m)));
      }
      setActiveReactionMenuMsgId(null);
    } catch (err) {
      console.warn('Erreur toggle reaction :', err);
    }
  };

  // Fermer le menu d'actions lors d'un clic extérieur
  useEffect(() => {
    const handleGlobalClick = () => {
      setActionMenuMsgId(null);
    };
    if (actionMenuMsgId) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [actionMenuMsgId]);

  // Confirmation de suppression de message (pour moi ou pour tout le monde)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal) return;
    const { messageId, type } = deleteConfirmModal;
    setDeletingMessage(true);

    try {
      if (type === 'for_everyone') {
        await messagesService.deleteMessageForEveryone(messageId, currentUserId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  deleted_at: new Date().toISOString(),
                  deleted_by: currentUserId,
                  content: '',
                  attachments: [],
                  reactions: [],
                }
              : m
          )
        );
        showToast('Message supprimé pour tout le monde', 'info');
      } else {
        await messagesService.deleteMessageForMe(messageId, currentUserId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        showToast('Message supprimé de votre conversation', 'info');
      }

      loadDiscussions();
      setDeleteConfirmModal(null);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suppression du message', 'error');
    } finally {
      setDeletingMessage(false);
    }
  };

  const filteredDiscussions = discussions.filter((d) => {
    if (filterType === 'all') return true;
    return d.type === filterType;
  });

  const directCount = discussions.filter((d) => d.type === 'direct').length;
  const projectCount = discussions.filter((d) => d.type === 'project').length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto relative">
      {/* Lightbox d'image */}
      <ImageLightbox
        isOpen={Boolean(lightboxAttachment)}
        attachment={lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
      />

      {/* Modale compacte de confirmation de suppression */}
      {deleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !deletingMessage && setDeleteConfirmModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest border border-surface-container rounded-2xl shadow-2xl p-5 max-w-sm w-full animate-in zoom-in-95 duration-150 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Icon name="delete" className="text-lg" />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="font-headline text-base font-bold text-primary-container">
                  Supprimer ce message ?
                </h3>
                <p className="text-xs text-secondary mt-1 leading-relaxed">
                  {deleteConfirmModal.type === 'for_everyone'
                    ? 'Cette action supprimera le message de la conversation pour tous les participants.'
                    : 'Ce message n’apparaîtra plus dans votre fil de discussion. Les autres participants continueront de le voir.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingMessage}
                onClick={() => setDeleteConfirmModal(null)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deletingMessage}
                onClick={handleConfirmDelete}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input de fichier caché */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
      />

      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-surface-container">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
              Messages & Discussions
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-container text-secondary">
              {discussions.length} conversation{discussions.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-secondary mt-0.5 font-medium">
            Messagerie collaborative : discussions en temps réel, pièces jointes, images & accusés de lecture
          </p>
        </div>

        {selectedDiscussionId && (
          <button
            type="button"
            onClick={() => {
              setSelectedDiscussionId(null);
              searchParams.delete('contact');
              searchParams.delete('project');
              setSearchParams(searchParams, { replace: true });
            }}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-bold text-primary-container hover:text-on-tertiary-container px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            Toutes les discussions
          </button>
        )}
      </div>

      {/* État de chargement initial */}
      {loadingDiscussions ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-secondary">
          <Icon name="spinner" spin className="text-3xl text-brand-orange" />
          <span className="text-sm font-medium">Chargement des échanges et canaux...</span>
        </div>
      ) : discussions.length === 0 ? (
        <div className="py-20 bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-secondary mb-4">
            <Icon name="forum" className="text-3xl" />
          </div>
          <h2 className="font-headline text-lg font-bold text-primary-container mb-1">
            Aucune conversation pour le moment
          </h2>
          <p className="text-xs text-secondary leading-relaxed max-w-sm">
            Vous pouvez contacter directement un collaborateur depuis l'annuaire d'équipe ou participer aux canaux de projets.
          </p>
          <div className="flex items-center gap-2 mt-5">
            <Link to="/team">
              <Button variant="orange" size="sm" icon="groups">
                Annuaire de l'équipe
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/projects">
                <Button variant="outline" size="sm" icon="rocket_launch">
                  Projets d'agence
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : selectedDiscussionId && activeDiscussion ? (
        /* VUE CONVERSATION SÉLECTIONNÉE */
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`bg-surface-container-lowest rounded-2xl border ${
            isDragging ? 'border-brand-orange ring-2 ring-brand-orange/30' : 'border-surface-container'
          } shadow-sm flex flex-col min-h-[620px] overflow-hidden relative transition-all`}
        >
          {/* Overlay Drag & Drop */}
          {isDragging && (
            <div className="absolute inset-0 z-40 bg-brand-orange/10 backdrop-blur-xs flex flex-col items-center justify-center gap-3 border-2 border-dashed border-brand-orange rounded-2xl animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-brand-orange">
                <Icon name="cloud_upload" className="text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-primary-container">
                  Déposez votre fichier ici
                </p>
                <p className="text-xs text-secondary">
                  Images (JPG, PNG, WebP) ou documents (PDF, Word, Excel, ZIP...)
                </p>
              </div>
            </div>
          )}

          {/* En-tête de la discussion */}
          {activeDiscussion.type === 'direct' && activeDiscussion.partner ? (
            <div className="p-4 sm:p-5 border-b border-surface-container bg-surface-container-low/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedDiscussionId(null)}
                  className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-secondary hover:text-primary-container hover:bg-surface-container-high transition-colors shrink-0"
                  title="Revenir à la liste des discussions"
                >
                  <Icon name="arrow_back" className="text-[18px]" />
                </button>

                <div className="relative shrink-0">
                  <img
                    src={activeDiscussion.avatarUrl}
                    alt={activeDiscussion.title}
                    className="w-11 h-11 rounded-xl object-cover ring-2 ring-surface-container shadow-xs"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-headline text-base sm:text-lg font-bold text-primary-container truncate">
                      {activeDiscussion.title}
                    </h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange">
                      Message direct
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-secondary">
                    <span>{activeDiscussion.subtitle || 'Collaborateur'}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Disponible
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container">
                <Link
                  to="/team"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface-container text-primary-container text-xs font-bold hover:bg-surface-container-high transition-all"
                >
                  <Icon name="person" className="text-[14px]" />
                  <span>Fiche collaborateur</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 border-b border-surface-container bg-surface-container-low/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedDiscussionId(null)}
                  className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-secondary hover:text-primary-container hover:bg-surface-container-high transition-colors shrink-0 mt-0.5"
                  title="Revenir à la liste des discussions"
                >
                  <Icon name="arrow_back" className="text-[18px]" />
                </button>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-headline text-base sm:text-lg font-bold text-primary-container truncate">
                      {activeDiscussion.title}
                    </h2>
                    {activeDiscussion.project && (
                      <>
                        <StatusBadge status={activeDiscussion.project.status} />
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-secondary">
                          {activeDiscussion.project.progress}% achevé
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-secondary">
                    <Icon name="groups" className="text-[15px]" />
                    <span>
                      {activeDiscussion.project?.members?.length || 0} participant
                      {(activeDiscussion.project?.members?.length || 0) > 1 ? 's' : ''}
                    </span>
                    <span>•</span>
                    <span>Canal de projet dédié</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container">
                <div className="flex items-center -space-x-2">
                  {activeDiscussion.project?.members?.slice(0, 4).map((m, idx) => (
                    <img
                      key={idx}
                      src={m.avatar_url}
                      alt={m.full_name}
                      title={m.full_name}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-surface-container-lowest shadow-xs"
                    />
                  ))}
                </div>

                {activeDiscussion.project && (
                  <Link
                    to={`/projects/${activeDiscussion.project.id}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface-container text-primary-container text-xs font-bold hover:bg-surface-container-high hover:text-on-tertiary-container transition-all"
                  >
                    <span>Voir le projet</span>
                    <Icon name="arrow_forward" className="text-[14px]" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Fil des messages avec gestion précise du défilement */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 bg-surface-container-lowest/50 relative"
          >
            {loadingMessages ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-secondary">
                <Icon name="spinner" spin className="text-2xl text-brand-orange" />
                <span className="text-xs">Chargement des échanges...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center gap-3 text-secondary max-w-sm mx-auto">
                <div className="relative">
                  <img
                    src={
                      activeDiscussion.avatarUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeDiscussion.title)}`
                    }
                    alt={activeDiscussion.title}
                    className="w-16 h-16 rounded-2xl object-cover ring-4 ring-surface-container shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-bold text-primary-container">
                    Démarrez votre conversation avec {activeDiscussion.title}
                  </p>
                  <p className="text-xs text-secondary leading-relaxed">
                    {activeDiscussion.type === 'direct'
                      ? 'Posez une question, partagez des fichiers ou échangez en direct avec votre collègue.'
                      : 'Échangez avec tous les collaborateurs assignés à ce canal de projet.'}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.sender_id === currentUserId;
                const senderName = msg.sender?.full_name || (isSelf ? 'Moi' : 'Collaborateur');
                const senderAvatar =
                  msg.sender?.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}`;

                const readStatus = formatReadStatus(msg.read_at);
                const isDeleted = Boolean(msg.deleted_at);

                // Groupement des réactions (uniquement si non supprimé)
                const reactionGroups: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } } = {};
                if (!isDeleted) {
                  (msg.reactions || []).forEach((r) => {
                    if (!reactionGroups[r.emoji]) {
                      reactionGroups[r.emoji] = { count: 0, users: [], hasReacted: false };
                    }
                    reactionGroups[r.emoji].count++;
                    reactionGroups[r.emoji].users.push(r.user_name);
                    if (r.user_id === currentUserId) {
                      reactionGroups[r.emoji].hasReacted = true;
                    }
                  });
                }

                return (
                  <div
                    key={msg.id}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => {
                      setHoveredMessageId(null);
                      if (activeReactionMenuMsgId === msg.id) {
                        setActiveReactionMenuMsgId(null);
                      }
                    }}
                    className={`flex items-start gap-2.5 sm:gap-3 ${
                      isSelf ? 'flex-row-reverse self-end' : 'self-start'
                    } max-w-[88%] sm:max-w-[78%] group relative`}
                  >
                    <img
                      src={senderAvatar}
                      alt={senderName}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 mt-1 shadow-xs"
                    />

                    <div className={`flex flex-col min-w-0 ${isSelf ? 'items-end' : 'items-start'} relative`}>
                      {/* En-tête de message : Nom & Heure & Action mobile */}
                      <div className="flex items-center gap-2 mb-1 px-0.5">
                        <span className="text-[11px] font-bold text-primary-container">
                          {isSelf ? 'Moi' : senderName}
                        </span>
                        <span className="text-[10px] text-secondary font-mono">
                          {formatMessageTime(msg.created_at)}
                        </span>

                        {/* Bouton d'actions adapté au mobile */}
                        {isSelf && !isDeleted && (
                          <div className="relative inline-block sm:hidden ml-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuMsgId(actionMenuMsgId === msg.id ? null : msg.id);
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center text-secondary hover:text-primary-container"
                              title="Options du message"
                            >
                              <Icon name="more_vert" className="text-[11px]" />
                            </button>
                            {actionMenuMsgId === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-48 bg-surface-container-lowest rounded-xl border border-surface-container shadow-xl py-1 z-30"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuMsgId(null);
                                    setDeleteConfirmModal({ messageId: msg.id, type: 'for_me' });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-primary-container hover:bg-surface-container flex items-center gap-2"
                                >
                                  <Icon name="delete" className="text-secondary text-xs" />
                                  <span>Supprimer pour moi</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuMsgId(null);
                                    setDeleteConfirmModal({ messageId: msg.id, type: 'for_everyone' });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2"
                                >
                                  <Icon name="delete" className="text-rose-600 text-xs" />
                                  <span>Supprimer pour tout le monde</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contenu du message ou Indication de suppression */}
                      {isDeleted ? (
                        <div
                          className={`p-2.5 sm:p-3 rounded-2xl text-xs leading-relaxed flex items-center gap-2 border italic text-secondary bg-surface-container-low/40 border-surface-container ${
                            isSelf ? 'rounded-tr-xs' : 'rounded-tl-xs'
                          }`}
                        >
                          <Icon name="cancel" className="text-secondary/60 text-xs shrink-0" />
                          <span>Ce message a été supprimé</span>
                        </div>
                      ) : (
                        <div
                          className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed flex flex-col gap-2 relative ${
                            isSelf
                              ? 'bg-primary-container text-on-primary rounded-tr-xs shadow-xs'
                              : 'bg-surface-container-low text-on-surface rounded-tl-xs border border-surface-container/60'
                          }`}
                        >
                          {/* 1. Rendu des Pièces Jointes */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {msg.attachments.map((att) => {
                                if (att.type === 'image') {
                                  return (
                                    <div
                                      key={att.id}
                                      onClick={() => setLightboxAttachment(att)}
                                      className="cursor-pointer group/img relative overflow-hidden rounded-xl border border-black/10 max-w-sm"
                                    >
                                      <img
                                        src={att.url}
                                        alt={att.name}
                                        className="max-h-60 w-auto rounded-xl object-cover hover:scale-102 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-semibold">
                                        <Icon name="zoom_in" className="text-xl" />
                                        <span>Agrandir</span>
                                      </div>
                                    </div>
                                  );
                                }

                                const isPdf = att.mime_type.includes('pdf') || att.name.endsWith('.pdf');
                                const isDoc = att.name.endsWith('.doc') || att.name.endsWith('.docx');
                                const isSheet = att.name.endsWith('.xls') || att.name.endsWith('.xlsx');
                                const isZip = att.name.endsWith('.zip');

                                return (
                                  <div
                                    key={att.id}
                                    className={`p-2.5 rounded-xl flex items-center justify-between gap-3 border ${
                                      isSelf
                                        ? 'bg-black/20 border-white/10 text-on-primary'
                                        : 'bg-surface-container-lowest border-surface-container text-on-surface'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                          isPdf
                                            ? 'bg-rose-500/20 text-rose-500'
                                            : isSheet
                                            ? 'bg-emerald-500/20 text-emerald-500'
                                            : isDoc
                                            ? 'bg-blue-500/20 text-blue-500'
                                            : isZip
                                            ? 'bg-amber-500/20 text-amber-500'
                                            : 'bg-surface-container text-secondary'
                                        }`}
                                      >
                                        <Icon
                                          name={
                                            isPdf
                                              ? 'picture_as_pdf'
                                              : isSheet
                                              ? 'table_chart'
                                              : isZip
                                              ? 'folder_zip'
                                              : 'description'
                                          }
                                          className="text-lg"
                                        />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs truncate max-w-[180px] sm:max-w-[240px]">
                                          {att.name}
                                        </span>
                                        <span className="text-[10px] opacity-75">{att.size_formatted}</span>
                                      </div>
                                    </div>

                                    <a
                                      href={att.url}
                                      download={att.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                        isSelf
                                          ? 'hover:bg-white/20 text-white'
                                          : 'hover:bg-surface-container text-primary-container'
                                      }`}
                                      title="Télécharger ce document"
                                    >
                                      <Icon name="download" className="text-[16px]" />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 2. Texte du message */}
                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                      )}

                      {/* 3. Accusé de lecture (Envoyé ✓ / Vu ✓✓ à 14:32) pour les messages non supprimés */}
                      {isSelf && !isDeleted && (
                        <div className="flex items-center gap-1 mt-1 px-1 text-[10px] font-medium">
                          <Icon
                            name={readStatus.icon}
                            className={`text-[13px] ${
                              readStatus.isRead ? 'text-brand-orange font-bold' : 'text-secondary'
                            }`}
                          />
                          <span
                            className={
                              readStatus.isRead
                                ? 'text-brand-orange font-semibold'
                                : 'text-secondary font-normal'
                            }
                          >
                            {readStatus.label}
                          </span>
                        </div>
                      )}

                      {/* 4. Réactions expressives attachées au message */}
                      {!isDeleted && Object.keys(reactionGroups).length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {Object.entries(reactionGroups).map(([emoji, group]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              title={`Réagi par : ${group.users.join(', ')}`}
                              className={`h-6 px-2 rounded-full text-xs flex items-center gap-1 border transition-all ${
                                group.hasReacted
                                  ? 'bg-brand-orange/15 border-brand-orange/40 text-brand-orange font-bold shadow-2xs'
                                  : 'bg-surface-container-low border-surface-container text-primary-container hover:bg-surface-container'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-semibold">{group.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 5. Menu flottant de réaction rapide et d'actions (⋯) au survol sur desktop */}
                      {(hoveredMessageId === msg.id || actionMenuMsgId === msg.id) && !isDeleted && (
                        <div
                          className={`absolute ${
                            isSelf ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full ml-2'
                          } top-1 z-20 flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded-xl border border-surface-container shadow-md animate-in fade-in zoom-in-95 duration-100`}
                        >
                          {['👍', '❤️', '🔥', '👏', '😂', '😮'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className="text-sm hover:scale-130 active:scale-95 transition-transform p-0.5 cursor-pointer"
                              title={`Réagir avec ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          {/* Bouton d'action ⋯ pour l'expéditeur */}
                          {isSelf && (
                            <div className="relative border-l border-surface-container pl-1.5 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuMsgId(actionMenuMsgId === msg.id ? null : msg.id);
                                }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-secondary hover:text-primary-container hover:bg-surface-container transition-colors cursor-pointer"
                                title="Options du message"
                              >
                                <Icon name="more_vert" className="text-xs" />
                              </button>

                              {/* Menu contextuel Supprimer */}
                              {actionMenuMsgId === msg.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1.5 w-52 bg-surface-container-lowest rounded-xl border border-surface-container shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuMsgId(null);
                                      setDeleteConfirmModal({ messageId: msg.id, type: 'for_me' });
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-primary-container hover:bg-surface-container flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Icon name="delete" className="text-secondary text-sm" />
                                    <span>Supprimer pour moi</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuMsgId(null);
                                      setDeleteConfirmModal({ messageId: msg.id, type: 'for_everyone' });
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Icon name="delete" className="text-rose-600 text-sm" />
                                    <span>Supprimer pour tout le monde</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Indicateur flottant élégant de nouveaux messages lorsque l'utilisateur lit l'historique */}
          {newMessagesCount > 0 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-auto">
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="px-4 py-2 rounded-full bg-primary-container text-on-primary text-xs font-bold shadow-xl hover:bg-brand-orange hover:shadow-2xl transition-all flex items-center gap-2 cursor-pointer border border-white/20 group"
              >
                <Icon name="arrow_down" className="text-[13px] animate-bounce" />
                <span>
                  {newMessagesCount === 1 ? '↓ 1 nouveau message' : `↓ ${newMessagesCount} nouveaux messages`}
                </span>
              </button>
            </div>
          )}

          {/* Barre d'aperçu d'attachement avant envoi */}
          <PendingAttachmentBar
            attachment={pendingAttachment}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onRemove={() => setPendingAttachment(null)}
          />

          {/* Zone de composition moderne */}
          <div className="p-3 sm:p-4 border-t border-surface-container bg-surface-container-lowest relative">
            {/* Popover Sélecteur d'emojis */}
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onSelectEmoji={handleSelectEmoji}
            />

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* Bouton Pièce jointe / Documents / Images (Signe distinctif clair) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                className="h-11 px-3 sm:px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary-container border border-surface-container flex items-center gap-2 transition-all shrink-0 hover:border-brand-orange/50 group shadow-2xs"
                title="Joindre un document, fichier ou image (PDF, Word, Excel, JPG, PNG, etc.)"
              >
                <div className="w-7 h-7 rounded-lg bg-surface-container group-hover:bg-brand-orange/15 group-hover:text-brand-orange flex items-center justify-center transition-colors text-primary-container">
                  {/* Icône universelle de trombone pour les fichiers & images */}
                  <svg
                    className="w-4 h-4 fill-none stroke-current stroke-[2.3]"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-secondary group-hover:text-primary-container hidden sm:inline">
                  Joindre
                </span>
              </button>

              {/* Champ de texte */}
              <input
                ref={inputRef}
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder={
                  pendingAttachment
                    ? `Ajouter un commentaire pour "${pendingAttachment.name}"...`
                    : activeDiscussion.type === 'direct'
                    ? `Écrire un message à ${activeDiscussion.title}...`
                    : `Partager un message dans "${activeDiscussion.title}"...`
                }
                disabled={sending}
                className="flex-1 h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-xs sm:text-sm border border-surface-container/80 placeholder:text-secondary focus:outline-none focus:border-brand-orange focus:bg-white transition-all disabled:opacity-60"
              />

              {/* Bouton Bitmoji / Emojis (Avatar expressif coloré) */}
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 group ${
                  isEmojiPickerOpen
                    ? 'bg-amber-100 dark:bg-amber-950/40 ring-2 ring-brand-orange'
                    : 'bg-surface-container-low hover:bg-surface-container hover:scale-105 active:scale-95'
                }`}
                title="Choisir un emoji, réaction ou bitmoji"
              >
                {/* Vrai visage Bitmoji expressif coloré */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 flex items-center justify-center shadow-xs border border-amber-600/20 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="16" fill="#FFCC4D" />
                    {/* Yeux pétillants */}
                    <ellipse cx="11.5" cy="13.5" rx="2.2" ry="3.2" fill="#664500" />
                    <ellipse cx="24.5" cy="13.5" rx="2.2" ry="3.2" fill="#664500" />
                    <circle cx="12.3" cy="12.5" r="0.9" fill="#FFFFFF" />
                    <circle cx="25.3" cy="12.5" r="0.9" fill="#FFFFFF" />
                    {/* Joues rosées style Bitmoji */}
                    <circle cx="7.5" cy="18.5" r="2.8" fill="#FF7766" opacity="0.45" />
                    <circle cx="28.5" cy="18.5" r="2.8" fill="#FF7766" opacity="0.45" />
                    {/* Grand sourire communicatif */}
                    <path
                      d="M10.5 20.5C10.5 24.8 13.8 27.5 18 27.5C22.2 27.5 25.5 24.8 25.5 20.5H10.5Z"
                      fill="#664500"
                    />
                    <path
                      d="M13 20.5C13 23.2 15.2 25 18 25C20.8 25 23 23.2 23 20.5H13Z"
                      fill="#FF7766"
                    />
                  </svg>
                </div>
              </button>

              {/* Bouton Envoyer */}
              <Button
                type="submit"
                variant="orange"
                size="md"
                isLoading={sending}
                disabled={(!newMessageText.trim() && !pendingAttachment) || sending}
                icon="send"
                className="h-11 px-4 rounded-xl shrink-0 shadow-sm"
              >
                <span className="hidden sm:inline">Envoyer</span>
              </Button>
            </form>
          </div>
        </div>
      ) : (
        /* LISTE DES DISCUSSIONS AVEC STATUT DE LECTURE ET DERNIERS MESSAGES */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-xl border border-surface-container/60">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === 'all'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-secondary hover:text-primary-container'
                }`}
              >
                Toutes ({discussions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('direct')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === 'direct'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-secondary hover:text-primary-container'
                }`}
              >
                <Icon name="person" className="text-[14px]" />
                Contacts directs ({directCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('project')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === 'project'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-secondary hover:text-primary-container'
                }`}
              >
                <Icon name="rocket_launch" className="text-[14px]" />
                Canaux projets ({projectCount})
              </button>
            </div>

            <Link
              to="/team"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-orange hover:underline px-2 py-1"
            >
              <Icon name="person_add" className="text-[15px]" />
              Nouveau message direct depuis l'annuaire
            </Link>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs divide-y divide-surface-container overflow-hidden">
            {filteredDiscussions.length === 0 ? (
              <div className="py-12 text-center text-secondary text-xs p-6">
                Aucune discussion dans cette catégorie pour le moment.
              </div>
            ) : (
              filteredDiscussions.map((d) => {
                const isDeleted = Boolean(d.lastMessage?.deleted_at);
                const hasUnread = d.unreadCount > 0;
                const lastSender = d.lastMessage?.sender?.full_name || 'Collaborateur';
                const hasAtt = d.lastMessage?.attachments && d.lastMessage.attachments.length > 0;
                const lastText = isDeleted
                  ? 'Message supprimé'
                  : d.lastMessage?.content ||
                    (hasAtt
                      ? d.lastMessage?.attachments?.[0].type === 'image'
                        ? '📷 Image partagée'
                        : '📎 Document partagé'
                      : 'Aucun message pour le moment');

                const formattedTime = formatMessageTime(d.lastMessage?.created_at || d.updatedAt);

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDiscussionId(d.id)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-surface-container-low/60 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {d.type === 'direct' ? (
                        <div className="relative shrink-0 pt-0.5">
                          <img
                            src={d.avatarUrl}
                            alt={d.title}
                            className="w-10 h-10 rounded-xl object-cover ring-1 ring-surface-container"
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
                        </div>
                      ) : (
                        <div className="pt-2 shrink-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full inline-block ${
                              hasUnread
                                ? 'bg-on-tertiary-container animate-pulse shadow-xs'
                                : 'bg-surface-container-high'
                            }`}
                          />
                        </div>
                      )}

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-headline text-sm sm:text-base font-bold text-primary-container group-hover:text-on-tertiary-container transition-colors truncate">
                            {d.title}
                          </h3>

                          {d.type === 'direct' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange">
                              Direct
                            </span>
                          ) : d.project ? (
                            <StatusBadge status={d.project.status} />
                          ) : null}
                        </div>

                        <div className="text-xs text-on-surface-variant truncate mt-1">
                          {d.lastMessage ? (
                            <span>
                              <strong className="text-primary-container font-semibold">
                                {d.lastMessage.sender_id === currentUserId ? 'Moi' : lastSender} :
                              </strong>{' '}
                              <span className={isDeleted ? 'italic text-secondary' : ''}>
                                {lastText}
                              </span>
                            </span>
                          ) : (
                            <span className="text-secondary italic">
                              {d.type === 'direct'
                                ? `Cliquez pour écrire à ${d.title}`
                                : 'Aucun message — Cliquez pour démarrer la discussion'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container/40 text-xs">
                      {d.type === 'project' && d.project?.members && (
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          {d.project.members.slice(0, 3).map((m, idx) => (
                            <img
                              key={idx}
                              src={m.avatar_url}
                              alt={m.full_name}
                              title={m.full_name}
                              className="w-6 h-6 rounded-full object-cover ring-2 ring-surface-container-lowest"
                            />
                          ))}
                        </div>
                      )}

                      {formattedTime && (
                        <span className="text-[11px] text-secondary font-medium whitespace-nowrap font-mono">
                          {formattedTime}
                        </span>
                      )}

                      {hasUnread && (
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-container text-[11px] font-bold shadow-xs whitespace-nowrap">
                          Nouveau
                        </span>
                      )}

                      <Icon
                        name="arrow_forward"
                        className="text-[16px] text-secondary group-hover:text-primary-container group-hover:translate-x-0.5 transition-all hidden sm:block"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
