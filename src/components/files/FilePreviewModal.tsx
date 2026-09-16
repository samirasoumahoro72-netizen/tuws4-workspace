import React from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { FileItem } from '../../types/database';
import { formatRelativeTime, formatDate } from '../../lib/utils';
import { filesService } from '../../services/filesService';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onDelete: (fileId: string) => void;
  onDownload?: (file: FileItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDelete,
  onDownload,
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

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(file);
    } else {
      try {
        await filesService.downloadFile(file);
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

        {/* Détails Techniques & Auteur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
            <span className="text-secondary font-semibold">Téléversé par</span>
            <div className="flex items-center gap-2 mt-1">
              <img
                src={file.uploader?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                alt={file.uploader?.full_name || 'Collaborateur'}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="font-bold text-primary-container truncate">
                {file.uploader?.full_name || 'Collaborateur'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
            <span className="text-secondary font-semibold">Date d'importation</span>
            <span className="font-bold text-primary-container mt-1">
              {formatDate(file.created_at)}
            </span>
          </div>
        </div>

        {/* Aperçu Visuel ou Carte Document */}
        {previewUrl ? (
          <div className="p-3 rounded-2xl bg-surface-container-lowest border border-surface-container flex flex-col items-center justify-center max-h-80 overflow-hidden group relative">
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-72 max-w-full object-contain rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-surface-container-lowest border border-dashed border-surface-container-high flex flex-col items-center justify-center text-center gap-2">
            <Icon name="verified_user" className="text-3xl text-emerald-600" />
            <span className="text-xs font-semibold text-primary-container">
              Document vérifié et stocké en haute disponibilité
            </span>
            <span className="text-[11px] text-secondary max-w-xs">
              Le fichier est accessible en lecture et téléchargement direct pour l'ensemble des collaborateurs du projet.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon="delete"
            onClick={handleDelete}
          >
            Supprimer
          </Button>

          <div className="flex items-center gap-2">
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
