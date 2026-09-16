import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { filesService } from '../../services/filesService';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (folderName: string) => void;
  currentUserId: string;
  currentFolderId?: string | null;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserId,
  currentFolderId,
}) => {
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setErrorMessage('Le nom du dossier est obligatoire.');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      await filesService.addFolder(
        folderName.trim(),
        undefined,
        currentUserId,
        currentFolderId || null
      );
      onSuccess(folderName.trim());
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création du dossier.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Créer un nouveau dossier"
      subtitle="Organisez vos ressources techniques et documents de travail"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[18px] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
            <Icon name="folder" className="text-sm text-secondary" />
            Nom du dossier <span className="text-on-tertiary-container">*</span>
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Ex : 05_Modèles & Entraînements, Livrables_Sprint_4..."
            className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
            required
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container mt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isCreating}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon="create_new_folder"
            isLoading={isCreating}
          >
            Créer le dossier
          </Button>
        </div>
      </form>
    </Modal>
  );
};
