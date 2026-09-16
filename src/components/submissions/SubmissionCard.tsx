import React from 'react';
import { Submission } from '../../types/database';
import { StatusBadge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface SubmissionCardProps {
  submission: Submission;
  onValidate?: (id: string) => void;
  onInspect?: (submission: Submission) => void;
  onRequestChanges?: (submission: Submission) => void;
  onResubmit?: (submission: Submission) => void;
}

export const SubmissionCard: React.FC<SubmissionCardProps> = ({
  submission,
  onValidate,
  onInspect,
  onRequestChanges,
  onResubmit,
}) => {
  const { user, isAdmin } = useAuth();
  const isPending = submission.status === 'PENDING';
  const isApproved = submission.status === 'APPROVED';

  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
            <Icon
              name={
                submission.title.includes('Vision') || submission.title.includes('IA')
                  ? 'smart_toy'
                  : submission.title.includes('Réseau') || submission.title.includes('Audit')
                  ? 'security'
                  : 'rule_folder'
              }
              className="text-[22px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-headline text-base font-bold text-primary-container truncate">
              {submission.title}
            </h3>
            <p className="text-xs text-secondary flex items-center gap-1 mt-0.5">
              <span>Soumis par</span>
              <strong className="font-semibold text-on-surface">
                {submission.author?.full_name || 'Collaborateur'}
              </strong>
              <span>• {formatRelativeTime(submission.created_at)}</span>
            </p>
          </div>
        </div>

        <StatusBadge status={submission.status} />
      </div>

      <p className="text-xs text-on-surface-variant leading-relaxed">
        {submission.description}
      </p>

      {/* Attached Files Strip */}
      {submission.files && submission.files.length > 0 && (
        <div className="flex flex-col gap-2">
          {submission.files.map((file) => (
            <div
              key={file.id}
              className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between text-secondary text-xs border border-surface-container/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon
                  name={
                    file.file_type === 'pdf'
                      ? 'description'
                      : file.file_type === 'binary'
                      ? 'memory'
                      : 'draft'
                  }
                  className="text-[18px] text-primary-container shrink-0"
                />
                <span className="truncate font-medium text-on-surface">{file.file_name}</span>
              </div>
              <span className="text-[11px] font-mono text-secondary shrink-0 ml-2">
                {file.file_size}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Feedback banner if approved or changes requested */}
      {submission.feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            isApproved
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          <Icon
            name={isApproved ? 'verified' : 'info'}
            className={`text-[18px] shrink-0 ${isApproved ? 'text-emerald-600' : 'text-brand-orange'}`}
          />
          <div className="flex flex-col">
            <span className="font-bold">
              {isApproved ? 'Validé par la Direction' : 'Remarques de la Direction'} :
            </span>
            <span className="mt-0.5">{submission.feedback}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2.5 pt-1">
        <Button
          variant="secondary"
          size="sm"
          icon="visibility"
          className="flex-1"
          onClick={() => onInspect?.(submission)}
        >
          Examiner
        </Button>

        {/* Action Corriger & Resoumettre pour l'employé auteur */}
        {submission.status === 'CHANGES_REQUESTED' && (user?.id === submission.submitted_by || !isAdmin) && onResubmit && (
          <Button
            variant="orange"
            size="sm"
            icon="refresh"
            onClick={() => onResubmit(submission)}
          >
            Corriger & Resoumettre
          </Button>
        )}

        {isAdmin && isPending && (
          <>
            <Button
              variant="outline"
              size="sm"
              icon="rate_review"
              className="text-brand-orange border-brand-orange/40 hover:bg-brand-orange/10"
              onClick={() => onRequestChanges?.(submission)}
            >
              Demander modif
            </Button>
            <Button
              variant="success"
              size="sm"
              icon="check_circle"
              className="flex-1"
              onClick={() => onValidate?.(submission.id)}
            >
              Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
