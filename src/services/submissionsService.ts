import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Profile,
  Submission,
  SubmissionComment,
  SubmissionFile,
  SubmissionStatus,
  UserRole,
} from '../types/database';
import { mockProfiles, mockSubmissions } from './mockData';
import { notificationsService } from './notificationsService';
import { activitiesService } from './activitiesService';

// Clés et détection stricte du mode DEMO vs PRODUCTION
const LOCAL_SUBMISSIONS_KEY = 'tuws_submissions_store_v1';
const isExplicitDemo = import.meta.env.VITE_DEMO_MODE === 'true';
const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';
export const isSubmissionsDemoMode = isExplicitDemo || (!isSupabaseConfigured && !isExplicitProd);

// Vérificateur de format UUID v4
const isUUID = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '0 Ko';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/* ========================================================================== */
/*                             HELPERS LOCAUX                                 */
/* ========================================================================== */

const getLocalSubmissions = (): Submission[] => {
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(mockSubmissions));
      return [...mockSubmissions];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[submissionsService] Erreur lecture cache local :', err);
  }
  return [...mockSubmissions];
};

const saveLocalSubmissions = (subs: Submission[]): void => {
  try {
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(subs));
  } catch (err) {
    console.warn('[submissionsService] Erreur écriture cache local :', err);
  }
  dispatchUpdate();
};

const dispatchUpdate = () => {
  try {
    window.dispatchEvent(new CustomEvent('tuws_submissions_updated'));
  } catch {
    // ignoré
  }
};

/* ========================================================================== */
/*                  HELPERS DE HYDRATATION SUPABASE                           */
/* ========================================================================== */

/**
 * Hydrate une liste de soumissions brutes issues de public.submissions avec :
 * - author & reviewer (depuis public.profiles)
 * - project_title (depuis public.projects)
 * - files (depuis public.submission_files -> public.files)
 * - comments (depuis public.submission_comments -> public.profiles)
 */
async function hydrateSubmissions(rawList: any[]): Promise<Submission[]> {
  if (!rawList || rawList.length === 0) return [];

  const submissionIds = rawList.map((s) => s.id);
  const projectIds = Array.from(new Set(rawList.map((s) => s.project_id).filter(Boolean)));
  const userIds = Array.from(
    new Set(
      rawList
        .flatMap((s) => [s.submitted_by, s.reviewed_by])
        .filter(Boolean) as string[]
    )
  );

  // 1. Récupération des projets pour afficher le titre
  const projectsMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);
    if (projectsData) {
      for (const p of projectsData) {
        projectsMap[p.id] = p.name;
      }
    }
  }

  // 2. Récupération des profils (auteurs et relecteurs)
  const profilesMap: Record<string, Profile> = {};
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url, job_title')
      .in('id', userIds);
    if (profilesData) {
      for (const pr of profilesData) {
        profilesMap[pr.id] = {
          id: pr.id,
          user_id: pr.id,
          full_name: pr.full_name || 'Collaborateur',
          email: pr.email || '',
          role: (pr.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
          job_title: pr.job_title || 'Collaborateur',
          avatar_url:
            pr.avatar_url ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
              pr.full_name || pr.id
            )}`,
          is_online: true,
        };
      }
    }
  }

  // 3. Récupération des fichiers attachés via submission_files -> files
  const filesBySubId: Record<string, SubmissionFile[]> = {};
  if (submissionIds.length > 0) {
    try {
      const { data: subFilesData, error: subFilesErr } = await supabase
        .from('submission_files')
        .select(`
          submission_id,
          file_id,
          file:files(id, name, storage_path, mime_type, size_bytes)
        `)
        .in('submission_id', submissionIds);

      if (!subFilesErr && subFilesData) {
        for (const item of subFilesData) {
          const fileObj = item.file as any;
          if (!fileObj) continue;
          if (!filesBySubId[item.submission_id]) {
            filesBySubId[item.submission_id] = [];
          }
          filesBySubId[item.submission_id].push({
            id: fileObj.id,
            submission_id: item.submission_id,
            file_name: fileObj.name || 'Fichier joint',
            file_size: formatBytes(fileObj.size_bytes),
            file_url: fileObj.storage_path || '#',
            file_type: fileObj.mime_type || 'binary',
          });
        }
      }
    } catch (err) {
      console.warn('[submissionsService] Erreur liaison submission_files :', err);
    }
  }

  // 4. Récupération des commentaires liés via submission_comments
  const commentsBySubId: Record<string, SubmissionComment[]> = {};
  if (submissionIds.length > 0) {
    try {
      const { data: commentsData, error: commentsErr } = await supabase
        .from('submission_comments')
        .select(`
          id,
          submission_id,
          user_id,
          comment,
          created_at,
          author:profiles(id, full_name, avatar_url, role)
        `)
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: true });

      if (!commentsErr && commentsData) {
        for (const c of commentsData) {
          if (!commentsBySubId[c.submission_id]) {
            commentsBySubId[c.submission_id] = [];
          }
          commentsBySubId[c.submission_id].push({
            id: c.id,
            submission_id: c.submission_id,
            user_id: c.user_id,
            author: c.author as any,
            comment: c.comment,
            created_at: c.created_at,
          });
        }
      }
    } catch (err) {
      console.warn('[submissionsService] Erreur lecture commentaires :', err);
    }
  }

  // 5. Assemblage final
  return rawList.map((row) => {
    let status: SubmissionStatus = 'PENDING';
    const rawStatus = (row.status || '').toUpperCase();
    if (rawStatus === 'APPROVED' || rawStatus === 'VALIDATED') {
      status = 'APPROVED';
    } else if (rawStatus === 'CHANGES_REQUESTED' || rawStatus === 'REVISION_REQUESTED') {
      status = 'CHANGES_REQUESTED';
    }

    const author = profilesMap[row.submitted_by] || {
      id: row.submitted_by,
      full_name: 'Collaborateur',
      email: '',
      role: 'employee' as UserRole,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        row.submitted_by || 'sub'
      )}`,
    };

    const reviewer = row.reviewed_by ? profilesMap[row.reviewed_by] || null : null;

    return {
      id: row.id,
      project_id: row.project_id,
      project_title: projectsMap[row.project_id] || 'Projet TUWSHIUAH',
      submitted_by: row.submitted_by,
      author,
      title: row.title || 'Livrable',
      description: row.description || '',
      status,
      reviewed_by: row.reviewed_by || null,
      reviewer,
      reviewed_at: row.reviewed_at || null,
      feedback: row.feedback || null,
      created_at: row.created_at || new Date().toISOString(),
      files: filesBySubId[row.id] || [],
      comments: commentsBySubId[row.id] || [],
    };
  });
}

