import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { SubmissionCard } from '../../components/submissions/SubmissionCard';
import { RequestChangesModal } from '../../components/submissions/RequestChangesModal';
import { InspectSubmissionModal } from '../../components/submissions/InspectSubmissionModal';
import { CreateSubmissionModal } from '../../components/submissions/CreateSubmissionModal';
import { submissionsService } from '../../services/submissionsService';
import { Submission } from '../../types/database';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

export const SubmissionsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectingSubmission, setInspectingSubmission] = useState<Submission | null>(null);
  const [requestingChangesSubmission, setRequestingChangesSubmission] = useState<Submission | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resubmittingSubmission, setResubmittingSubmission] = useState<Submission | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await submissionsService.getAll();
      setSubmissions(data);
    } catch (err) {
      console.warn('[SubmissionsPage] Erreur chargement :', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();

    const unsubscribe = submissionsService.subscribeToSubmissions(() => {
      loadSubmissions();
    });

    return () => {
      unsubscribe();
    };
  }, [loadSubmissions]);

  // Actions de validation
  const handleValidate = async (submissionId: string) => {
    try {
      const updated = await submissionsService.validateSubmission(
        submissionId,
        user?.id || 'user-admin'
      );
      if (updated) {
        showToast(`Livrable « ${updated.title} » validé par la Direction !`, 'success');
        loadSubmissions();
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la validation.', 'error');
    }
  };

  // Demande de modifications avec motif
  const handleRequestChangesSubmit = async (submissionId: string, motif: string) => {
    try {
      const updated = await submissionsService.requestChanges(
        submissionId,
        user?.id || 'user-admin',
        motif
      );
      if (updated) {
        showToast(
          `Demande de modifications transmise à ${updated.author?.full_name || 'l’auteur'} !`,
          'success'
        );
        loadSubmissions();
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la transmission du motif.', 'error');
    }
  };

  const visibleSubmissions = isAdmin
    ? submissions
    : submissions.filter((s) => s.submitted_by === user?.id || !s.submitted_by);

  const pendingSubmissions = visibleSubmissions.filter((s) => s.status === 'PENDING');
  const reviewedSubmissions = visibleSubmissions.filter((s) => s.status !== 'PENDING');
  const approvedCount = visibleSubmissions.filter((s) => s.status === 'APPROVED').length;
  const changesCount = visibleSubmissions.filter((s) => s.status === 'CHANGES_REQUESTED').length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-primary-container tracking-tight">
            {isAdmin ? 'Validation des Livrables' : 'Mes Soumissions'}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-secondary font-medium">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
              {pendingSubmissions.length} en attente
            </span>
            <span className="text-secondary text-[11px]">•</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {approvedCount} validés
            </span>
            {changesCount > 0 && (
              <>
                <span className="text-secondary text-[11px]">•</span>
                <span className="flex items-center gap-1.5 text-xs text-brand-orange font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-orange" />
                  {changesCount} modifs requises
                </span>
              </>
            )}
          </div>
        </div>

        <Button
          variant="orange"
          size="sm"
          icon="add"
          onClick={() => {
            setResubmittingSubmission(null);
            setIsCreateModalOpen(true);
          }}
        >
          + Nouveau livrable
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Icon name="spinner" spin className="text-3xl text-brand-orange" />
          <span className="text-xs text-secondary">Chargement des livrables...</span>
        </div>
      ) : (
        <>
          {/* Section: En attente de validation */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container" />
                <h2 className="font-headline text-base font-bold text-primary-container">
                  {isAdmin ? 'En attente de validation' : 'Soumissions en attente'}
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-on-tertiary-container/10 text-on-tertiary-container">
                  {pendingSubmissions.length}
                </span>
              </div>
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-surface-container bg-surface-container-lowest flex flex-col items-center justify-center gap-2">
                <Icon name="task_alt" className="text-3xl text-emerald-500" />
                <p className="text-xs font-semibold text-on-surface">
                  Tous les livrables en attente ont été traités !
                </p>
                <p className="text-[11px] text-secondary">
                  Aucun document en attente d'arbitrage hiérarchique.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingSubmissions.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    submission={sub}
                    onValidate={(id) => handleValidate(id)}
                    onInspect={(s) => setInspectingSubmission(s)}
                    onRequestChanges={(s) => setRequestingChangesSubmission(s)}
                    onResubmit={(s) => {
                      setResubmittingSubmission(s);
                      setIsCreateModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section: Livrables traités */}
          {reviewedSubmissions.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Icon name="verified" className="text-[18px] text-emerald-600" />
                <h2 className="font-headline text-base font-bold text-primary-container">
                  Livrables traités
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-container text-secondary">
                  {reviewedSubmissions.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {reviewedSubmissions.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    submission={sub}
                    onInspect={(s) => setInspectingSubmission(s)}
                    onResubmit={(s) => {
                      setResubmittingSubmission(s);
                      setIsCreateModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modale d'examen complet */}
      <InspectSubmissionModal
        isOpen={Boolean(inspectingSubmission)}
        onClose={() => setInspectingSubmission(null)}
        submission={inspectingSubmission}
        isAdmin={isAdmin}
        onValidate={(id) => handleValidate(id)}
        onRequestChanges={(s) => {
          setInspectingSubmission(null);
          setRequestingChangesSubmission(s);
        }}
        onResubmit={(s) => {
          setInspectingSubmission(null);
          setResubmittingSubmission(s);
          setIsCreateModalOpen(true);
        }}
      />

      {/* Modale de demande de modifications avec motif */}
      <RequestChangesModal
        isOpen={Boolean(requestingChangesSubmission)}
        onClose={() => setRequestingChangesSubmission(null)}
        submission={requestingChangesSubmission}
        onSubmit={handleRequestChangesSubmit}
      />

      {/* Modale de Création / Resoumission de Livrable */}
      <CreateSubmissionModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setResubmittingSubmission(null);
        }}
        resubmitSubmission={resubmittingSubmission}
        onSuccess={(sub) => {
          showToast(
            resubmittingSubmission
              ? `Livrable « ${sub.title} » corrigé et resoumis !`
              : `Livrable « ${sub.title} » soumis pour validation !`,
            'success'
          );
          loadSubmissions();
        }}
      />
    </div>
  );
};
