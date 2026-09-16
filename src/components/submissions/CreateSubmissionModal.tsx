import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { FileItem, Project, Submission } from '../../types/database';
import { projectService } from '../../services/projectService';
import { filesService } from '../../services/filesService';
import { submissionsService } from '../../services/submissionsService';
import { useAuth } from '../../contexts/AuthContext';

interface CreateSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (submission: Submission) => void;
  resubmitSubmission?: Submission | null;
}

export const CreateSubmissionModal: React.FC<CreateSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  resubmitSubmission,
}) => {
  const { user, isAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les projets accessibles à l'utilisateur
  useEffect(() => {
    if (!isOpen) return;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const list = await projectService.getProjects(user?.id, isAdmin);
        setProjects(list);
        if (resubmitSubmission) {
          setSelectedProjectId(resubmitSubmission.project_id);
          setTitle(resubmitSubmission.title);
          setDescription(resubmitSubmission.description);
          setSelectedFileIds((resubmitSubmission.files || []).map((f) => f.id));
        } else if (list.length > 0) {
          setSelectedProjectId(list[0].id);
          setTitle('');
          setDescription('');
          setSelectedFileIds([]);
        }
      } catch (err: any) {
        console.warn('[CreateSubmissionModal] Erreur chargement projets :', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, [isOpen, user?.id, isAdmin, resubmitSubmission]);

  // Charger les fichiers du projet sélectionné
  useEffect(() => {
    if (!isOpen || !selectedProjectId) {
      setAvailableFiles([]);
      return;
    }

    const loadFiles = async () => {
      setIsLoadingFiles(true);
      try {
        const filesList = await filesService.getFiles(selectedProjectId);
        setAvailableFiles(filesList);
      } catch (err) {
        console.warn('[CreateSubmissionModal] Erreur chargement fichiers projet :', err);
        setAvailableFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    loadFiles();
  }, [isOpen, selectedProjectId]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Le titre du livrable est obligatoire.');
      return;
    }
    if (!selectedProjectId) {
      setErrorMessage('Veuillez sélectionner un projet.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (resubmitSubmission) {
        // Mode Resoumission
        const updated = await submissionsService.submitSubmission(
          resubmitSubmission.id,
          selectedFileIds,
          description.trim()
        );
        onSuccess(updated);
      } else {
        // Mode Nouvelle Soumission
        const created = await submissionsService.createSubmission({
          projectId: selectedProjectId,
          title: title.trim(),
          description: description.trim(),
          fileIds: selectedFileIds,
          submittedBy: user?.id,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la soumission du livrable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resubmitSubmission ? 'Corriger & Resoumettre' : 'Nouveau Livrable'}
      subtitle={
        resubmitSubmission
          ? 'Apportez les corrections demandées par la Direction et resoumettez votre travail'
          : 'Transmettez vos modèles, notebooks et rapports officiels pour validation'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[18px] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Rappel du feedback de la Direction en mode resoumission */}
        {resubmitSubmission?.feedback && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <Icon name="info" className="text-[18px] text-brand-orange shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">Motif des modifications demandées :</span>
              <p className="leading-relaxed">{resubmitSubmission.feedback}</p>
            </div>
          </div>
        )}

        {/* Sélecteur de Projet */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-secondary uppercase tracking-wider">
            Projet concerné *
          </label>
          {isLoadingProjects ? (
            <div className="h-10 px-3 rounded-xl bg-surface-container-low flex items-center text-xs text-secondary">
              Chargement de vos projets...
            </div>
          ) : (
            <select
              value={selectedProjectId}
              disabled={Boolean(resubmitSubmission)}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedFileIds([]);
              }}
              className="h-10 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange/60 shadow-2xs disabled:opacity-60"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.name || 'Projet sans titre'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Titre du livrable */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-secondary uppercase tracking-wider">
            Titre du livrable *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Rapport Sprint 4 - Modèle d'extraction YOLOv8"
            className="h-10 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-brand-orange/60 shadow-2xs"
          />
        </div>

        {/* Description détaillée */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-secondary uppercase tracking-wider">
            Description & Contexte de travail
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Précisez la méthodologie, les résultats obtenus et les points clés à valider..."
            className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-brand-orange/60 shadow-2xs resize-none"
          />
        </div>

        {/* Fichiers joints issus de public.files */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="attach_file" className="text-sm" />
              Sélectionner les fichiers à joindre ({selectedFileIds.length} sélectionné{selectedFileIds.length > 1 ? 's' : ''})
            </label>
            <span className="text-[11px] text-secondary font-mono">
              Fichiers de l'espace projet
            </span>
          </div>

          {isLoadingFiles ? (
            <div className="p-4 rounded-xl bg-surface-container-low text-xs text-secondary text-center">
              Recherche des fichiers du projet...
            </div>
          ) : availableFiles.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container text-xs text-secondary text-center flex flex-col items-center gap-1">
              <span>Aucun fichier présent dans cet espace projet.</span>
              <span className="text-[11px] opacity-75">
                Vous pouvez d'abord téléverser vos documents dans le module Fichiers & Docs.
              </span>
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto flex flex-col gap-1.5 p-1 rounded-xl border border-surface-container bg-surface-container-lowest">
              {availableFiles.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                return (
                  <label
                    key={file.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs border ${
                      isSelected
                        ? 'bg-brand-orange/10 border-brand-orange/40 text-primary-container font-semibold'
                        : 'bg-surface-container-lowest border-transparent hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFileSelection(file.id)}
                        className="rounded accent-brand-orange w-4 h-4 cursor-pointer"
                      />
                      <Icon
                        name={
                          file.file_type === 'pdf'
                            ? 'description'
                            : file.file_type === 'image'
                            ? 'image'
                            : file.file_type === 'binary'
                            ? 'memory'
                            : 'draft'
                        }
                        className="text-[18px] shrink-0"
                      />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-secondary ml-2 shrink-0">
                      {file.size_formatted}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container mt-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="orange"
            size="md"
            icon={isSubmitting ? 'spinner' : 'cloud_upload'}
            disabled={isSubmitting || !title.trim() || !selectedProjectId}
          >
            {isSubmitting
              ? 'Transmission...'
              : resubmitSubmission
              ? 'Resoumettre pour examen'
              : 'Soumettre pour validation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
