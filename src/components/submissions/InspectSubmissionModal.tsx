import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { Submission, SubmissionFile, SubmissionComment } from '../../types/database';
import { formatRelativeTime, formatDate } from '../../lib/utils';
import { filesService } from '../../services/filesService';
import { submissionsService } from '../../services/submissionsService';
import { useAuth } from '../../contexts/AuthContext';

interface InspectSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
  isAdmin: boolean;
  onValidate?: (submissionId: string) => void;
  onRequestChanges?: (submission: Submission) => void;
  onResubmit?: (submission: Submission) => void;
}

export const InspectSubmissionModal: React.FC<InspectSubmissionModalProps> = ({
  isOpen,
  onClose,
  submission,
  isAdmin,
  onValidate,
  onRequestChanges,
  onResubmit,
}) => {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<SubmissionComment[]>([]);

  React.useEffect(() => {
    if (submission) {
      setLocalComments(submission.comments || []);
      setCommentText('');
    }
  }, [submission]);

  if (!submission) return null;

  const isPending = submission.status === 'PENDING';
  const isApproved = submission.status === 'APPROVED';
  const isChangesRequested = submission.status === 'CHANGES_REQUESTED';
  const isAuthor = user?.id === submission.submitted_by;

  const handleDownloadFile = async (file: SubmissionFile) => {
    setDownloadingFileId(file.id);
    try {
      await filesService.downloadFile({
        id: file.id,
        name: file.file_name,
        file_url: file.file_url,
        storage_path: file.file_url && file.file_url !== '#' ? file.file_url : undefined,
        size_bytes: 0,
        size_formatted: file.file_size,
        file_type: file.file_type,
        project_id: submission.project_id,
        uploaded_by: submission.submitted_by,
        created_at: submission.created_at,
      });
    } catch (err: any) {
      alert(err.message || 'Erreur lors du téléchargement.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    setIsSubmittingComment(true);
    try {
      const newCom = await submissionsService.addSubmissionComment(
        submission.id,
        user.id,
        commentText.trim()
      );
      setLocalComments((prev) => [...prev, newCom]);
      setCommentText('');
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'envoi du commentaire.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Examen du Livrable"
      subtitle="Inspection détaillée des documents, livrables et code soumis"
      maxWidth="xl"
    >
      <div className="flex flex-col gap-5">
        {/* Titre & Statut */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-2xl bg-surface-container-low/70 border border-surface-container">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-base font-bold text-primary-container">
                {submission.title}
              </h3>
              <StatusBadge status={submission.status} />
            </div>
            {submission.project_title && (
              <Link
                to={`/projects/${submission.project_id}`}
                onClick={onClose}
                className="text-xs text-brand-orange hover:underline font-semibold flex items-center gap-1 mt-0.5"
              >
                <Icon name="rocket_launch" className="text-xs" />
                Projet : {submission.project_title}
              </Link>
            )}
            <span className="text-[11px] text-secondary font-mono mt-0.5">
              Déposé {formatRelativeTime(submission.created_at)} ({formatDate(submission.created_at)})
            </span>
          </div>

          {/* Profil Auteur avec raccourci de contact */}
          {submission.author && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-lowest border border-surface-container shrink-0">
              <img
                src={submission.author.avatar_url}
                alt={submission.author.full_name}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-primary-container truncate">
                  {submission.author.full_name}
                </span>
                <span className="text-[10px] text-secondary truncate">
                  {submission.author.job_title || 'Collaborateur'}
                </span>
              </div>
              <Link
                to={`/messages?contact=${submission.submitted_by}`}
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-white transition-colors shrink-0 shadow-2xs ml-1"
                title={`Envoyer un message à ${submission.author.full_name}`}
              >
                <Icon name="chat_bubble" className="text-xs" />
              </Link>
            </div>
          )}
        </div>

        {/* Description & Contexte */}
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Icon name="notes" className="text-sm" />
            Description du travail fourni
          </h4>
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
            {submission.description || 'Aucune description détaillée fournie.'}
          </div>
        </div>

        {/* Documents et Fichiers joints */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <Icon name="attach_file" className="text-sm" />
              Fichiers joints ({submission.files?.length || 0})
            </h4>
            <span className="text-[11px] text-secondary font-mono">
              Stockage privé Supabase Storage
            </span>
          </div>

          {!submission.files || submission.files.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-low text-xs text-secondary text-center">
              Aucun fichier joint à ce livrable.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {submission.files.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between gap-3 hover:border-brand-orange/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
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
                        className="text-[20px]"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-primary-container truncate">
                        {file.file_name}
                      </span>
                      <span className="text-[10px] text-secondary font-mono">
                        Format {file.file_type.toUpperCase()} • {file.file_size}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={downloadingFileId === file.id}
                    onClick={() => handleDownloadFile(file)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-brand-orange hover:text-white text-primary-container text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Icon
                      name={downloadingFileId === file.id ? 'spinner' : 'download'}
                      spin={downloadingFileId === file.id}
                      className="text-sm"
                    />
                    <span>{downloadingFileId === file.id ? 'Chargement...' : 'Télécharger'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remarques / Feedback de la Direction si existant */}
        {submission.feedback && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
              isApproved
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <Icon
              name={isApproved ? 'verified' : 'info'}
              className={`text-[20px] shrink-0 ${isApproved ? 'text-emerald-600' : 'text-brand-orange'}`}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm">
                {isApproved ? 'Validé par la Direction' : 'Motif des modifications demandées'}
              </span>
              <p className="mt-0.5 leading-relaxed">{submission.feedback}</p>
              {submission.reviewed_at && (
                <span className="text-[10px] opacity-75 font-mono mt-1">
                  Émis le {formatDate(submission.reviewed_at)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Section Commentaires / Échanges (public.submission_comments) */}
        <div className="flex flex-col gap-3 pt-2 border-t border-surface-container">
          <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Icon name="forum" className="text-sm" />
            Commentaires & Arbitrage ({localComments.length})
          </h4>

          {localComments.length > 0 && (
            <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
              {localComments.map((com) => (
                <div
                  key={com.id}
                  className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={com.author?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=com'}
                        alt={com.author?.full_name || 'Utilisateur'}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="font-bold text-primary-container">
                        {com.author?.full_name || 'Membre TUWSHIUAH'}
                      </span>
                      {com.author?.role === 'admin' && (
                        <span className="px-1.5 py-0.2 rounded bg-brand-orange/10 text-brand-orange text-[9px] font-bold uppercase">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-secondary font-mono">
                      {formatRelativeTime(com.created_at)}
                    </span>
                  </div>
                  <p className="text-on-surface leading-relaxed pl-7 whitespace-pre-wrap">
                    {com.comment}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire d'ajout de commentaire */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Ajouter une remarque ou consigne..."
              className="flex-1 h-9 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-brand-orange/60 shadow-2xs"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              icon={isSubmittingComment ? 'spinner' : 'send'}
              disabled={!commentText.trim() || isSubmittingComment}
            >
              Envoyer
            </Button>
          </form>
        </div>

        {/* Pied de page et Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
          <Button variant="ghost" size="md" onClick={onClose}>
            Fermer
          </Button>

          <div className="flex items-center gap-2">
            {/* Action Resoumettre pour l'employé auteur si modifications demandées */}
            {isChangesRequested && isAuthor && onResubmit && (
              <Button
                variant="orange"
                size="md"
                icon="refresh"
                onClick={() => {
                  onClose();
                  onResubmit(submission);
                }}
              >
                Corriger & Resoumettre
              </Button>
            )}

            {/* Actions Administrateur */}
            {isAdmin && isPending && (
              <>
                <Button
                  variant="outline"
                  size="md"
                  icon="rate_review"
                  className="text-brand-orange border-brand-orange/40 hover:bg-brand-orange/10"
                  onClick={() => {
                    onClose();
                    onRequestChanges?.(submission);
                  }}
                >
                  Demander modif
                </Button>
                <Button
                  variant="success"
                  size="md"
                  icon="check_circle"
                  onClick={() => {
                    onClose();
                    onValidate?.(submission.id);
                  }}
                >
                  Valider le livrable
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
