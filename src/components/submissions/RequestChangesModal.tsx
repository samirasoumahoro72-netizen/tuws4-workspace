import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Submission } from '../../types/database';

interface RequestChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
  onSubmit: (submissionId: string, motif: string) => Promise<void>;
}

export const RequestChangesModal: React.FC<RequestChangesModalProps> = ({
  isOpen,
  onClose,
  submission,
  onSubmit,
}) => {
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotif('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!submission) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motif.trim()) {
      setErrorMessage('Veuillez renseigner le motif des modifications demandées.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit(submission.id, motif.trim());
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’envoi de la demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Demander des modifications"
      subtitle="Précisez les ajustements requis avant validation officielle"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[18px] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Rappel du livrable */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container/60 flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Livrable ciblé
          </span>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-headline text-sm font-bold text-primary-container truncate">
              {submission.title}
            </h4>
            <span className="text-xs text-secondary shrink-0 font-medium">
              Par {submission.author?.full_name || 'Collaborateur'}
            </span>
          </div>
          {submission.project_title && (
            <span className="text-xs text-on-tertiary-container font-semibold">
              Projet : {submission.project_title}
            </span>
          )}
        </div>

        {/* Motif obligatoire */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
            <Icon name="rate_review" className="text-sm text-secondary" />
            Motif & Consignes de correction <span className="text-on-tertiary-container">*</span>
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Veuillez corriger le schéma d'architecture pour inclure le sous-réseau VPN secondaire et re-générer le livrable PDF."
            rows={4}
            className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors resize-none leading-relaxed"
            required
            autoFocus
          />
          <span className="text-[11px] text-secondary">
            Ce motif sera notifié en direct au collaborateur et affiché sur son tableau de bord.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container mt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="orange"
            size="md"
            icon="send"
            isLoading={isSubmitting}
          >
            Transmettre la demande
          </Button>
        </div>
      </form>
    </Modal>
  );
};
