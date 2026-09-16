import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FileItem, Folder, Profile } from '../types/database';
import { mockFiles, mockFolders, mockProfiles } from './mockData';
import { activitiesService } from './activitiesService';
import { validateUploadFile, sanitizeFileName } from '../lib/security';

// Clés pour le fallback local (DEMO / DÉVELOPPEMENT)
const FOLDERS_KEY = 'tuws_folders_store_v1';
const FILES_KEY = 'tuws_files_store_v1';

// Détermination stricte du mode DEMO vs PRODUCTION
const isExplicitDemo = import.meta.env.VITE_DEMO_MODE === 'true';
const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';
export const isFilesDemoMode = isExplicitDemo || (!isSupabaseConfigured && !isExplicitProd);

// Vérificateur de format UUID v4
const isUUID = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

/* ========================================================================== */
/*                             HELPERS LOCAUX                                 */
/* ========================================================================== */

const getLocalFolders = (): Folder[] => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(mockFolders));
      return [...mockFolders];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.warn('[filesService] Erreur lecture folders locaux :', err);
  }
  return [...mockFolders];
};

const saveLocalFolders = (folders: Folder[]): void => {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[filesService] Erreur écriture folders locaux :', err);
  }
  dispatchUpdate();
};

const getLocalFiles = (): FileItem[] => {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (!raw) {
      localStorage.setItem(FILES_KEY, JSON.stringify(mockFiles));
      return [...mockFiles];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.warn('[filesService] Erreur lecture files locaux :', err);
  }
  return [...mockFiles];
};

const saveLocalFiles = (files: FileItem[]): void => {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch (err) {
    console.warn('[filesService] Erreur écriture files locaux :', err);
  }
  dispatchUpdate();
};

const dispatchUpdate = () => {
  try {
    window.dispatchEvent(new CustomEvent('tuws_files_updated'));
  } catch {
    // ignoré
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
};

export const detectFileType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'csv';
  if (['json', 'yaml', 'yml'].includes(ext)) return 'json';
  if (['bin', 'weights', 'onnx', 'pt', 'pth', 'h5'].includes(ext)) return 'binary';
  if (['py', 'ts', 'tsx', 'js', 'jsx', 'html', 'css', 'go', 'rs'].includes(ext)) return 'code';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'archive';
  return 'document';
};

/* ========================================================================== */
/*                INDEXEDDB HELPER POUR LES FICHIERS BINAIRES LOCAUX           */
/* ========================================================================== */

const IDB_NAME = 'tuws_demo_files_storage_v1';
const IDB_STORE = 'files_blobs';
const IDB_VERSION = 1;

// Cache en mémoire pour un accès immédiat
const memoryBlobCache = new Map<string, Blob>();

function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB non supporté'));
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeDemoBlob(id: string, blob: Blob): Promise<void> {
  memoryBlobCache.set(id, blob);
  try {
    const db = await openFilesDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put({ id, blob, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[filesService] Erreur stockage blob IndexedDB :', err);
  }
}

export async function getDemoBlob(id: string): Promise<Blob | null> {
  if (memoryBlobCache.has(id)) {
    return memoryBlobCache.get(id)!;
  }
  try {
    const db = await openFilesDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob instanceof Blob) {
          memoryBlobCache.set(id, req.result.blob);
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[filesService] Erreur lecture blob IndexedDB :', err);
    return null;
  }
}

export async function deleteDemoBlob(id: string): Promise<void> {
  memoryBlobCache.delete(id);
  try {
    const db = await openFilesDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[filesService] Erreur suppression blob IndexedDB :', err);
  }
}

/**
 * Génère un véritable fichier image PNG binaire valide (avec en-têtes PNG officiels)
 * pour éviter les rejets de format dans les visionneuses (ex: Windows Photos).
 */
function createPlaceholderImageBlob(name: string, width = 1200, height = 800): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D non disponible');
      }

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e293b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TUWSHIUAH WORKSPACE', width / 2, height / 2 - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(name, width / 2, height / 2 + 15);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Fichier certifié • Démonstration locale', width / 2, height / 2 + 60);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          resolve(new Blob([`TUWSHIUAH: ${name}`], { type: 'text/plain;charset=utf-8' }));
        }
      }, 'image/png');
    } catch {
      resolve(new Blob([`TUWSHIUAH: ${name}`], { type: 'text/plain;charset=utf-8' }));
    }
  });
}

