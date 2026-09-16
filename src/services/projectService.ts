import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  DbProjectStatus,
  Profile,
  Project,
  ProjectPriority,
  ProjectStatus,
  UserRole,
} from '../types/database';
import { mockProjects, mockProfiles } from './mockData';
import { activitiesService } from './activitiesService';
import { notificationsService } from './notificationsService';

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: DbProjectStatus;
  priority?: ProjectPriority;
  start_date?: string | null;
  due_date?: string | null;
  progress?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: DbProjectStatus;
  priority?: ProjectPriority;
  start_date?: string | null;
  due_date?: string | null;
  progress?: number;
}

/**
 * Normalise les statuts réels Supabase ('todo', 'in_progress', 'review', 'completed', 'delayed')
 * vers le format attendu par les composants frontend.
 */
export const normalizeProjectStatus = (rawStatus?: string | null): ProjectStatus => {
  const s = (rawStatus || '').toLowerCase();
  if (s === 'in_progress') return 'IN_PROGRESS';
  if (s === 'completed') return 'COMPLETED';
  if (s === 'delayed') return 'DELAYED';
  if (s === 'review') return 'REVIEW';
  return 'TODO';
};

/**
 * Convertit un statut frontend vers l'enum réel Supabase.
 */
export const toDbProjectStatus = (frontendStatus?: string | null): DbProjectStatus => {
  const s = (frontendStatus || '').toUpperCase();
  if (s === 'IN_PROGRESS') return 'in_progress';
  if (s === 'COMPLETED') return 'completed';
  if (s === 'DELAYED') return 'delayed';
  if (s === 'REVIEW') return 'review';
  return 'todo';
};

/**
 * Mapping visuel français pour l'affichage des statuts et priorités
 */
export const PROJECT_STATUS_LABELS: Record<DbProjectStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  review: 'En revue',
  completed: 'Terminé',
  delayed: 'En retard',
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: 'Faible',
  medium: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

/**
 * Crée un profil de repli visuel pour l'affichage des collaborateurs
 */
