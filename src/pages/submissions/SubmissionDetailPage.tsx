import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { submissionsService } from '../../services/submissionsService';
import { Submission } from '../../types/database';
import { SubmissionCard } from '../../components/submissions/SubmissionCard';
import { RequestChangesModal } from '../../components/submissions/RequestChangesModal';
import { InspectSubmissionModal } from '../../components/submissions/InspectSubmissionModal';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

export const SubmissionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);

  const loadSubmission = useCallback(async () => {
    if (!id) return;
    try {
      const data = await submissionsService.getById(id);
      setSubmission(data);
    } catch (err) {
      console.warn('[SubmissionDetailPage] Erreur chargement :', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSubmission();

    const unsubscribe = submissionsService.subscribeToSubmissions(() => {
      loadSubmission();
    });

    return () => {
      unsubscribe();
    };
  }, [loadSubmission]);

  const handleValidate = async () => {
    if (!submission) return;
    try {
      const updated = await submissionsService.validateSubmission(
        submission.id,
        user?.id || 'user-admin'
      );
      if (updated) {
        setSubmission(updated);
        showToast(`Livrable « ${updated.title} » validé par la Direction !`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur validation.', 'error');
    }
  };

  const handleRequestChangesSubmit = async (_sid: string, motif: string) => {
    if (!submission) return;
    try {
      const updated = await submissionsService.requestChanges(
        submission.id,
        user?.id || 'user-admin',
        motif
      );
      if (updated) {
        setSubmission(updated);
        showToast('Demande de modifications transmise avec succès !', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur transmission motif.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Icon name="spinner" spin className="text-3xl text-brand-orange" />
        <span className="text-xs text-secondary">Chargement du livrable...</span>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Icon name="search_off" className="text-5xl text-secondary" />
        <p className="text-sm text-secondary">Soumission introuvable.</p>
        <Link to="/submissions" className="text-brand-orange text-sm font-semibold hover:underline">
          ← Retour aux livrables
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full">
      <Breadcrumb
        items={[
          { label: 'Livrables', to: '/submissions', icon: 'rule_folder' },
          { label: submission.title },
        ]}
      />
      <SubmissionCard
        submission={submission}
        onValidate={handleValidate}
        onInspect={() => setIsInspecting(true)}
        onRequestChanges={() => setIsRequestingChanges(true)}
      />

      {/* Modal d'examen */}
      <InspectSubmissionModal
        isOpen={isInspecting}
        onClose={() => setIsInspecting(false)}
        submission={submission}
        isAdmin={isAdmin}
        onValidate={handleValidate}
        onRequestChanges={() => {
          setIsInspecting(false);
          setIsRequestingChanges(true);
        }}
      />

      {/* Modal motif de modifications */}
      <RequestChangesModal
        isOpen={isRequestingChanges}
        onClose={() => setIsRequestingChanges(false)}
        submission={submission}
        onSubmit={handleRequestChangesSubmit}
      />
    </div>
  );
};
