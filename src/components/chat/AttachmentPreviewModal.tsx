import React from 'react';
import { Icon } from '../ui/Icon';
import { MessageAttachment } from '../../types/database';

interface ImageLightboxProps {
  isOpen: boolean;
  attachment: MessageAttachment | null;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  attachment,
  onClose,
}) => {
  if (!isOpen || !attachment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
        {/* Barre de contrôle supérieure */}
        <div className="w-full flex items-center justify-between pb-3 text-white">
          <div className="flex items-center gap-2 truncate">
            <Icon name="image" className="text-brand-orange text-lg" />
            <span className="text-sm font-semibold truncate">{attachment.name}</span>
            <span className="text-xs text-white/60">({attachment.size_formatted})</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={attachment.url}
              download={attachment.name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <Icon name="download" className="text-[14px]" />
              <span>Télécharger</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        {/* Image agrandie */}
        <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center max-h-[80vh]">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-[78vh] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};

interface PendingAttachmentBarProps {
  attachment: MessageAttachment | null;
  uploading: boolean;
  uploadProgress: number;
  onRemove: () => void;
}

export const PendingAttachmentBar: React.FC<PendingAttachmentBarProps> = ({
  attachment,
  uploading,
  uploadProgress,
  onRemove,
}) => {
  if (!attachment && !uploading) return null;

  return (
    <div className="px-4 py-2.5 bg-surface-container-low/90 border-t border-surface-container flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Vignette ou Icône document */}
        {attachment?.type === 'image' ? (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="w-10 h-10 rounded-lg object-cover ring-1 ring-surface-container shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
            <Icon name="description" className="text-[20px]" />
          </div>
        )}

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-bold text-primary-container truncate">
            {attachment?.name || 'Téléversement en cours...'}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-secondary">
              {attachment ? attachment.size_formatted : `${uploadProgress}%`}
            </span>
            {uploading && (
              <div className="w-28 h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div
                  className="h-full bg-brand-orange transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={uploading}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-error hover:bg-error-container/20 transition-colors"
        title="Retirer cette pièce jointe"
      >
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
};
