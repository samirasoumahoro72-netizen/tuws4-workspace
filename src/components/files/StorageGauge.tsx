import React from 'react';
import { Icon } from '../ui/Icon';
import { formatFileSize } from '../../services/filesService';

interface StorageGaugeProps {
  totalFilesBytes?: number;
  maxBytes?: number;
}

export const StorageGauge: React.FC<StorageGaugeProps> = ({
  totalFilesBytes = 2400000000,
  maxBytes = 10000000000,
}) => {
  const usedPercentage = Math.min(100, Math.max(1, Math.round((totalFilesBytes / maxBytes) * 100)));
  const freePercentage = Math.max(0, 100 - usedPercentage);
  const formattedUsed = formatFileSize(totalFilesBytes);

  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-surface-container-highest/40 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h2 className="font-headline text-lg font-bold text-primary-container">
              Explorateur de Fichiers
            </h2>
            <Icon name="verified" className="text-on-tertiary-container text-[18px]" />
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Espace centralisé de gouvernance technique &amp; IA TUWSHIUAH
          </p>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-[11px] font-semibold text-secondary uppercase">
            Stockage Utilisé
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-headline text-lg font-extrabold text-primary-container">
              {formattedUsed}
            </span>
            <span className="text-xs text-secondary">/ 10 Go</span>
          </div>
        </div>
      </div>

      {/* Segmented storage gauge bar */}
      <div className="flex flex-col gap-2 w-full pt-1 relative z-10">
        <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden flex">
          <div
            className="h-full bg-on-tertiary-container rounded-l-full transition-all duration-300"
            style={{ width: `${Math.round(usedPercentage * 0.65)}%` }}
          />
          <div
            className="h-full bg-primary-container transition-all duration-300"
            style={{ width: `${Math.round(usedPercentage * 0.25)}%` }}
          />
          <div
            className="h-full bg-secondary-container transition-all duration-300"
            style={{ width: `${Math.round(usedPercentage * 0.10)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-secondary gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-on-tertiary-container" />
              <span>Modèles IA &amp; Binaires</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary-container" />
              <span>Documents &amp; Specs</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-secondary-container" />
              <span>Datasets &amp; Code</span>
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            {freePercentage}% libre
          </span>
        </div>
      </div>
    </div>
  );
};
