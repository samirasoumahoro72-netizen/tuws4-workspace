import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Folder } from '../../types/database';
import { filesService, formatFileSize, detectFileType } from '../../services/filesService';
import { validateUploadFile } from '../../lib/security';

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId?: string | null;
  onSuccess: (fileName: string) => void;
  currentUserId: string;
}

export const UploadFileModal: React.FC<UploadFileModalProps> = ({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onSuccess,
  currentUserId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string>(currentFolderId || '');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setFolderId(currentFolderId || '');
      setErrorMessage(null);
      setIsDragOver(false);
    }
  }, [isOpen, currentFolderId]);

  const processFile = (file: File) => {
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Fichier non autorisé.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Veuillez sélectionner un fichier à téléverser.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      await filesService.uploadFile({
        file: selectedFile,
        name: selectedFile.name,
        size_bytes: selectedFile.size,
        size_formatted: formatFileSize(selectedFile.size),
        file_type: detectFileType(selectedFile.name),
        mime_type: selectedFile.type,
        folder_id: folderId || null,
        uploaded_by: currentUserId,
      });

      onSuccess(selectedFile.name);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du téléversement.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Téléverser un fichier"
      subtitle="Ajoutez des spécifications, modèles, datasets ou documents"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[18px] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dossier de destination */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
            <Icon name="folder" className="text-sm text-secondary" />
            Dossier de destination
          </label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors cursor-pointer"
          >
            <option value="">(Racine de l'espace de fichiers)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.files_count} fichiers)
              </option>
            ))}
          </select>
        </div>

        {/* Zone de glisser-déposer */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center ${
            isDragOver
              ? 'border-brand-orange bg-brand-orange/5 scale-[1.01]'
              : selectedFile
              ? 'border-emerald-500/60 bg-emerald-50/20'
              : 'border-surface-container-high bg-surface-container-low/40 hover:bg-surface-container-low hover:border-brand-orange/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Icon name="check" className="text-xl font-bold" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-primary-container truncate max-w-[280px]">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-secondary font-mono">
                  {formatFileSize(selectedFile.size)} • Format {detectFileType(selectedFile.name).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-primary-container shadow-xs">
                <Icon name="cloud_upload" className="text-2xl text-brand-orange" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-primary-container">
                  Glissez-déposez votre fichier ici
                </span>
                <span className="text-xs text-secondary mt-0.5">
                  ou cliquez pour parcourir vos dossiers locaux (PDF, IA, Images, Code...)
                </span>
                <span className="text-[11px] text-outline mt-1 font-medium">
                  🔒 Limite : 50 Mo max • Fichiers exécutables (.exe, .bat, scripts) interdits
                </span>
              </div>
            </>
          )}
        </div>

        {/* Boutons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container mt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isUploading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="orange"
            size="md"
            icon="cloud_upload"
            isLoading={isUploading}
            disabled={!selectedFile}
          >
            Téléverser le fichier
          </Button>
        </div>
      </form>
    </Modal>
  );
};
