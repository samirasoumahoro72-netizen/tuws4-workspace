import React from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { FileItem } from '../../types/database';
import { formatRelativeTime } from '../../lib/utils';
import { filesService } from '../../services/filesService';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete: (fileId: string) => void;
  onDownload?: (file: FileItem) => void;
  onOpenShare?: (file: FileItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  currentUserId,
  isAdmin = false,
  onDelete,
  onDownload,
  onOpenShare,
}) => {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isSubscribed = true;
    let createdUrl: string | null = null;

    if (isOpen && file && (file.file_type === 'image' || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(file.name))) {
      filesService
        .getFilePreviewUrl(file)
        .then((url) => {
          if (isSubscribed && url) {
            createdUrl = url;
            setPreviewUrl(url);
          }
        })
        .catch(() => {
          if (isSubscribed) setPreviewUrl(null);
        });
    } else {
      setPreviewUrl(null);
    }

    return () => {
      isSubscribed = false;
      if (createdUrl && createdUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, file]);

  if (!file) return null;

  const isOwner = Boolean(currentUserId && file.uploaded_by === currentUserId);
  const sharedCount = (file.shared_with || []).length;

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(file);
    } else {
      try {
        await filesService.downloadFile(file, currentUserId);
      } catch (err: any) {
        alert(err.message || 'Erreur lors du téléchargement.');
      }
    }
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm(`Voulez-vous vraiment supprimer définitivement « ${file.name} » ?`);
    if (confirmDelete) {
      onDelete(file.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Aperçu du Fichier"
      subtitle="Détails du document et métadonnées techniques"
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Header Carte Fichier */}
        <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-surface-container flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0">
            <Icon
              name={
                file.file_type === 'pdf'
                  ? 'picture_as_pdf'
                  : file.file_type === 'binary'
                  ? 'memory'
                  : file.file_type === 'csv'
                  ? 'table_chart'
                  : file.file_type === 'json'
                  ? 'data_object'
                  : file.file_type === 'image'
                  ? 'image'
                  : 'draft'
              }
              className="text-[28px]"
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="font-headline text-base font-bold text-primary-container truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-secondary mt-1 flex-wrap">
              <span className="font-mono">{file.size_formatted}</span>
              <span>•</span>
              <span className="uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-surface-container text-[10px]">
                {file.file_type}
              </span>
              <span>•</span>
              <span>{formatRelativeTime(file.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Détails Techniques & Confidentialité */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
            <span className="text-secondary font-semibold">Téléversé par</span>
            <div className="flex items-center gap-2 mt-1">
              <img
                src={file.uploader?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(file.uploader?.full_name || 'user')}`}
                alt={file.uploader?.full_name || 'Collaborateur'}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="font-bold text-primary-container truncate">
                {isOwner ? 'Vous (Propriétaire)' : (file.uploader?.full_name || 'Collaborateur')}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
            <span className="text-secondary font-semibold">Niveau de visibilité</span>
            <div className="flex items-center gap-1.5 mt-1 font-bold">
              {isOwner ? (
                sharedCount === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <Icon name="lock" className="text-[14px]" />
                    Espace privé (Strictement confidentiel)
                  </span>
                ) : (
                  <span className="text-brand-orange flex items-center gap-1">
                    <Icon name="group" className="text-[14px]" />
                    Partagé avec {sharedCount} collaborateur(s)
                  </span>
                )
              ) : (
                <span className="text-primary-container flex items-center gap-1">
                  <Icon name="mark_email_read" className="text-[14px] text-brand-orange" />
                  Partagé avec vous
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Aperçu du contenu si image */}
        {previewUrl ? (
          <div className="relative rounded-2xl overflow-hidden bg-surface-container-low border border-surface-container p-2 flex items-center justify-center group min-h-[160px]">
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-72 max-w-full object-contain rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-dashed border-surface-container-high flex flex-col items-center justify-center text-center gap-2">
            <Icon name="shield" className="text-3xl text-primary-container" />
            <span className="text-xs font-semibold text-primary-container">
              Espace de stockage privé et sécurisé
            </span>
            <span className="text-[11px] text-secondary max-w-md">
              {isOwner
                ? 'Ce fichier réside dans votre espace personnel. Vous seul contrôlez qui peut y avoir accès.'
                : `Ce fichier a été mis à votre disposition par ${file.uploader?.full_name || 'un collègue'}.`}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
          {isOwner || isAdmin ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon="delete"
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          ) : (
            <span className="text-[11px] text-secondary">Lecture seule</span>
          )}

          <div className="flex items-center gap-2">
            {isOwner && onOpenShare && (
              <Button
                type="button"
                variant="orange"
                size="sm"
                icon="share"
                onClick={() => {
                  onClose();
                  onOpenShare(file);
                }}
              >
                Partager
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Fermer
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon="download"
              onClick={handleDownload}
            >
              Télécharger
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
