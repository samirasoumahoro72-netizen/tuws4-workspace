import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { StorageGauge } from '../../components/files/StorageGauge';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { UploadFileModal } from '../../components/files/UploadFileModal';
import { CreateFolderModal } from '../../components/files/CreateFolderModal';
import { FilePreviewModal } from '../../components/files/FilePreviewModal';
import { ShareFileModal } from '../../components/files/ShareFileModal';
import { filesService } from '../../services/filesService';
import { FileItem, Folder } from '../../types/database';
import { formatRelativeTime } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

type SortOption = 'date' | 'name' | 'size';
type FileTab = 'private' | 'shared';

export const FilesPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentTab, setCurrentTab] = useState<FileTab>('private');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Recherche et Tri
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<FileItem | null>(null);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fldList, flList] = await Promise.all([
        filesService.getFolders(undefined, undefined, user?.id),
        filesService.getAllFiles(undefined, user?.id),
      ]);
      setFolders(fldList);
      setFiles(flList);
    } catch (err) {
      console.warn('[FilesPage] Erreur chargement données fichiers :', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();

    const unsubscribe = filesService.subscribeToFiles(() => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Prise en charge des liens de notification (?tab=shared et ?highlight=fileId)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const highlightId = searchParams.get('highlight');

    if (tabParam === 'shared') {
      setCurrentTab('shared');
    }

    if (highlightId && files.length > 0) {
      const targetFile = files.find((f) => f.id === highlightId);
      if (targetFile) {
        if (targetFile.uploaded_by !== user?.id) {
          setCurrentTab('shared');
        }
        setPreviewingFile(targetFile);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('highlight');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, files, user?.id, setSearchParams]);

  // Fermer le menu d'options dossier au clic extérieur
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveFolderMenuId(null);
      setShowSortMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Téléchargement direct d'un fichier via Signed URL
  const handleDownload = async (file: FileItem) => {
    try {
      showToast(`Téléchargement de « ${file.name} » en cours...`, 'info');
      await filesService.downloadFile(file, user?.id);
      showToast(`Téléchargement de « ${file.name} » terminé.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du téléchargement.', 'error');
    }
  };

  // Suppression de fichier (autorisée pour le propriétaire uniquement)
  const handleDeleteFile = async (fileId: string) => {
    try {
      await filesService.deleteFile(fileId, user?.id);
      showToast('Fichier supprimé avec succès.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suppression.', 'error');
    }
  };

  // Suppression de dossier
  const handleDeleteFolder = async (folder: Folder) => {
    const confirmDelete = window.confirm(
      `Êtes-vous certain de vouloir supprimer le dossier « ${folder.name} » et tous les fichiers qu'il contient ?`
    );
    if (!confirmDelete) return;

    try {
      await filesService.deleteFolder(folder.id, user?.id);
      if (currentFolderId === folder.id) {
        setCurrentFolderId(null);
      }
      showToast(`Dossier « ${folder.name} » supprimé.`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer ce dossier.', 'error');
    }
  };

  // Séparation étanche : mes fichiers privés vs fichiers partagés avec moi
  const myPrivateFiles = files.filter((f) => f.uploaded_by === user?.id);
  const sharedWithMeFiles = files.filter(
    (f) => f.uploaded_by !== user?.id && (f.shared_with || []).includes(user?.id || '')
  );

  // Fichiers du tab actif
  const activeTabFiles = currentTab === 'private' ? myPrivateFiles : sharedWithMeFiles;

  // Filtrage des dossiers (disponibles uniquement dans l'espace personnel)
  const filteredFolders = folders.filter((f) => {
    if (currentTab !== 'private') return false;
    if (currentFolderId !== null) return false;
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Fichiers affichés après recherche et tri
  const displayedFiles = activeTabFiles
    .filter((file) => {
      if (currentTab === 'private' && currentFolderId !== null) {
        return file.folder_id === currentFolderId;
      }
      return true;
    })
    .filter((file) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        file.name.toLowerCase().includes(q) ||
        (file.uploader?.full_name || '').toLowerCase().includes(q) ||
        (file.file_type || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.size_bytes || 0) - (a.size_bytes || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Calcul du stockage consommé par les fichiers de l'utilisateur
  const myFilesBytes = myPrivateFiles.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'binary':
        return 'memory';
      case 'csv':
        return 'table_chart';
      case 'json':
        return 'data_object';
      case 'image':
        return 'image';
      case 'code':
        return 'terminal';
      default:
        return 'draft';
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">
      {/* Fil d'Ariane dynamique */}
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={
            currentFolder
              ? [
                  {
                    label: 'Mon espace privé',
                    to: '/files',
                    icon: 'lock',
                    onClick: (e: React.MouseEvent) => {
                      e.preventDefault();
                      setCurrentFolderId(null);
                    },
                  },
                  { label: currentFolder.name, icon: 'folder_open' },
                ]
              : [
                  { label: 'Espace Fichiers Sécurisé', icon: 'shield' },
                  {
                    label:
                      currentTab === 'private'
                        ? 'Mon Espace Privé'
                        : 'Fichiers Partagés avec moi',
                  },
                ]
          }
        />
        <div className="flex items-center gap-1.5 text-secondary shrink-0 font-mono text-[11px] bg-surface-container-lowest px-2.5 py-1 rounded-full shadow-sm border border-surface-container">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Espace 100% Chiffré & Cloisonné</span>
        </div>
      </div>

      {/* Jauge de stockage privé */}
      <StorageGauge files={myPrivateFiles} totalFilesBytes={myFilesBytes} />

      {/* Sélecteur d'Espaces : Privé vs Partagés avec moi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrentTab('private');
              setCurrentFolderId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'private'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Icon name="lock" className="text-[16px]" />
            <span>Mon espace privé</span>
            <span
              className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                currentTab === 'private'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container text-secondary'
              }`}
            >
              {myPrivateFiles.length}
            </span>
          </button>

          <button
            onClick={() => {
              setCurrentTab('shared');
              setCurrentFolderId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'shared'
                ? 'bg-brand-orange text-white shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Icon name="mark_email_read" className="text-[16px]" />
            <span>Partagés avec moi</span>
            <span
              className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                currentTab === 'shared'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container text-secondary'
              }`}
            >
              {sharedWithMeFiles.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-secondary">
          {currentTab === 'private'
            ? '🔐 Vos fichiers téléversés sont strictement privés par défaut'
            : '📬 Fichiers que d’autres collaborateurs ont expressément partagés avec vous'}
        </span>
      </div>

      {/* Actions Principales (Ajout dans l'espace personnel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="orange"
          icon="cloud_upload"
          className="shadow-sm"
          onClick={() => setIsUploadModalOpen(true)}
        >
          + Téléverser un fichier dans mon espace privé
        </Button>
        <Button
          variant="secondary"
          icon="create_new_folder"
          onClick={() => setIsCreateFolderModalOpen(true)}
        >
          + Nouveau dossier personnel
        </Button>
      </div>

      {/* Barre de Recherche et Sélecteur de Tri */}
      <div className="flex items-center gap-2 relative">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[16px]"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-secondary text-sm border border-surface-container focus:outline-none focus:border-brand-orange/60 shadow-sm"
            placeholder={
              currentTab === 'private'
                ? 'Rechercher dans mes documents privés...'
                : 'Rechercher parmi les fichiers reçus...'
            }
            type="text"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface"
            >
              <Icon name="close" className="text-sm" />
            </button>
          )}
        </div>

        {/* Menu déroulant de tri */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSortMenu(!showSortMenu);
            }}
            className="h-10 px-3 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low rounded-xl shadow-sm border border-surface-container flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Icon name="swap_vert" className="text-[18px] text-secondary" />
            <span className="hidden sm:inline text-secondary">Trier :</span>
            <span className="text-primary-container font-bold capitalize">
              {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Nom' : 'Taille'}
            </span>
            <Icon name="expand_more" className="text-[16px] text-secondary" />
          </button>

          {showSortMenu && (
            <div
              className="absolute right-0 mt-1.5 w-36 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container p-1 z-40 text-xs flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setSortBy('date');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  sortBy === 'date'
                    ? 'bg-brand-orange/10 text-brand-orange font-bold'
                    : 'hover:bg-surface-container-low text-on-surface'
                }`}
              >
                Date récente
              </button>
              <button
                onClick={() => {
                  setSortBy('name');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  sortBy === 'name'
                    ? 'bg-brand-orange/10 text-brand-orange font-bold'
                    : 'hover:bg-surface-container-low text-on-surface'
                }`}
              >
                Nom (A - Z)
              </button>
              <button
                onClick={() => {
                  setSortBy('size');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  sortBy === 'size'
                    ? 'bg-brand-orange/10 text-brand-orange font-bold'
                    : 'hover:bg-surface-container-low text-on-surface'
                }`}
              >
                Taille (Décroissant)
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Icon name="spinner" spin className="text-3xl text-brand-orange" />
          <span className="text-xs text-secondary">
            Chargement sécurisé de vos fichiers personnels...
          </span>
        </div>
      ) : (
        <>
          {/* Section Dossiers personnels (visible dans Mon espace privé à la racine) */}
          {currentTab === 'private' && currentFolderId === null && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-base font-bold text-primary-container">
                    Mes dossiers personnels
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-bold">
                    {filteredFolders.length}
                  </span>
                </div>
              </div>

              {filteredFolders.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-surface-container bg-surface-container-lowest text-xs text-secondary">
                  {searchQuery
                    ? 'Aucun dossier personnel ne correspond à votre recherche.'
                    : 'Aucun dossier créé dans votre espace pour le moment.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm hover:shadow-md hover:border-brand-orange/40 transition-all active:scale-[0.99] flex flex-col justify-between gap-3 group cursor-pointer relative"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container group-hover:scale-105 transition-transform">
                          <Icon name="folder_copy" className="text-[24px]" />
                        </div>

                        {/* Options dossier */}
                        <div className="relative">
                          <button
                            type="button"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFolderMenuId(
                                activeFolderMenuId === folder.id ? null : folder.id
                              );
                            }}
                          >
                            <Icon name="more_vert" className="text-[18px]" />
                          </button>

                          {activeFolderMenuId === folder.id && (
                            <div
                              className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container p-1 z-30 text-xs flex flex-col"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActiveFolderMenuId(null);
                                  setCurrentFolderId(folder.id);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-container-low text-on-surface flex items-center gap-2"
                              >
                                <Icon name="folder_open" className="text-sm text-secondary" />
                                <span>Ouvrir</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveFolderMenuId(null);
                                  handleDeleteFolder(folder);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-error-container/40 text-error flex items-center gap-2"
                              >
                                <Icon name="delete" className="text-sm" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-headline text-sm font-bold text-primary-container truncate group-hover:text-brand-orange transition-colors">
                          {folder.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-2 font-mono text-xs text-secondary">
                          <span>{folder.files_count} fichiers</span>
                          <span>•</span>
                          <span className="font-semibold text-on-surface">{folder.total_size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section Fichiers */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-headline text-base font-bold text-primary-container">
                  {currentFolder
                    ? `Fichiers dans « ${currentFolder.name} »`
                    : currentTab === 'private'
                    ? 'Mes documents personnels'
                    : 'Documents partagés avec vous'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-bold">
                  {displayedFiles.length}
                </span>
              </div>

              {currentFolder && (
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className="text-xs font-semibold text-brand-orange hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="arrow_back" className="text-sm" />
                  Retour à la racine
                </button>
              )}
            </div>

            {displayedFiles.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-dashed border-surface-container bg-surface-container-lowest flex flex-col items-center justify-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
                  <Icon
                    name={currentTab === 'private' ? 'lock' : 'folder_off'}
                    className="text-2xl"
                  />
                </div>
                <p className="text-xs font-semibold text-on-surface">
                  {searchQuery
                    ? 'Aucun fichier ne correspond à votre recherche.'
                    : currentFolder
                    ? `Ce dossier est actuellement vide.`
                    : currentTab === 'private'
                    ? 'Votre espace privé est actuellement vide.'
                    : 'Aucun collègue ne vous a encore partagé de fichier.'}
                </p>
                {currentTab === 'private' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="cloud_upload"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    Téléverser un document privé ici
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {displayedFiles.map((file) => {
                  const isOwner = file.uploaded_by === user?.id;
                  const sharedCount = (file.shared_with || []).length;

                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs hover:shadow-sm hover:border-surface-container-high transition-all group"
                    >
                      <div
                        onClick={() => setPreviewingFile(file)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0 group-hover:scale-105 transition-transform">
                          <Icon name={getFileIcon(file.file_type)} className="text-[22px]" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-on-surface truncate group-hover:text-brand-orange transition-colors">
                              {file.name}
                            </span>

                            {/* Badges de visibilité et partage */}
                            {isOwner ? (
                              sharedCount === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold">
                                  <Icon name="lock" className="text-[12px]" />
                                  Privé
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSharingFile(file);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange text-[10px] font-bold hover:bg-brand-orange/20 cursor-pointer transition-colors"
                                  title="Gérer les partages de ce fichier"
                                >
                                  <Icon name="group" className="text-[12px]" />
                                  Partagé ({sharedCount})
                                </button>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/10 text-primary-container text-[10px] font-bold">
                                <Icon name="mark_email_read" className="text-[12px] text-brand-orange" />
                                Partagé par {file.uploader?.full_name || 'un collègue'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-secondary flex-wrap mt-0.5">
                            <span className="font-mono">{file.size_formatted}</span>
                            <span>•</span>
                            <span className="truncate">
                              {isOwner ? 'Vous' : file.uploader?.full_name || 'Collaborateur'}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(file.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        {/* Bouton de partage disponible uniquement pour le propriétaire */}
                        {isOwner && (
                          <button
                            onClick={() => setSharingFile(file)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-surface-container transition-colors cursor-pointer"
                            title="Partager ce fichier avec des collègues"
                          >
                            <Icon name="share" className="text-[18px]" />
                          </button>
                        )}

                        <button
                          onClick={() => setPreviewingFile(file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-surface-container transition-colors cursor-pointer"
                          title="Examiner le fichier"
                        >
                          <Icon name="visibility" className="text-[18px]" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-surface-container transition-colors cursor-pointer"
                          title="Télécharger le document"
                        >
                          <Icon name="download" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modale Téléversement */}
      <UploadFileModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        folders={folders}
        currentFolderId={currentFolderId}
        onSuccess={(fileName) => {
          showToast(`Fichier « ${fileName} » enregistré dans votre espace privé !`, 'success');
          loadData();
        }}
        currentUserId={user?.id || 'user-admin'}
      />

      {/* Modale Création Dossier */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onSuccess={(folderName) => {
          showToast(`Dossier personnel « ${folderName} » créé avec succès !`, 'success');
          loadData();
        }}
        currentUserId={user?.id || 'user-admin'}
        currentFolderId={currentFolderId}
      />

      {/* Modale Aperçu Fichier */}
      <FilePreviewModal
        isOpen={Boolean(previewingFile)}
        onClose={() => setPreviewingFile(null)}
        file={previewingFile}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onDelete={handleDeleteFile}
        onDownload={handleDownload}
        onOpenShare={(f) => setSharingFile(f)}
      />

      {/* Modale Partage Explicite de Fichier */}
      <ShareFileModal
        isOpen={Boolean(sharingFile)}
        onClose={() => setSharingFile(null)}
        file={sharingFile}
        currentUserId={user?.id || ''}
        onSuccess={(updatedFile) => {
          const count = (updatedFile.shared_with || []).length;
          showToast(
            count > 0
              ? `Fichier partagé avec succès avec ${count} collaborateur(s) !`
              : 'Fichier rendu strictement privé.',
            'success'
          );
          loadData();
        }}
      />
    </div>
  );
};