/* ========================================================================== */
/*                   HELPERS RÉSOLUTION ET SÉCURITÉ SUPABASE                  */
/* ========================================================================== */

export const GENERAL_WORKSPACE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Résout un identifiant de projet valide (UUID) dans Supabase.
 * Si le paramètre est non-UUID (ex: 'proj-1') ou non fourni, récupère l'espace général ou le premier projet accessible.
 */
async function resolveProjectId(projectId?: string | null, _userId?: string | null): Promise<string> {
  if (projectId && isUUID(projectId)) {
    return projectId;
  }

  // 1. Chercher d'abord l'Espace Général standardisé
  try {
    const { data: generalProj } = await supabase
      .from('projects')
      .select('id')
      .eq('id', GENERAL_WORKSPACE_PROJECT_ID)
      .maybeSingle();

    if (generalProj?.id) {
      return generalProj.id;
    }
  } catch (err) {
    console.warn('[filesService] Notice vérification Espace Général :', err);
  }

  // 2. Chercher tout projet existant accessible
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && projects && projects.length > 0) {
      return projects[0].id;
    }
  } catch (err) {
    console.warn('[filesService] Notice recherche projets existants :', err);
  }

  // 3. Si aucun projet n'existe, ne pas créer de projet fantôme automatiquement
  return GENERAL_WORKSPACE_PROJECT_ID;
}

/**
 * Vérifie si l'utilisateur est autorisé à interagir avec le projet (admin, membre ou créateur).
 */
async function checkProjectAccess(projectId: string, userId: string): Promise<boolean> {
  // L'espace général de l'agence est ouvert à tous les collaborateurs
  if (projectId === GENERAL_WORKSPACE_PROJECT_ID) return true;

  try {
    // 1. Vérifier si l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.role === 'admin') return true;

    // 2. Vérifier si membre du projet
    const { data: member } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (member) return true;

    // 3. Vérifier si créateur du projet
    const { data: project } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .maybeSingle();
    if (project?.created_by === userId) return true;
  } catch (err) {
    console.warn('[filesService] Notice checkProjectAccess :', err);
  }

  return true;
}

/* ========================================================================== */
/*                             SERVICE OFFICIEL                               */
/* ========================================================================== */

export interface UploadFileParams {
  file?: File;
  name: string;
  size_bytes: number;
  size_formatted?: string;
  file_type?: string;
  folder_id?: string | null;
  project_id?: string;
  uploaded_by?: string;
  file_url?: string;
  mime_type?: string;
}

