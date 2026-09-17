import React from 'react';
import { Icon } from '../ui/Icon';
import { formatFileSize } from '../../services/filesService';
import { FileItem } from '../../types/database';

interface StorageGaugeProps {
  files?: FileItem[];
  totalFilesBytes?: number;
  maxBytes?: number;
}

export const StorageGauge: React.FC<StorageGaugeProps> = ({
  files,
  totalFilesBytes,
  maxBytes = 10 * 1024 * 1024 * 1024, // 10 Go
}) => {
  const fileList = files || [];

  const isAiBinary = (f: FileItem) =>
    f.file_type === 'binary' ||
    /\.(bin|weights|onnx|pt|pth|h5|pkl|safetensors|ckpt|gguf|model)$/i.test(f.name);

  const isDocSpec = (f: FileItem) =>
    !isAiBinary(f) &&
    (f.file_type === 'pdf' ||
      f.file_type === 'document' ||
      /\.(pdf|docx?|txt|md|rtf|odt|pages|pptx?)$/i.test(f.name));

  const isDatasetCode = (f: FileItem) => !isAiBinary(f) && !isDocSpec(f);

  const aiBytes = fileList.filter(isAiBinary).reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const docsBytes = fileList.filter(isDocSpec).reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const dataBytes = fileList.filter(isDatasetCode).reduce((acc, f) => acc + (f.size_bytes || 0), 0);

  const calculatedTotal = aiBytes + docsBytes + dataBytes;
  const usedBytes = files !== undefined ? calculatedTotal : (totalFilesBytes ?? 0);

  const usedPercentage = Math.min(100, Math.max(0, (usedBytes / maxBytes) * 100));
  const freePercentage = Math.max(0, 100 - usedPercentage);
  const formattedUsed = formatFileSize(usedBytes);

  // Largeurs relatives sur la jauge
  let aiWidth = (aiBytes / maxBytes) * 100;
  let docsWidth = (docsBytes / maxBytes) * 100;
  let dataWidth = (dataBytes / maxBytes) * 100;

  // Si l'espace utilisé est non nul mais très faible, garantir un affichage minimal visible pour chaque catégorie active
  if (usedBytes > 0) {
    if (aiBytes > 0 && aiWidth < 0.75) aiWidth = 0.75;
    if (docsBytes > 0 && docsWidth < 0.75) docsWidth = 0.75;
    if (dataBytes > 0 && dataWidth < 0.75) dataWidth = 0.75;
  }

  const freeLabel =
    freePercentage === 100
      ? '100% libre'
      : freePercentage > 99
      ? `${freePercentage.toFixed(1)}% libre`
      : `${Math.round(freePercentage)}% libre`;

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
          {aiWidth > 0 && (
            <div
              className="h-full bg-on-tertiary-container transition-all duration-500"
              style={{ width: `${aiWidth}%` }}
              title={`Modèles IA & Binaires: ${formatFileSize(aiBytes)}`}
            />
          )}
          {docsWidth > 0 && (
            <div
              className="h-full bg-primary-container transition-all duration-500"
              style={{ width: `${docsWidth}%` }}
              title={`Documents & Specs: ${formatFileSize(docsBytes)}`}
            />
          )}
          {dataWidth > 0 && (
            <div
              className="h-full bg-secondary-container transition-all duration-500"
              style={{ width: `${dataWidth}%` }}
              title={`Datasets & Code: ${formatFileSize(dataBytes)}`}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-secondary gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5" title={`Modèles IA: ${formatFileSize(aiBytes)}`}>
              <span className="w-2 h-2 rounded-sm bg-on-tertiary-container shrink-0" />
              <span>Modèles IA &amp; Binaires</span>
              <span className="font-mono text-[11px] text-secondary font-medium">({formatFileSize(aiBytes)})</span>
            </span>
            <span className="flex items-center gap-1.5" title={`Documents: ${formatFileSize(docsBytes)}`}>
              <span className="w-2 h-2 rounded-sm bg-primary-container shrink-0" />
              <span>Documents &amp; Specs</span>
              <span className="font-mono text-[11px] text-secondary font-medium">({formatFileSize(docsBytes)})</span>
            </span>
            <span className="flex items-center gap-1.5" title={`Datasets & Code: ${formatFileSize(dataBytes)}`}>
              <span className="w-2 h-2 rounded-sm bg-secondary-container shrink-0" />
              <span>Datasets &amp; Code</span>
              <span className="font-mono text-[11px] text-secondary font-medium">({formatFileSize(dataBytes)})</span>
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            {freeLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
