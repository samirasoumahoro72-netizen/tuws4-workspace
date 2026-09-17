import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { FileItem, Profile } from '../../types/database';
import { profileService } from '../../services/profileService';
import { filesService } from '../../services/filesService';

interface ShareFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  currentUserId: string;
  onSuccess: (updatedFile: FileItem) => void;
}

export const ShareFileModal: React.FC<ShareFileModalProps> = ({
  isOpen,
  onClose,
  file,
  currentUserId,
  onSuccess,
}) => {
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    // Initialiser les destinataires actuels
    setSelectedUserIds(file.shared_with || []);
    setSearchQuery('');
    setErrorMessage(null);
    setIsLoading(true);

    // Charger les membres de l'équipe
    profileService
      .getAllProfiles()
      .then((allProfiles) => {
        // Exclure le propriétaire actuel de la liste des destinataires
        const otherMembers = allProfiles.filter(
          (p) => p.id !== currentUserId && p.user_id !== currentUserId
        );
        setMembers(otherMembers);
      })
      .catch((err) => {
        console.warn('[ShareFileModal] Erreur chargement membres :', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, file, currentUserId]);

  if (!file) return null;

  const isOwner = file.uploaded_by === currentUserId;

  const handleToggleMember = (memberId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleMakePrivate = () => {
    setSelectedUserIds([]);
  };

  const handleSelectAll = () => {
    setSelectedUserIds(members.map((m) => m.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setErrorMessage("Seul le propriétaire de ce fichier a le droit d'en modifier les partages.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await filesService.shareFile(file.id, selectedUserIds, currentUserId);
      const updated: FileItem = {
        ...file,
        shared_with: selectedUserIds,
      };
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la mise à jour des partages.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.job_title || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partager le document"
      subtitle="Contrôlez précisément qui a accès à ce fichier personnel"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Résumé du fichier */}
        <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0">
              <Icon name="description" className="text-[20px]" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-on-surface truncate">{file.name}</span>
              <span className="text-[11px] text-secondary font-mono">{file.size_formatted}</span>
            </div>
          </div>

          {/* Badge statut actuel */}
          {selectedUserIds.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] font-bold shrink-0">
              <Icon name="lock" className="text-[14px]" />
              Strictement privé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-bold shrink-0">
              <Icon name="group" className="text-[14px]" />
              Partagé ({selectedUserIds.length})
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container text-error text-xs flex items-center gap-2">
            <Icon name="error" className="text-base shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Message informatif de confidentialité */}
        <div className="p-3 rounded-xl bg-primary-container/5 border border-primary-container/10 flex items-start gap-2.5">
          <Icon name="shield" className="text-[18px] text-primary-container shrink-0 mt-0.5" />
          <p className="text-xs text-secondary leading-relaxed">
            Par défaut, vos fichiers sont enregistrés dans votre <strong className="text-primary-container">espace privé</strong>.
            Aucun autre collaborateur ne peut les voir, ni les rechercher. L'accès ne s'ouvre qu'aux personnes que vous sélectionnez ci-dessous.
          </p>
        </div>

        {/* Barre de recherche des collaborateurs */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[16px]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un collègue par nom ou poste..."
              className="w-full h-9 pl-9 pr-4 rounded-xl bg-surface-container-lowest text-xs text-on-surface border border-surface-container focus:outline-none focus:border-brand-orange"
            />
          </div>

          <button
            type="button"
            onClick={handleMakePrivate}
            className="px-2.5 py-1.5 rounded-xl border border-surface-container text-[11px] font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer shrink-0"
            title="Révoquer tous les partages"
          >
            Rendre privé
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-xl border border-surface-container text-[11px] font-semibold text-brand-orange hover:bg-brand-orange/5 transition-colors cursor-pointer shrink-0"
          >
            Tout cocher
          </button>
        </div>

        {/* Liste des collaborateurs avec checkboxes */}
        <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-secondary">
              <Icon name="spinner" spin className="text-2xl text-brand-orange" />
              <span className="text-xs">Chargement de l'équipe...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-6 text-center text-xs text-secondary bg-surface-container-low rounded-xl">
              {searchQuery ? 'Aucun collaborateur trouvé pour cette recherche.' : 'Aucun autre collaborateur enregistré.'}
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedUserIds.includes(member.id);
              return (
                <div
                  key={member.id}
                  onClick={() => handleToggleMember(member.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-brand-orange/5 border-brand-orange shadow-xs'
                      : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container-low/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={
                        member.avatar_url ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.full_name || member.email)}`
                      }
                      alt={member.full_name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {member.full_name}
                        </span>
                        {member.role === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded bg-surface-container text-primary-container text-[10px] font-bold shrink-0">
                            Direction
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-secondary truncate">
                        {member.job_title || 'Collaborateur'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-orange text-white'
                          : 'border border-surface-container bg-surface-container-lowest'
                      }`}
                    >
                      {isSelected && <Icon name="check" className="text-[14px]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions du modal */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
          <span className="text-[11px] text-secondary">
            {selectedUserIds.length === 0
              ? 'Fichier privé à vous seul'
              : `Accessible par vous + ${selectedUserIds.length} collègue(s)`}
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="orange"
              size="sm"
              icon="share"
              disabled={isSubmitting || !isOwner}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le partage'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