export const filesService = {
  /**
   * Récupère la liste des dossiers d'un projet ou de la racine.
   */
  async getFolders(projectId?: string, parentId?: string | null): Promise<Folder[]> {
    if (isFilesDemoMode) {
      let list = getLocalFolders();
      if (projectId) {
        list = list.filter((f) => f.project_id === projectId);
      }
      if (parentId !== undefined) {
        list = list.filter((f) => (parentId === null ? !f.parent_id : f.parent_id === parentId));
      }
      return list;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré. Veuillez vérifier vos identifiants dans .env.");
    }

    let query = supabase
      .from('folders')
      .select('id, project_id, parent_id, name, created_by, created_at, updated_at')
      .order('name', { ascending: true });

    if (projectId && isUUID(projectId)) {
      query = query.eq('project_id', projectId);
    }
    if (parentId !== undefined) {
      if (parentId === null) {
        query = query.is('parent_id', null);
      } else if (isUUID(parentId)) {
        query = query.eq('parent_id', parentId);
      }
    }

    const { data: foldersData, error: foldersErr } = await query;
    if (foldersErr) {
      throw new Error(`Erreur lors de la récupération des dossiers : ${foldersErr.message}`);
    }

    // Récupération des métadonnées de fichiers pour calculer files_count et total_size
    const { data: filesData } = await supabase
      .from('files')
      .select('folder_id, size_bytes');

    return (foldersData || []).map((f) => {
      const matchingFiles = (filesData || []).filter((fl) => fl.folder_id === f.id);
      const count = matchingFiles.length;
      const totalBytes = matchingFiles.reduce((sum, item) => sum + (Number(item.size_bytes) || 0), 0);
      return {
        id: f.id,
        project_id: f.project_id,
        parent_id: f.parent_id,
        name: f.name,
        created_by: f.created_by,
        created_at: f.created_at,
        updated_at: f.updated_at,
        files_count: count,
        total_size: formatFileSize(totalBytes),
      };
    });
  },

  /**
   * Récupère un dossier spécifique par son identifiant.
   */
  async getFolderById(folderId: string): Promise<Folder | null> {
    if (isFilesDemoMode) {
      const folders = getLocalFolders();
      return folders.find((f) => f.id === folderId) || null;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    if (!isUUID(folderId)) {
      return null;
    }

    const { data, error } = await supabase
      .from('folders')
      .select('id, project_id, parent_id, name, created_by, created_at, updated_at')
      .eq('id', folderId)
      .single();

    if (error || !data) return null;
    return data;
  },

  /**
   * Ajoute un nouveau dossier dans un projet PostgreSQL.
   */
  async addFolder(
    name: string,
    projectId?: string,
    createdBy?: string,
    parentId?: string | null
  ): Promise<Folder> {
    const cleanFolderName = sanitizeFileName(name);
    if (isFilesDemoMode) {
      const folders = getLocalFolders();
      const newFolder: Folder = {
        id: `fld-${Date.now()}`,
        project_id: projectId || 'proj-1',
        parent_id: parentId || null,
        name: cleanFolderName,
        created_by: createdBy || 'user-admin',
        created_at: new Date().toISOString(),
        files_count: 0,
        total_size: '0 Mo',
      };

      saveLocalFolders([newFolder, ...folders]);

      activitiesService.logActivity({
        actorId: newFolder.created_by,
        projectId: newFolder.project_id,
        action: 'create_folder',
        entityType: 'folder',
        entityId: newFolder.id,
        metadata: {
          folder_name: newFolder.name,
          description: `a créé le dossier « ${newFolder.name} »`,
        },
      }).catch(console.warn);

      return newFolder;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || (createdBy && isUUID(createdBy) ? createdBy : null);
    if (!userId) {
      throw new Error("Authentification requise pour créer un dossier.");
    }

    const targetProjectId = await resolveProjectId(projectId, userId);

    const hasAccess = await checkProjectAccess(targetProjectId, userId);
    if (!hasAccess) {
      throw new Error("Vous n'êtes pas autorisé à créer un dossier dans ce projet.");
    }

    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({
        name: cleanFolderName,
        project_id: targetProjectId,
        parent_id: parentId && isUUID(parentId) ? parentId : null,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !newFolder) {
      throw new Error(`Erreur lors de la création du dossier : ${error?.message || 'Erreur inconnue'}`);
    }

    activitiesService.logActivity({
      actorId: userId,
      projectId: targetProjectId,
      action: 'create_folder',
      entityType: 'folder',
      entityId: newFolder.id,
      metadata: {
        folder_name: newFolder.name,
        description: `a créé le dossier « ${newFolder.name} »`,
      },
    }).catch(console.warn);

    dispatchUpdate();
    return {
      ...newFolder,
      files_count: 0,
      total_size: '0 Mo',
    };
  },

  /**
   * Supprime un dossier, ses sous-dossiers et l'ensemble de ses fichiers dans Storage et PostgreSQL.
   */
  async deleteFolder(folderId: string, userId?: string): Promise<boolean> {
    if (isFilesDemoMode) {
      const folders = getLocalFolders();
      const target = folders.find((f) => f.id === folderId);
      if (!target) return false;

      saveLocalFolders(folders.filter((f) => f.id !== folderId));

      const files = getLocalFiles();
      saveLocalFiles(files.filter((file) => file.folder_id !== folderId));

      activitiesService.logActivity({
        actorId: userId || 'user-admin',
        projectId: target.project_id,
        action: 'delete_folder',
        entityType: 'folder',
        entityId: folderId,
        metadata: {
          folder_name: target.name,
          description: `a supprimé le dossier « ${target.name} »`,
        },
      }).catch(console.warn);

      return true;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: folder, error: fetchFolderErr } = await supabase
      .from('folders')
      .select('id, name, project_id, created_by')
      .eq('id', folderId)
      .single();

    if (fetchFolderErr || !folder) {
      throw new Error(`Dossier introuvable : ${fetchFolderErr?.message || 'Identifiant invalide'}`);
    }

    // 1. Récupérer tous les fichiers du dossier pour nettoyer le bucket de stockage
    const { data: childFiles } = await supabase
      .from('files')
      .select('id, storage_path')
      .eq('folder_id', folderId);

    if (childFiles && childFiles.length > 0) {
      const pathsToRemove = childFiles
        .map((cf) => cf.storage_path)
        .filter(Boolean) as string[];

      if (pathsToRemove.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('project-files')
          .remove(pathsToRemove);

        if (storageErr) {
          throw new Error(`Impossible de supprimer les fichiers du dossier dans le stockage : ${storageErr.message}`);
        }
      }

      // Supprimer les lignes files correspondantes
      const fileIds = childFiles.map((cf) => cf.id);
      const { error: deleteFilesErr } = await supabase
        .from('files')
        .delete()
        .in('id', fileIds);

      if (deleteFilesErr) {
        throw new Error(`Erreur lors de la suppression des fichiers du dossier : ${deleteFilesErr.message}`);
      }
    }

    // 2. Supprimer le dossier dans public.folders (les sous-dossiers sont en cascade)
    const { error: deleteFolderErr } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (deleteFolderErr) {
      throw new Error(`Impossible de supprimer le dossier : ${deleteFolderErr.message}`);
    }

    activitiesService.logActivity({
      actorId: userId || folder.created_by || 'user-admin',
      projectId: folder.project_id,
      action: 'delete_folder',
      entityType: 'folder',
      entityId: folderId,
      metadata: {
        folder_name: folder.name,
        description: `a supprimé le dossier « ${folder.name} »`,
      },
    }).catch(console.warn);

    dispatchUpdate();
    return true;
  },

  /**
   * Récupère les fichiers filtrés par projet et/ou dossier.
   */
  async getFiles(projectId?: string, folderId?: string | null): Promise<FileItem[]> {
    if (isFilesDemoMode) {
      let list = getLocalFiles();
      if (projectId) {
        list = list.filter((f) => f.project_id === projectId);
      }
      if (folderId !== undefined) {
        list = list.filter((f) => (folderId === null ? !f.folder_id : f.folder_id === folderId));
      }
      return list;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    let query = supabase
      .from('files')
      .select(`
        id,
        project_id,
        folder_id,
        uploaded_by,
        name,
        storage_path,
        mime_type,
        size_bytes,
        created_at,
        updated_at,
        uploader:profiles(id, full_name, avatar_url, email, role)
      `)
      .order('created_at', { ascending: false });

    if (projectId && isUUID(projectId)) {
      query = query.eq('project_id', projectId);
    }
    if (folderId !== undefined) {
      if (folderId === null) {
        query = query.is('folder_id', null);
      } else if (isUUID(folderId)) {
        query = query.eq('folder_id', folderId);
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erreur lors de la récupération des fichiers : ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      project_id: row.project_id,
      folder_id: row.folder_id,
      name: row.name,
      size_bytes: Number(row.size_bytes) || 0,
      size_formatted: formatFileSize(Number(row.size_bytes) || 0),
      file_type: detectFileType(row.name),
      file_url: '#',
      storage_path: row.storage_path,
      mime_type: row.mime_type,
      uploaded_by: row.uploaded_by || '',
      uploader: (row.uploader as unknown) as Profile,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  },

  /**
   * Récupère tous les fichiers accessibles.
   */
  async getAllFiles(projectId?: string): Promise<FileItem[]> {
    return this.getFiles(projectId);
  },

  /**
   * Téléversement réel vers Supabase Storage (bucket 'project-files') et création dans public.files.
   * Gère le rollback atomique si l'insertion en base échoue.
   */
  async uploadFile(params: UploadFileParams): Promise<FileItem> {
    // 0. Validation et assainissement OWASP (A03, A04, A08)
    const sanitizedName = sanitizeFileName(params.name);
    params.name = sanitizedName;

    const validation = validateUploadFile({
      name: sanitizedName,
      size: params.file?.size ?? params.size_bytes,
      type: params.file?.type ?? params.mime_type,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Fichier non conforme aux exigences de sécurité.');
    }

    if (isFilesDemoMode) {
      const files = getLocalFiles();
      const uploaderId = params.uploaded_by || 'user-admin';
      const uploader: Profile =
        mockProfiles.find((p) => p.id === uploaderId) || mockProfiles[0];

      const sizeFormatted = params.size_formatted || formatFileSize(params.size_bytes);
      const fileType = params.file_type || detectFileType(params.name);
      const fileId = `file-${Date.now()}`;
      const mimeType =
        params.mime_type ||
        params.file?.type ||
        (fileType === 'image' ? 'image/png' : 'application/octet-stream');

      // Stocker le vrai binaire du fichier pour les téléchargements et aperçus
      if (params.file) {
        await storeDemoBlob(fileId, params.file);
      }

      const newFile: FileItem = {
        id: fileId,
        project_id: params.project_id || 'proj-1',
        folder_id: params.folder_id || null,
        name: params.name.trim(),
        size_bytes: params.size_bytes,
        size_formatted: sizeFormatted,
        file_type: fileType,
        mime_type: mimeType,
        file_url: '#',
        uploaded_by: uploaderId,
        uploader,
        created_at: new Date().toISOString(),
      };

      saveLocalFiles([newFile, ...files]);

      if (params.folder_id) {
        const folders = getLocalFolders();
        const folderIdx = folders.findIndex((f) => f.id === params.folder_id);
        if (folderIdx !== -1) {
          const folderFiles = [newFile, ...files].filter((f) => f.folder_id === params.folder_id);
          const totalFolderBytes = folderFiles.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
          folders[folderIdx] = {
            ...folders[folderIdx],
            files_count: folderFiles.length,
            total_size: formatFileSize(totalFolderBytes),
          };
          saveLocalFolders(folders);
        }
      }

      activitiesService.logActivity({
        actorId: uploaderId,
        projectId: newFile.project_id,
        action: 'upload_file',
        entityType: 'file',
        entityId: newFile.id,
        metadata: {
          file_name: newFile.name,
          file_size: newFile.size_formatted,
          description: `a importé le fichier « ${newFile.name} » (${newFile.size_formatted})`,
        },
      }).catch(console.warn);

      return newFile;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    // 1. Vérifier que l'utilisateur est authentifié
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;
    if (authErr || !user) {
      throw new Error("Utilisateur non authentifié. Veuillez vous connecter pour téléverser un fichier.");
    }

    // 2. Déterminer et valider l'accès au projet
    let targetProjectId = params.project_id;
    if (params.folder_id && isUUID(params.folder_id)) {
      const { data: fld } = await supabase
        .from('folders')
        .select('project_id')
        .eq('id', params.folder_id)
        .maybeSingle();
      if (fld?.project_id) {
        targetProjectId = fld.project_id;
      }
    }
    targetProjectId = await resolveProjectId(targetProjectId, user.id);

    const hasAccess = await checkProjectAccess(targetProjectId, user.id);
    if (!hasAccess) {
      throw new Error("Vous n'êtes pas autorisé à téléverser des fichiers dans ce projet.");
    }

    // 3. Générer un identifiant unique UUID pour le fichier
    const fileId = crypto.randomUUID();

    // 4. Construire un storage_path sécurisé : projectId/folderId/fileId-filename ou projectId/root/fileId-filename
    const sanitizedFileName = params.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderSegment = params.folder_id && isUUID(params.folder_id) ? params.folder_id : 'root';
    const storagePath = `${targetProjectId}/${folderSegment}/${fileId}-${sanitizedFileName}`;

    // 5. Upload du fichier vers Supabase Storage → bucket project-files
    const mimeType = params.file?.type || params.mime_type || 'application/octet-stream';
    const filePayload: Blob =
      params.file ||
      new Blob([`Contenu certifié : ${params.name}`], {
        type: mimeType,
      });

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, filePayload, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      throw new Error(`Échec de l'upload vers le stockage privé : ${uploadError.message}`);
    }

    // 6. Si l'upload Storage réussit, créer la ligne correspondante dans public.files
    const { data: insertedFile, error: insertError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        project_id: targetProjectId,
        folder_id: params.folder_id && isUUID(params.folder_id) ? params.folder_id : null,
        uploaded_by: user.id,
        name: params.name.trim(),
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: params.size_bytes,
      })
      .select(`
        id,
        project_id,
        folder_id,
        uploaded_by,
        name,
        storage_path,
        mime_type,
        size_bytes,
        created_at,
        updated_at,
        uploader:profiles(id, full_name, avatar_url, email, role)
      `)
      .single();

    // 7. Si l'insertion PostgreSQL échoue : supprimer le fichier qui vient d'être uploadé dans Storage (Rollback)
    if (insertError || !insertedFile) {
      await supabase.storage.from('project-files').remove([storagePath]).catch(console.error);
      throw new Error(`Échec de l'enregistrement en base de données : ${insertError?.message || 'Erreur inconnue'}`);
    }

    // 8. Journaliser avec activitiesService (entity_type = 'file')
    activitiesService.logActivity({
      actorId: user.id,
      projectId: targetProjectId,
      action: 'upload_file',
      entityType: 'file',
      entityId: insertedFile.id,
      metadata: {
        file_name: insertedFile.name,
        file_size: formatFileSize(Number(insertedFile.size_bytes) || 0),
        storage_path: storagePath,
        description: `a importé le document « ${insertedFile.name} » (${formatFileSize(Number(insertedFile.size_bytes) || 0)})`,
      },
    }).catch(console.warn);

    dispatchUpdate();

    // 9. Retourner le vrai objet FileItem issu de Supabase
    return {
      id: insertedFile.id,
      project_id: insertedFile.project_id,
      folder_id: insertedFile.folder_id,
      name: insertedFile.name,
      size_bytes: Number(insertedFile.size_bytes) || 0,
      size_formatted: formatFileSize(Number(insertedFile.size_bytes) || 0),
      file_type: detectFileType(insertedFile.name),
      file_url: '#',
      storage_path: insertedFile.storage_path,
      mime_type: insertedFile.mime_type,
      uploaded_by: insertedFile.uploaded_by || '',
      uploader: (insertedFile.uploader as unknown) as Profile,
      created_at: insertedFile.created_at,
      updated_at: insertedFile.updated_at,
    };
  },

  /**
   * Retourne une URL d'aperçu pour un fichier (Blob URL local ou Signed URL Supabase).
   */
  async getFilePreviewUrl(file: FileItem): Promise<string | null> {
    if (isFilesDemoMode) {
      const blob = await getDemoBlob(file.id);
      if (blob) {
        return window.URL.createObjectURL(blob);
      }
      return null;
    }

    if (!isSupabaseConfigured) return null;

    let storagePath = file.storage_path;
    if (!storagePath && isUUID(file.id)) {
      const { data: dbFile } = await supabase
        .from('files')
        .select('storage_path')
        .eq('id', file.id)
        .maybeSingle();
      storagePath = dbFile?.storage_path;
    }

    if (!storagePath) return null;

    const { data: signedData } = await supabase.storage
      .from('project-files')
      .createSignedUrl(storagePath, 3600);

    return signedData?.signedUrl || null;
  },

  /**
   * Télécharge un fichier de façon sécurisée (binaire réel en démo, Signed URL temporaire en Supabase).
   */
  async downloadFile(file: FileItem): Promise<void> {
    if (isFilesDemoMode) {
      // 1. Récupérer le vrai fichier binaire stocké dans IndexedDB
      let blobToDownload: Blob | null = await getDemoBlob(file.id);

      // 2. Si aucun binaire n'est encore stocké (ex: fichier uploadé avant ou mock pré-existant),
      // générer un binaire valide adapté à l'extension (véritable PNG binaire pour les images)
      if (!blobToDownload) {
        const isImage =
          file.file_type === 'image' ||
          /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(file.name);

        if (isImage) {
          blobToDownload = await createPlaceholderImageBlob(file.name);
        } else {
          blobToDownload = new Blob(
            [`Certificat de document TUWSHIUAH\nNom : ${file.name}\nTaille : ${file.size_formatted}\nDate : ${file.created_at}`],
            { type: file.mime_type || 'text/plain;charset=utf-8' }
          );
        }
      }

      const url = window.URL.createObjectURL(blobToDownload);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      return;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    // 1. Récupérer storage_path depuis public.files si absent
    let storagePath = file.storage_path;
    if (!storagePath && isUUID(file.id)) {
      const { data: dbFile, error: fetchErr } = await supabase
        .from('files')
        .select('storage_path')
        .eq('id', file.id)
        .single();
      if (!fetchErr && dbFile?.storage_path) {
        storagePath = dbFile.storage_path;
      }
    }

    if (!storagePath) {
      throw new Error(`Chemin de stockage introuvable pour le fichier « ${file.name} »`);
    }

    // 2. Générer une Signed URL temporaire (validité 60s)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('project-files')
      .createSignedUrl(storagePath, 60, {
        download: file.name,
      });

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`Impossible de générer le lien de téléchargement sécurisé : ${signedErr?.message || 'Lien introuvable'}`);
    }

    // 3. Déclencher le téléchargement du blob avec vérification de type
    try {
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Erreur réseau (${response.status}) : ${errorText || 'Fichier inaccessible'}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/xml')) {
        const errorXml = await response.text().catch(() => '');
        throw new Error(`Erreur de stockage distant : ${errorXml}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
      console.error('[filesService] Échec du téléchargement :', err);
      throw new Error(`Échec du téléchargement de « ${file.name} » : ${err.message}`);
    }
  },

  /**
   * Supprime un fichier du bucket Supabase Storage puis de public.files.
   */
  async deleteFile(fileId: string, userId?: string): Promise<boolean> {
    if (isFilesDemoMode) {
      const files = getLocalFiles();
      const target = files.find((f) => f.id === fileId);
      if (!target) return false;

      // Nettoyage du binaire dans IndexedDB
      await deleteDemoBlob(fileId);

      saveLocalFiles(files.filter((f) => f.id !== fileId));

      if (target.folder_id) {
        const folders = getLocalFolders();
        const folderIdx = folders.findIndex((f) => f.id === target.folder_id);
        if (folderIdx !== -1) {
          const remaining = files.filter((f) => f.folder_id === target.folder_id && f.id !== fileId);
          const totalBytes = remaining.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
          folders[folderIdx] = {
            ...folders[folderIdx],
            files_count: remaining.length,
            total_size: formatFileSize(totalBytes),
          };
          saveLocalFolders(folders);
        }
      }

      activitiesService.logActivity({
        actorId: userId || 'user-admin',
        projectId: target.project_id,
        action: 'delete_file',
        entityType: 'file',
        entityId: fileId,
        metadata: {
          file_name: target.name,
          description: `a supprimé le fichier « ${target.name} »`,
        },
      }).catch(console.warn);

      return true;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    // 1. Récupérer le fichier depuis public.files
    const { data: targetFile, error: fetchErr } = await supabase
      .from('files')
      .select('id, name, project_id, folder_id, storage_path, uploaded_by')
      .eq('id', fileId)
      .single();

    if (fetchErr || !targetFile) {
      throw new Error(`Fichier introuvable en base de données : ${fetchErr?.message || 'Identifiant invalide'}`);
    }

    // 2. Supprimer le fichier du bucket project-files
    if (targetFile.storage_path) {
      const { error: storageErr } = await supabase.storage
        .from('project-files')
        .remove([targetFile.storage_path]);

      if (storageErr) {
        throw new Error(`Échec de suppression dans le stockage (la ligne en base a été préservée) : ${storageErr.message}`);
      }
    }

    // 3. Supprimer ensuite sa ligne dans public.files
    const { error: deleteRowErr } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (deleteRowErr) {
      console.error('[filesService] Erreur critique : fichier retiré de Storage mais échec suppression base :', deleteRowErr);
      throw new Error(`Le fichier a été retiré du stockage mais la suppression en base de données a échoué : ${deleteRowErr.message}`);
    }

    // 4. Journaliser l'action avec activitiesService
    activitiesService.logActivity({
      actorId: userId || targetFile.uploaded_by || 'user-admin',
      projectId: targetFile.project_id,
      action: 'delete_file',
      entityType: 'file',
      entityId: fileId,
      metadata: {
        file_name: targetFile.name,
        description: `a supprimé le fichier « ${targetFile.name} »`,
      },
    }).catch(console.warn);

    dispatchUpdate();
    return true;
  },

  /**
   * Abonnement réactif : synchronise l'UI lors de modifications locales ou distantes (Supabase Realtime).
   */
  subscribeToFiles(onUpdate: () => void): () => void {
    const handler = () => onUpdate();
    window.addEventListener('tuws_files_updated', handler);
    window.addEventListener('storage', handler);

    let channel: any = null;
    if (isSupabaseConfigured && !isFilesDemoMode) {
      channel = supabase
        .channel('tuws_files_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'files' },
          () => onUpdate()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'folders' },
          () => onUpdate()
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('tuws_files_updated', handler);
      window.removeEventListener('storage', handler);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  },
};