const formatMemberProfile = (p: { id: string; email?: string | null; full_name?: string | null; role?: string | null; avatar_url?: string | null }): Profile => ({
  id: p.id,
  user_id: p.id,
  full_name: p.full_name || 'Collaborateur',
  email: p.email || '',
  role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
  job_title: 'Collaborateur',
  avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
    p.full_name || p.id
  )}`,
  is_online: true,
});

/**
 * Clé de persistance locale pour le stockage hybride / hors-ligne
 */
const LOCAL_PROJECTS_KEY = 'tuws_projects_store_v1';

/**
 * Charge les projets depuis le stockage local (avec mockData en amorce)
 */
const getLocalProjects = (): Project[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) {
      const seeded = mockProjects.map((p) => ({
        ...p,
        name: p.name || p.title,
        title: p.name || p.title,
        status: normalizeProjectStatus(p.status),
        start_date: p.start_date || p.created_at || new Date().toISOString(),
        due_date: p.due_date || p.deadline || '',
        deadline: p.due_date || p.deadline || '',
        members: p.members || [],
      }));
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((p) => ({
        ...p,
        name: p.name || p.title,
        title: p.name || p.title,
        status: normalizeProjectStatus(p.status),
        start_date: p.start_date || p.created_at || new Date().toISOString(),
        due_date: p.due_date || p.deadline || '',
        deadline: p.due_date || p.deadline || '',
        members: p.members || [],
      }));
    }
  } catch (err) {
    console.warn('[projectService] Erreur lecture cache local :', err);
  }
  return [...mockProjects];
};

/**
 * Sauvegarde les projets en local et déclenche l'événement réactif
 */
const saveLocalProjects = (projects: Project[]): void => {
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('[projectService] Erreur écriture cache local :', err);
  }
  try {
    window.dispatchEvent(new CustomEvent('tuws_projects_updated'));
  } catch {
    // ignoré dans certains environnements SSR
  }
};

/**
 * Recherche un profil par identifiant (depuis mockProfiles ou généré)
 */
const resolveProfileById = (id: string): Profile => {
  const found = mockProfiles.find((p) => p.id === id || p.user_id === id);
  if (found) return found;
  return formatMemberProfile({ id, full_name: 'Collaborateur' });
};

export const projectService = {
  /**
   * Récupère la liste des projets accessibles selon le rôle.
   * - Admin : tous les projets
   * - Employé : uniquement les projets où il figure parmi les membres ou le créateur
   */
  async getProjects(userId?: string, isAdmin: boolean = true): Promise<Project[]> {
    // 1. Tenter la récupération depuis Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        let allowedProjectIds: string[] | null = null;

        // Pour les employés, filtrer sur les projets assignés
        if (!isAdmin) {
          if (!userId) return [];
          const { data: memberRows, error: memberErr } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', userId);

          if (!memberErr && memberRows) {
            allowedProjectIds = memberRows.map((m) => m.project_id);
          }
        }

        let query = supabase
          .from('projects')
          .select(`
            id,
            name,
            description,
            status,
            priority,
            start_date,
            due_date,
            progress,
            created_by,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false });

        if (allowedProjectIds !== null) {
          query = query.in('id', allowedProjectIds);
        }

        const { data: projectsData, error: projectsErr } = await query;

        if (!projectsErr && projectsData) {
          const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';
          if (projectsData.length === 0 && isExplicitProd) {
            return [];
          }

          if (projectsData.length > 0) {
            const projectIds = projectsData.map((p) => p.id);
          const membersByProject: Record<string, Profile[]> = {};

          try {
            const { data: membersData } = await supabase
              .from('project_members')
              .select(`
                project_id,
                user_id,
                profile:profiles(id, email, full_name, role, avatar_url)
              `)
              .in('project_id', projectIds);

            if (membersData) {
              for (const m of membersData) {
                const rawProfile = m.profile as any;
                if (!rawProfile) continue;
                if (!membersByProject[m.project_id]) {
                  membersByProject[m.project_id] = [];
                }
                membersByProject[m.project_id].push(formatMemberProfile(rawProfile));
              }
            }
          } catch (memErr) {
            console.warn('[projectService] Erreur récupération profils membres Supabase :', memErr);
          }

          return projectsData.map((row) => ({
            id: row.id,
            name: row.name || 'Projet sans titre',
            title: row.name || 'Projet sans titre',
            description: row.description || '',
            category: 'Workspace',
            status: normalizeProjectStatus(row.status),
            priority: (row.priority?.toLowerCase() as ProjectPriority) || 'medium',
            progress: Number(row.progress) || 0,
            start_date: row.start_date || '',
            due_date: row.due_date || '',
            deadline: row.due_date || row.created_at || '',
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
            members: membersByProject[row.id] || [],
          }));
        }
      }
    } catch (err) {
        console.warn('[projectService] Erreur Supabase getProjects, repli local :', err);
      }
    }

    // 2. Mode local / démonstration fiable
    const all = getLocalProjects();
    if (isAdmin) {
      return all;
    }

    if (!userId) return [];
    return all.filter((p) => {
      const isMember = (p.members || []).some((m) => m.id === userId || m.user_id === userId);
      const isCreator = p.created_by === userId;
      return isMember || isCreator;
    });
  },

  /**
   * Récupère les détails d'un projet par son ID.
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    if (!projectId) return null;

    // 1. Tenter Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        const { data: projectRow, error: projectErr } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            description,
            status,
            priority,
            start_date,
            due_date,
            progress,
            created_by,
            created_at,
            updated_at
          `)
          .eq('id', projectId)
          .maybeSingle();

        if (!projectErr && projectRow) {
          const members = await this.getProjectMembers(projectId);
          let filesCount = 0;
          let submissionsCount = 0;

          try {
            const { count: fCount } = await supabase
              .from('files')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', projectId);
            filesCount = fCount || 0;
          } catch {
            filesCount = 0;
          }

          try {
            const { count: sCount } = await supabase
              .from('submissions')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', projectId);
            submissionsCount = sCount || 0;
          } catch {
            submissionsCount = 0;
          }

          return {
            id: projectRow.id,
            name: projectRow.name || 'Projet sans titre',
            title: projectRow.name || 'Projet sans titre',
            description: projectRow.description || '',
            category: 'Workspace',
            status: normalizeProjectStatus(projectRow.status),
            priority: (projectRow.priority?.toLowerCase() as ProjectPriority) || 'medium',
            progress: Number(projectRow.progress) || 0,
            start_date: projectRow.start_date || '',
            due_date: projectRow.due_date || '',
            deadline: projectRow.due_date || projectRow.created_at || '',
            created_by: projectRow.created_by,
            created_at: projectRow.created_at,
            updated_at: projectRow.updated_at,
            members,
            files_count: filesCount,
            submissions_count: submissionsCount,
          };
        }
      } catch (err) {
        console.warn('[projectService] Erreur Supabase getProjectById, repli local :', err);
      }
    }

    // 2. Mode local
    const local = getLocalProjects();
    const found = local.find((p) => p.id === projectId);
    return found || null;
  },

  /**
   * Récupère la liste des profils des membres d'un projet.
   */
  async getProjectMembers(projectId: string): Promise<Profile[]> {
    if (!projectId) return [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select(`
            user_id,
            profile:profiles(id, email, full_name, role, avatar_url)
          `)
          .eq('project_id', projectId);

        if (!error && data && data.length > 0) {
          return data
            .map((row) => row.profile as any)
            .filter(Boolean)
            .map(formatMemberProfile);
        }
      } catch (err) {
        console.warn('[projectService] Exception getProjectMembers Supabase :', err);
      }
    }

    const localProject = getLocalProjects().find((p) => p.id === projectId);
    return localProject?.members || [];
  },

  /**
   * Récupère les employés disponibles pour assignation (role = 'employee').
   */
  async getAvailableEmployees(): Promise<Profile[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, avatar_url')
          .eq('role', 'employee')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map(formatMemberProfile);
        }
      } catch (err) {
        console.warn('[projectService] Exception getAvailableEmployees Supabase :', err);
      }
    }

    // Fallback immédiat vers les collaborateurs employés
    return mockProfiles.filter(
      (p) => p.role?.toLowerCase() === 'employee' || p.role?.toLowerCase() !== 'admin'
    );
  },

  /**
   * Crée un nouveau projet et lui associe ses collaborateurs.
   * Fonctionne en mode Supabase avec fallback automatique vers le stockage local persistant.
   */
  async createProject(
    data: CreateProjectInput,
    memberIds: string[],
    currentUserId: string
  ): Promise<{ data: Project | null; error: string | null }> {
    if (!data.name || data.name.trim() === '') {
      return { data: null, error: 'Le nom du projet est obligatoire.' };
    }

    const assignedProfiles = memberIds.map(resolveProfileById);
    let newProjectId = `proj-${Date.now()}`;

    // 1. Tenter la création dans Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        const insertPayload = {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          status: data.status || 'in_progress',
          priority: data.priority || 'medium',
          start_date: data.start_date || new Date().toISOString(),
          due_date: data.due_date || null,
          progress: typeof data.progress === 'number' ? Math.min(100, Math.max(0, data.progress)) : 0,
          created_by: currentUserId,
        };

        const { data: createdRow, error: insertErr } = await supabase
          .from('projects')
          .insert(insertPayload)
          .select()
          .single();

        if (!insertErr && createdRow) {
          newProjectId = createdRow.id;

          if (memberIds && memberIds.length > 0) {
            const membersPayload = memberIds.map((userId) => ({
              project_id: newProjectId,
              user_id: userId,
              added_by: currentUserId,
            }));

            await supabase.from('project_members').insert(membersPayload);
          }
        } else if (insertErr) {
          console.warn('[projectService] Erreur Supabase création projet, bascule en local :', insertErr.message);
        }
      } catch (err) {
        console.warn('[projectService] Exception Supabase createProject, bascule en local :', err);
      }
    }

    // 2. Création et persistance locale
    const newProject: Project = {
      id: newProjectId,
      name: data.name.trim(),
      title: data.name.trim(),
      description: data.description?.trim() || '',
      category: 'Workspace',
      status: normalizeProjectStatus(data.status),
      priority: (data.priority?.toLowerCase() as ProjectPriority) || 'medium',
      progress: typeof data.progress === 'number' ? Math.min(100, Math.max(0, data.progress)) : 0,
      start_date: data.start_date || new Date().toISOString(),
      due_date: data.due_date || '',
      deadline: data.due_date || new Date(Date.now() + 30 * 86400000).toISOString(),
      created_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      files_count: 0,
      submissions_count: 0,
      members: assignedProfiles,
    };

    const currentList = getLocalProjects();
    saveLocalProjects([newProject, ...currentList]);

    // 3. Notifications aux membres assignés (sauf l'auteur)
    memberIds.forEach((uid) => {
      if (uid && uid !== currentUserId) {
        notificationsService.addNotification({
          user_id: uid,
          sender_id: currentUserId,
          title: 'Affectation à un projet',
          message: `Vous avez été ajouté au projet « ${data.name.trim()} »`,
          type: 'PROJECT',
          link: `/projects/${newProjectId}`,
        }).catch((err) => console.warn('[projectService] Notification membre non envoyée :', err));
      }
    });

    // 4. Journal d'activité
    activitiesService.logActivity({
      actorId: currentUserId,
      projectId: newProjectId,
      action: 'create_project',
      entityType: 'project',
      entityId: newProjectId,
      metadata: {
        target_name: data.name.trim(),
        project_name: data.name.trim(),
        description: `a créé le projet « ${data.name.trim()} »`,
      },
    }).catch((logErr) => console.warn('[projectService] Échec logActivity :', logErr));

    return { data: newProject, error: null };
  },

  /**
   * Modifie un projet existant et synchronise éventuellement ses membres.
   */
  async updateProject(
    projectId: string,
    data: UpdateProjectInput,
    memberIds?: string[],
    currentUserId?: string
  ): Promise<{ data: Project | null; error: string | null }> {
    if (!projectId) {
      return { data: null, error: 'Identifiant du projet manquant.' };
    }

    // 1. Tenter la mise à jour Supabase si configuré
    if (isSupabaseConfigured) {
      try {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
        if (data.status !== undefined) updatePayload.status = data.status;
        if (data.priority !== undefined) updatePayload.priority = data.priority;
        if (data.start_date !== undefined) updatePayload.start_date = data.start_date;
        if (data.due_date !== undefined) updatePayload.due_date = data.due_date;
        if (data.progress !== undefined) updatePayload.progress = Math.min(100, Math.max(0, data.progress));

        await supabase.from('projects').update(updatePayload).eq('id', projectId);

        if (memberIds) {
          const { data: currentMembers } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId);

          const currentIds = new Set((currentMembers || []).map((m) => m.user_id));
          const newIds = new Set(memberIds);
          const toAdd = memberIds.filter((id) => !currentIds.has(id));
          const toRemove = Array.from(currentIds).filter((id) => !newIds.has(id));

          if (toAdd.length > 0) {
            await supabase.from('project_members').insert(
              toAdd.map((userId) => ({
                project_id: projectId,
                user_id: userId,
                added_by: currentUserId || 'system',
              }))
            );
          }

          if (toRemove.length > 0) {
            await supabase
              .from('project_members')
              .delete()
              .eq('project_id', projectId)
              .in('user_id', toRemove);
          }
        }
      } catch (err) {
        console.warn('[projectService] Exception Supabase updateProject :', err);
      }
    }

    // 2. Mise à jour dans le cache local
    const local = getLocalProjects();
    const idx = local.findIndex((p) => p.id === projectId);
    let updatedProject: Project;

    if (idx !== -1) {
      const existing = local[idx];
      const oldMemberIds = (existing.members || []).map((m) => m.id);
      const newMembers = memberIds ? memberIds.map(resolveProfileById) : existing.members;

      // Détecter les nouveaux membres pour les notifications
      if (memberIds && currentUserId) {
        const toAdd = memberIds.filter((id) => !oldMemberIds.includes(id));
        const projectName = data.name?.trim() || existing.name || 'Projet';
        toAdd.forEach((uid) => {
          if (uid && uid !== currentUserId) {
            notificationsService.addNotification({
              user_id: uid,
              sender_id: currentUserId,
              title: 'Affectation à un projet',
              message: `Vous avez été ajouté au projet « ${projectName} »`,
              type: 'PROJECT',
              link: `/projects/${projectId}`,
            }).catch(console.warn);
          }
        });
      }

      updatedProject = {
        ...existing,
        name: data.name !== undefined ? data.name.trim() : existing.name,
        title: data.name !== undefined ? data.name.trim() : existing.title,
        description: data.description !== undefined ? (data.description || '') : existing.description,
        status: data.status !== undefined ? normalizeProjectStatus(data.status) : existing.status,
        priority: data.priority !== undefined ? data.priority : existing.priority,
        start_date: data.start_date !== undefined ? (data.start_date || '') : existing.start_date,
        due_date: data.due_date !== undefined ? (data.due_date || '') : existing.due_date,
        deadline: data.due_date !== undefined ? (data.due_date || '') : existing.deadline,
        progress: data.progress !== undefined ? data.progress : existing.progress,
        members: newMembers,
        updated_at: new Date().toISOString(),
      };

      local[idx] = updatedProject;
      saveLocalProjects(local);
    } else {
      updatedProject = {
        id: projectId,
        name: data.name || 'Projet',
        title: data.name || 'Projet',
        description: data.description || '',
        category: 'Workspace',
        status: normalizeProjectStatus(data.status),
        priority: data.priority || 'medium',
        progress: data.progress || 0,
        start_date: data.start_date || '',
        due_date: data.due_date || '',
        deadline: data.due_date || '',
        created_by: currentUserId || 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members: memberIds ? memberIds.map(resolveProfileById) : [],
      };
      saveLocalProjects([updatedProject, ...local]);
    }

    // 3. Journal d'activité
    if (currentUserId) {
      activitiesService.logActivity({
        actorId: currentUserId,
        projectId,
        action: 'update_project',
        entityType: 'project',
        entityId: projectId,
        metadata: {
          project_name: updatedProject.name,
          description: `a mis à jour le projet « ${updatedProject.name} »`,
        },
      }).catch(console.warn);
    }

    return { data: updatedProject, error: null };
  },

  /**
   * Ajoute un membre au projet.
   */
  async addProjectMember(
    projectId: string,
    userId: string,
    addedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !userId) {
      return { success: false, error: 'Paramètres invalides.' };
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_members').insert({
          project_id: projectId,
          user_id: userId,
          added_by: addedBy,
        });
      } catch (err) {
        console.warn('[projectService] Erreur Supabase addProjectMember :', err);
      }
    }

    const local = getLocalProjects();
    const proj = local.find((p) => p.id === projectId);
    if (proj) {
      const alreadyIn = (proj.members || []).some((m) => m.id === userId);
      if (!alreadyIn) {
        proj.members = [...(proj.members || []), resolveProfileById(userId)];
        saveLocalProjects(local);
      }
    }

    if (userId !== addedBy) {
      notificationsService.addNotification({
        user_id: userId,
        sender_id: addedBy,
        title: 'Affectation à un projet',
        message: `Vous avez été ajouté au projet « ${proj?.name || 'Projet'} »`,
        type: 'PROJECT',
        link: `/projects/${projectId}`,
      }).catch(console.warn);
    }

    return { success: true };
  },

  /**
   * Retire un membre du projet.
   */
  async removeProjectMember(
    projectId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !userId) {
      return { success: false, error: 'Paramètres invalides.' };
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('[projectService] Erreur Supabase removeProjectMember :', err);
      }
    }

    const local = getLocalProjects();
    const proj = local.find((p) => p.id === projectId);
    if (proj) {
      proj.members = (proj.members || []).filter((m) => m.id !== userId);
      saveLocalProjects(local);
    }

    return { success: true };
  },

  /**
   * Supprime un projet après vérification des contraintes.
   * Réservé à l'administrateur.
   */
  async deleteProject(projectId: string, currentUserId?: string): Promise<{ success: boolean; error?: string }> {
    if (!projectId) {
      return { success: false, error: 'Identifiant de projet invalide.' };
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_members').delete().eq('project_id', projectId);
        const { error: deleteErr } = await supabase.from('projects').delete().eq('id', projectId);
        if (deleteErr && deleteErr.code === '23503') {
          return {
            success: false,
            error: 'Ce projet contient des éléments associés (fichiers ou livrables). Veuillez les détacher avant de supprimer le projet.',
          };
        }
      } catch (err) {
        console.warn('[projectService] Exception deleteProject Supabase :', err);
      }
    }

    const local = getLocalProjects();
    const toDelete = local.find((p) => p.id === projectId);
    saveLocalProjects(local.filter((p) => p.id !== projectId));

    if (currentUserId && toDelete) {
      activitiesService.logActivity({
        actorId: currentUserId,
        action: 'delete_project',
        entityType: 'project',
        entityId: projectId,
        metadata: {
          project_name: toDelete.name,
          description: `a supprimé le projet « ${toDelete.name} »`,
        },
      }).catch(console.warn);
    }

    return { success: true };
  },

  /**
   * S'abonne aux modifications en temps réel sur les projets
   */
  subscribeToProjects(onUpdate: () => void): () => void {
    const handleUpdate = () => onUpdate();

    window.addEventListener('tuws_projects_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('public:projects')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
            onUpdate();
          })
          .subscribe();
      } catch (err) {
        console.warn('[projectService] Impossible de souscrire au canal Realtime projects :', err);
      }
    }

    return () => {
      window.removeEventListener('tuws_projects_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  },
};