/**
 * Vérifie l'accès au projet pour un utilisateur.
 */
async function checkProjectMembership(projectId: string, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profile?.role === 'admin') return true;

  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (member) return true;

  const { data: proj } = await supabase
    .from('projects')
    .select('created_by')
    .eq('id', projectId)
    .single();
  if (proj?.created_by === userId) return true;

  return false;
}

/* ========================================================================== */
/*                             SERVICE OFFICIEL                               */
/* ========================================================================== */

export interface CreateSubmissionInput {
  projectId: string;
  title: string;
  description: string;
  fileIds?: string[];
  submittedBy?: string;
  project_id?: string;
  submitted_by?: string;
  project_title?: string;
  files?: any[];
}

export const submissionsService = {
  /**
   * Récupère toutes les soumissions visibles selon les permissions de l'utilisateur.
   */
  async getSubmissions(): Promise<Submission[]> {
    if (isSubmissionsDemoMode) {
      return getLocalSubmissions();
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner vos clés dans le fichier .env.");
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('id, project_id, submitted_by, title, description, status, reviewed_by, reviewed_at, feedback, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des livrables : ${error.message}`);
    }

    return hydrateSubmissions(data || []);
  },

  /**
   * Alias de rétrocompatibilité pour getSubmissions()
   */
  async getAll(): Promise<Submission[]> {
    return this.getSubmissions();
  },

  /**
   * Récupère une soumission spécifique par son identifiant avec tous ses détails.
   */
  async getSubmissionById(id: string): Promise<Submission | null> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      return subs.find((s) => s.id === id) || null;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    if (!isUUID(id)) return null;

    const { data, error } = await supabase
      .from('submissions')
      .select('id, project_id, submitted_by, title, description, status, reviewed_by, reviewed_at, feedback, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const hydrated = await hydrateSubmissions([data]);
    return hydrated[0] || null;
  },

  /**
   * Alias de rétrocompatibilité pour getSubmissionById()
   */
  async getById(id: string): Promise<Submission | null> {
    return this.getSubmissionById(id);
  },

  /**
   * Récupère les soumissions soumises par un utilisateur donné.
   */
  async getMySubmissions(userId: string): Promise<Submission[]> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      return subs.filter((s) => s.submitted_by === userId);
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('id, project_id, submitted_by, title, description, status, reviewed_by, reviewed_at, feedback, created_at, updated_at')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération de vos livrables : ${error.message}`);
    }

    return hydrateSubmissions(data || []);
  },

  /**
   * Récupère toutes les soumissions rattachées à un projet spécifique.
   */
  async getProjectSubmissions(projectId: string): Promise<Submission[]> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      return subs.filter((s) => s.project_id === projectId);
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('id, project_id, submitted_by, title, description, status, reviewed_by, reviewed_at, feedback, created_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur récupération livrables du projet : ${error.message}`);
    }

    return hydrateSubmissions(data || []);
  },

  /**
   * Création réelle d'un livrable par un collaborateur dans PostgreSQL (submissions + submission_files).
   */
  async createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    const rawProjectId = input.projectId || input.project_id;
    const rawSubmittedBy = input.submittedBy || input.submitted_by;
    const title = (input.title || '').trim();
    const description = (input.description || '').trim();
    const fileIds = input.fileIds || (input.files ? input.files.map((f: any) => f.id) : []);

    if (!title) {
      throw new Error('Le titre du livrable est obligatoire.');
    }

    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      const author =
        mockProfiles.find((p) => p.id === rawSubmittedBy) ||
        mockProfiles[1];

      const newSub: Submission = {
        id: `sub-${Date.now()}`,
        project_id: rawProjectId || 'proj-1',
        project_title: input.project_title || 'Projet TUWSHIUAH',
        submitted_by: rawSubmittedBy || author.id,
        author,
        title,
        description,
        status: 'PENDING',
        reviewed_by: null,
        reviewer: null,
        reviewed_at: null,
        feedback: null,
        created_at: new Date().toISOString(),
        files: input.files || [],
        comments: [],
      };

      saveLocalSubmissions([newSub, ...subs]);

      activitiesService.logActivity({
        actorId: newSub.submitted_by,
        projectId: newSub.project_id,
        action: 'submission_created',
        entityType: 'submission',
        entityId: newSub.id,
        metadata: {
          target_name: newSub.title,
          description: `a créé et soumis le livrable « ${newSub.title} »`,
        },
      }).catch(console.warn);

      notificationsService.addNotification({
        user_id: 'user-admin',
        sender_id: newSub.submitted_by,
        title: 'Nouveau livrable à valider',
        message: `${author.full_name} a soumis « ${newSub.title} »`,
        type: 'SUBMISSION',
        link: '/submissions',
      }).catch(console.warn);

      return newSub;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    // 1. Vérifier la session Supabase
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;
    if (authErr || !user) {
      throw new Error("Utilisateur non authentifié. Veuillez vous connecter pour soumettre un livrable.");
    }

    // 2. Déterminer le project_id réel
    let targetProjectId = rawProjectId;
    if (!targetProjectId || !isUUID(targetProjectId)) {
      const { data: userProjects } = await supabase.from('projects').select('id').limit(1);
      if (userProjects && userProjects.length > 0) {
        targetProjectId = userProjects[0].id;
      } else {
        throw new Error("Aucun projet valide trouvé pour rattacher ce livrable.");
      }
    }

    if (!targetProjectId) {
      throw new Error("Projet de destination invalide.");
    }

    // 3. Vérifier que l'utilisateur est membre du projet ou admin
    const hasMembership = await checkProjectMembership(targetProjectId, user.id);
    if (!hasMembership) {
      throw new Error("Vous n'êtes pas autorisé à créer une soumission pour ce projet.");
    }

    // 4. Vérifier que les fichiers sélectionnés appartiennent bien au même projet
    if (fileIds && fileIds.length > 0) {
      const validUUIDs = fileIds.filter(isUUID);
      if (validUUIDs.length > 0) {
        const { data: filesCheck, error: filesErr } = await supabase
          .from('files')
          .select('id, project_id')
          .in('id', validUUIDs);

        if (filesErr) {
          throw new Error(`Erreur vérification des fichiers : ${filesErr.message}`);
        }

        const invalidFile = (filesCheck || []).find((f) => f.project_id !== targetProjectId);
        if (invalidFile) {
          throw new Error("Une soumission ne peut référencer que des fichiers appartenant au même projet.");
        }
      }
    }

    // 5. Créer la ligne dans public.submissions avec status = 'PENDING'
    const { data: createdSub, error: createErr } = await supabase
      .from('submissions')
      .insert({
        project_id: targetProjectId,
        submitted_by: user.id,
        title,
        description,
        status: 'PENDING',
      })
      .select()
      .single();

    if (createErr || !createdSub) {
      throw new Error(`Échec de la création de la soumission : ${createErr?.message || 'Erreur inconnue'}`);
    }

    // 6. Associer les fichiers dans submission_files
    if (fileIds && fileIds.length > 0) {
      const validUUIDs = fileIds.filter(isUUID);
      if (validUUIDs.length > 0) {
        const subFilesPayload = validUUIDs.map((fId) => ({
          submission_id: createdSub.id,
          file_id: fId,
        }));

        const { error: attachErr } = await supabase
          .from('submission_files')
          .insert(subFilesPayload);

        if (attachErr) {
          console.warn('[submissionsService] Erreur insertion submission_files :', attachErr);
        }
      }
    }

    // 7. Journaliser l'activité (action: 'submission_created')
    activitiesService.logActivity({
      actorId: user.id,
      projectId: targetProjectId,
      action: 'submission_created',
      entityType: 'submission',
      entityId: createdSub.id,
      metadata: {
        target_name: createdSub.title,
        description: `a créé et soumis le livrable « ${createdSub.title} »`,
      },
    }).catch(console.warn);

    // 8. Notifier les administrateurs
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      for (const admin of admins || []) {
        notificationsService.addNotification({
          user_id: admin.id,
          sender_id: user.id,
          title: 'Nouveau livrable à valider',
          message: `Un nouveau livrable « ${createdSub.title} » a été soumis pour validation.`,
          type: 'SUBMISSION',
          link: '/submissions',
        }).catch(console.warn);
      }
    } catch (notifErr) {
      console.warn('[submissionsService] Erreur notification admin :', notifErr);
    }

    dispatchUpdate();

    // 9. Retourner le livrable complet hydraté
    const hydratedList = await hydrateSubmissions([createdSub]);
    return hydratedList[0] || (createdSub as unknown as Submission);
  },

  /**
   * Alias de rétrocompatibilité pour create()
   */
  async create(submissionData: Partial<Submission>): Promise<Submission> {
    return this.createSubmission({
      projectId: submissionData.project_id || 'proj-1',
      title: submissionData.title || 'Nouveau Livrable',
      description: submissionData.description || '',
      submittedBy: submissionData.submitted_by,
      files: submissionData.files,
    });
  },

  /**
   * Associe des fichiers existants de public.files à une soumission.
   */
  async attachFiles(submissionId: string, fileIds: string[]): Promise<boolean> {
    if (isSubmissionsDemoMode) return true;
    if (!isUUID(submissionId) || !fileIds || fileIds.length === 0) return false;

    const validUUIDs = fileIds.filter(isUUID);
    if (validUUIDs.length === 0) return false;

    const payload = validUUIDs.map((fId) => ({
      submission_id: submissionId,
      file_id: fId,
    }));

    const { error } = await supabase.from('submission_files').insert(payload);
    if (error) {
      throw new Error(`Échec de l'association des fichiers : ${error.message}`);
    }

    dispatchUpdate();
    return true;
  },

  /**
   * Resoumission d'un livrable après modification demandée (CHANGES_REQUESTED -> PENDING).
   */
  async submitSubmission(
    submissionId: string,
    fileIds?: string[],
    newDescription?: string
  ): Promise<Submission> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      const idx = subs.findIndex((s) => s.id === submissionId);
      if (idx === -1) throw new Error('Livrable introuvable.');

      const updated: Submission = {
        ...subs[idx],
        status: 'PENDING',
        reviewed_by: null,
        reviewer: null,
        reviewed_at: null,
        description: newDescription || subs[idx].description,
      };

      subs[idx] = updated;
      saveLocalSubmissions(subs);
      return updated;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      throw new Error('Authentification requise pour resoumettre un livrable.');
    }

    // Récupérer la soumission existante
    const { data: existingSub, error: fetchErr } = await supabase
      .from('submissions')
      .select('id, project_id, submitted_by, title, status')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !existingSub) {
      throw new Error(`Livrable introuvable : ${fetchErr?.message || 'Identifiant invalide'}`);
    }

    // Remplacement éventuel des fichiers joints
    if (fileIds) {
      await supabase
        .from('submission_files')
        .delete()
        .eq('submission_id', submissionId);

      const validUUIDs = fileIds.filter(isUUID);
      if (validUUIDs.length > 0) {
        const payload = validUUIDs.map((fId) => ({
          submission_id: submissionId,
          file_id: fId,
        }));
        await supabase.from('submission_files').insert(payload);
      }
    }

    // Mise à jour : status = 'PENDING', reset des données de review
    const updatePayload: any = {
      status: 'PENDING',
      reviewed_by: null,
      reviewed_at: null,
    };
    if (newDescription !== undefined) {
      updatePayload.description = newDescription.trim();
    }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr || !updatedRow) {
      throw new Error(`Erreur lors de la resoumission : ${updateErr?.message || 'Erreur inconnue'}`);
    }

    // Journal d'activité (action: 'submission_resubmitted')
    activitiesService.logActivity({
      actorId: user.id,
      projectId: updatedRow.project_id,
      action: 'submission_resubmitted',
      entityType: 'submission',
      entityId: submissionId,
      metadata: {
        target_name: updatedRow.title,
        description: `a corrigé et resoumis le livrable « ${updatedRow.title} »`,
      },
    }).catch(console.warn);

    // Notifier les administrateurs
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      for (const admin of admins || []) {
        notificationsService.addNotification({
          user_id: admin.id,
          sender_id: user.id,
          title: 'Nouvelle soumission après correction',
          message: `Le livrable « ${updatedRow.title} » a été corrigé et soumis à nouveau pour examen.`,
          type: 'SUBMISSION',
          link: '/submissions',
        }).catch(console.warn);
      }
    } catch (notifErr) {
      console.warn('[submissionsService] Erreur notification admin :', notifErr);
    }

    dispatchUpdate();

    const hydrated = await hydrateSubmissions([updatedRow]);
    return hydrated[0];
  },

  /**
   * Approbation d'un livrable par l'administrateur (Passage en APPROVED).
   */
  async approveSubmission(
    submissionId: string,
    adminId?: string,
    feedback?: string
  ): Promise<Submission> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      const idx = subs.findIndex((s) => s.id === submissionId);
      if (idx === -1) throw new Error('Livrable introuvable.');

      const effectiveAdminId = adminId || 'user-admin';
      const reviewer = mockProfiles.find((p) => p.id === effectiveAdminId) || mockProfiles[0];
      const defaultFeedback = feedback?.trim() || 'Livrable validé avec succès par la Direction.';

      const updated: Submission = {
        ...subs[idx],
        status: 'APPROVED',
        reviewed_by: effectiveAdminId,
        reviewer,
        reviewed_at: new Date().toISOString(),
        feedback: defaultFeedback,
      };

      subs[idx] = updated;
      saveLocalSubmissions(subs);

      if (updated.submitted_by && updated.submitted_by !== effectiveAdminId) {
        notificationsService.addNotification({
          user_id: updated.submitted_by,
          sender_id: effectiveAdminId,
          title: 'Travail validé',
          message: `Votre travail « ${updated.title} » a été validé.`,
          type: 'VALIDATION',
          link: '/submissions',
        }).catch(console.warn);
      }

      activitiesService.logActivity({
        actorId: effectiveAdminId,
        projectId: updated.project_id,
        action: 'submission_approved',
        entityType: 'submission',
        entityId: updated.id,
        metadata: {
          target_name: updated.title,
          description: `a validé le livrable « ${updated.title} »`,
        },
      }).catch(console.warn);

      return updated;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id || adminId;
    if (!currentUserId) {
      throw new Error('Authentification requise pour valider un livrable.');
    }

    // Vérifier que l'utilisateur est bien administrateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error("Seul un administrateur est autorisé à approuver un livrable.");
    }

    const defaultFeedback = feedback?.trim() || 'Livrable validé par la Direction.';

    const { data: updatedRow, error: updateErr } = await supabase
      .from('submissions')
      .update({
        status: 'APPROVED',
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
        feedback: defaultFeedback,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr || !updatedRow) {
      throw new Error(`Erreur lors de la validation du livrable : ${updateErr?.message || 'Erreur inconnue'}`);
    }

    // 1. Journal d'activité (action: 'submission_approved')
    activitiesService.logActivity({
      actorId: currentUserId,
      projectId: updatedRow.project_id,
      action: 'submission_approved',
      entityType: 'submission',
      entityId: submissionId,
      metadata: {
        target_name: updatedRow.title,
        description: `a validé le travail « ${updatedRow.title} »`,
      },
    }).catch(console.warn);

    // 2. Notification ciblée pour l'employé
    if (updatedRow.submitted_by && updatedRow.submitted_by !== currentUserId) {
      notificationsService.addNotification({
        user_id: updatedRow.submitted_by,
        sender_id: currentUserId,
        title: 'Travail validé',
        message: `Votre travail « ${updatedRow.title} » a été validé.`,
        type: 'VALIDATION',
        link: '/submissions',
      }).catch(console.warn);
    }

    dispatchUpdate();

    const hydrated = await hydrateSubmissions([updatedRow]);
    return hydrated[0];
  },

  /**
   * Alias de rétrocompatibilité pour validateSubmission()
   */
  async validateSubmission(id: string, reviewerId: string, feedback?: string): Promise<Submission | null> {
    return this.approveSubmission(id, reviewerId, feedback);
  },

  /**
   * Demande de modifications avec feedback obligatoire (Passage en CHANGES_REQUESTED).
   */
  async requestChanges(
    submissionId: string,
    adminId: string,
    feedback: string
  ): Promise<Submission> {
    const cleanFeedback = (feedback || '').trim();
    if (!cleanFeedback) {
      throw new Error('Le motif des modifications demandées est obligatoire.');
    }

    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      const idx = subs.findIndex((s) => s.id === submissionId);
      if (idx === -1) throw new Error('Livrable introuvable.');

      const reviewer = mockProfiles.find((p) => p.id === adminId) || mockProfiles[0];

      const updated: Submission = {
        ...subs[idx],
        status: 'CHANGES_REQUESTED',
        reviewed_by: adminId,
        reviewer,
        reviewed_at: new Date().toISOString(),
        feedback: cleanFeedback,
      };

      subs[idx] = updated;
      saveLocalSubmissions(subs);

      if (updated.submitted_by && updated.submitted_by !== adminId) {
        notificationsService.addNotification({
          user_id: updated.submitted_by,
          sender_id: adminId,
          title: 'Modification demandée',
          message: `L'administrateur demande une modification sur « ${updated.title} ».`,
          type: 'SUBMISSION',
          link: '/submissions',
        }).catch(console.warn);
      }

      activitiesService.logActivity({
        actorId: adminId,
        projectId: updated.project_id,
        action: 'submission_changes_requested',
        entityType: 'submission',
        entityId: updated.id,
        metadata: {
          target_name: updated.title,
          description: `a demandé des modifications sur « ${updated.title} » : ${cleanFeedback}`,
        },
      }).catch(console.warn);

      return updated;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: authData } = await supabase.auth.getUser();
    const effectiveAdminId = authData.user?.id || adminId;

    // Vérifier rôle admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', effectiveAdminId)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error("Seul un administrateur est autorisé à demander des modifications.");
    }

    // 1. Mettre à jour public.submissions
    const { data: updatedRow, error: updateErr } = await supabase
      .from('submissions')
      .update({
        status: 'CHANGES_REQUESTED',
        reviewed_by: effectiveAdminId,
        reviewed_at: new Date().toISOString(),
        feedback: cleanFeedback,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr || !updatedRow) {
      throw new Error(`Erreur lors de la demande de modification : ${updateErr?.message || 'Erreur inconnue'}`);
    }

    // 2. Créer également une entrée dans public.submission_comments
    try {
      await supabase.from('submission_comments').insert({
        submission_id: submissionId,
        user_id: effectiveAdminId,
        comment: cleanFeedback,
      });
    } catch (comErr) {
      console.warn('[submissionsService] Erreur insertion commentaire feedback :', comErr);
    }

    // 3. Journal d'activité (action: 'submission_changes_requested')
    activitiesService.logActivity({
      actorId: effectiveAdminId,
      projectId: updatedRow.project_id,
      action: 'submission_changes_requested',
      entityType: 'submission',
      entityId: submissionId,
      metadata: {
        target_name: updatedRow.title,
        description: `a demandé des modifications sur « ${updatedRow.title} » : ${cleanFeedback}`,
      },
    }).catch(console.warn);

    // 4. Notification pour l'employé
    if (updatedRow.submitted_by && updatedRow.submitted_by !== effectiveAdminId) {
      notificationsService.addNotification({
        user_id: updatedRow.submitted_by,
        sender_id: effectiveAdminId,
        title: 'Modification demandée',
        message: `L'administrateur demande une modification sur « ${updatedRow.title} ».`,
        type: 'SUBMISSION',
        link: '/submissions',
      }).catch(console.warn);
    }

    dispatchUpdate();

    const hydrated = await hydrateSubmissions([updatedRow]);
    return hydrated[0];
  },

  /**
   * Ajoute un commentaire persistant sur une soumission (public.submission_comments).
   */
  async addSubmissionComment(
    submissionId: string,
    userId: string,
    comment: string
  ): Promise<SubmissionComment> {
    const cleanComment = (comment || '').trim();
    if (!cleanComment) {
      throw new Error('Le commentaire ne peut pas être vide.');
    }

    if (isSubmissionsDemoMode) {
      const author = mockProfiles.find((p) => p.id === userId) || mockProfiles[0];
      const newComment: SubmissionComment = {
        id: `com-${Date.now()}`,
        submission_id: submissionId,
        user_id: userId,
        author,
        comment: cleanComment,
        created_at: new Date().toISOString(),
      };

      const subs = getLocalSubmissions();
      const idx = subs.findIndex((s) => s.id === submissionId);
      if (idx !== -1) {
        subs[idx].comments = [...(subs[idx].comments || []), newComment];
        saveLocalSubmissions(subs);
      }

      return newComment;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { data: insertedComment, error } = await supabase
      .from('submission_comments')
      .insert({
        submission_id: submissionId,
        user_id: userId,
        comment: cleanComment,
      })
      .select(`
        id,
        submission_id,
        user_id,
        comment,
        created_at,
        author:profiles(id, full_name, avatar_url, role)
      `)
      .single();

    if (error || !insertedComment) {
      throw new Error(`Impossible d'enregistrer le commentaire : ${error?.message || 'Erreur inconnue'}`);
    }

    activitiesService.logActivity({
      actorId: userId,
      action: 'submission_comment_added',
      entityType: 'submission',
      entityId: submissionId,
      metadata: {
        description: `a ajouté un commentaire sur le livrable`,
      },
    }).catch(console.warn);

    dispatchUpdate();

    return {
      id: insertedComment.id,
      submission_id: insertedComment.submission_id,
      user_id: insertedComment.user_id,
      author: insertedComment.author as any,
      comment: insertedComment.comment,
      created_at: insertedComment.created_at,
    };
  },

  /**
   * Supprime une soumission (action réservée aux administrateurs ou à l'auteur).
   */
  async deleteSubmission(submissionId: string, userId?: string): Promise<boolean> {
    if (isSubmissionsDemoMode) {
      const subs = getLocalSubmissions();
      const target = subs.find((s) => s.id === submissionId);
      if (!target) return false;

      saveLocalSubmissions(subs.filter((s) => s.id !== submissionId));

      activitiesService.logActivity({
        actorId: userId || 'user-admin',
        projectId: target.project_id,
        action: 'delete_submission',
        entityType: 'submission',
        entityId: submissionId,
        metadata: {
          description: `a supprimé le livrable « ${target.title} »`,
        },
      }).catch(console.warn);

      return true;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submissionId);

    if (error) {
      throw new Error(`Échec de la suppression du livrable : ${error.message}`);
    }

    dispatchUpdate();
    return true;
  },

  /**
   * Abonnement réactif : synchronise l'UI lors de mises à jour de soumissions ou de commentaires.
   */
  subscribeToSubmissions(onUpdate: () => void): () => void {
    const handler = () => onUpdate();
    window.addEventListener('tuws_submissions_updated', handler);
    window.addEventListener('storage', handler);

    let channel: any = null;
    if (isSupabaseConfigured && !isSubmissionsDemoMode) {
      channel = supabase
        .channel('tuws_submissions_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submissions' },
          () => onUpdate()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submission_comments' },
          () => onUpdate()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submission_files' },
          () => onUpdate()
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('tuws_submissions_updated', handler);
      window.removeEventListener('storage', handler);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  },
};
