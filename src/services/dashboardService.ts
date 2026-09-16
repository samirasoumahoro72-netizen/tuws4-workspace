import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Activity, Profile, Project, ProjectStatus, Submission, SubmissionFile, SubmissionStatus, UserRole } from '../types/database';
import { notificationsService } from './notificationsService';
import { projectService } from './projectService';
import { activitiesService } from './activitiesService';
import { mockSubmissions } from './mockData';

export interface DashboardStats {
  totalProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  delayedProjects: number;
  totalEmployees: number;
  pendingSubmissionsCount: number;
  unreadNotificationsCount: number;
}

export interface DashboardData {
  stats: DashboardStats;
  pendingSubmissions: Submission[];
  activeProjects: Project[];
  employees: Profile[];
  activities: Activity[];
}

/**
 * Formatage lisible de la taille d'un fichier en octets
 */
const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '0 Ko';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/**
 * Synthétise une description lisible à partir de action, entity_type et metadata
 */
const getActionDescription = (
  action?: string,
  entityType?: string,
  metadata?: Record<string, unknown> | null
): string => {
  if (metadata && typeof metadata === 'object' && 'description' in metadata && typeof metadata.description === 'string') {
    return metadata.description;
  }

  const target =
    (metadata && typeof metadata === 'object' && ('target_name' in metadata || 'title' in metadata || 'name' in metadata)
      ? String((metadata as any).target_name || (metadata as any).title || (metadata as any).name)
      : entityType) || '';

  const actLower = (action || '').toLowerCase();
  if (actLower.includes('submit')) {
    return `a soumis un travail${target ? ` pour "${target}"` : ''}`;
  }
  if (actLower.includes('approve') || actLower.includes('valid')) {
    return `a validé le livrable${target ? ` "${target}"` : ''}`;
  }
  if (actLower.includes('upload') || actLower.includes('file')) {
    return `a importé un document${target ? ` "${target}"` : ''}`;
  }
  if (actLower.includes('create') || actLower.includes('project')) {
    return `a créé le projet${target ? ` "${target}"` : ''}`;
  }
  if (actLower.includes('assign')) {
    return `a été assigné au projet${target ? ` "${target}"` : ''}`;
  }

  return action ? `${action}${target ? ` (${target})` : ''}` : 'a effectué une action';
};

export const dashboardService = {
  /**
   * Récupère toutes les données nécessaires au Dashboard depuis le schéma réel de Supabase :
   * - public.projects (id, name, description, status, due_date, progress, created_by, created_at)
   * - public.profiles (id, email, full_name, role)
   * - public.submissions (id, project_id, submitted_by, title, description, status = 'submitted', submitted_at, review_comment)
   * - public.submission_files -> public.files
   * - public.notifications (recipient_id, read_at IS NULL)
   * - public.activities (actor_id, project_id, action, entity_type, metadata, created_at)
   */
  async getDashboardData(userId?: string, _isAdmin: boolean = true): Promise<DashboardData> {
    const defaultStats: DashboardStats = {
      totalProjects: 0,
      inProgressProjects: 0,
      completedProjects: 0,
      delayedProjects: 0,
      totalEmployees: 0,
      pendingSubmissionsCount: 0,
      unreadNotificationsCount: 0,
    };

    if (!isSupabaseConfigured) {
      try {
        const [allProjects, allEmployees, unreadNotifications, activities] = await Promise.all([
          projectService.getProjects(userId, _isAdmin),
          projectService.getAvailableEmployees(),
          notificationsService.getUnreadCount(userId),
          activitiesService.getActivities(userId, _isAdmin, 20),
        ]);

        const inProgressProjects = allProjects.filter((p) => p.status === 'IN_PROGRESS').length;
        const completedProjects = allProjects.filter((p) => p.status === 'COMPLETED').length;
        const delayedProjects = allProjects.filter((p) => p.status === 'DELAYED').length;

        const activeProjects = allProjects
          .filter((p) => p.status === 'IN_PROGRESS' || p.status === 'DELAYED' || p.status === 'TODO')
          .slice(0, 3);

        return {
          stats: {
            totalProjects: allProjects.length,
            inProgressProjects,
            completedProjects,
            delayedProjects,
            totalEmployees: allEmployees.length,
            pendingSubmissionsCount: mockSubmissions.filter((s) => s.status === 'PENDING').length,
            unreadNotificationsCount: unreadNotifications,
          },
          pendingSubmissions: mockSubmissions.filter((s) => s.status === 'PENDING'),
          activeProjects,
          employees: allEmployees,
          activities,
        };
      } catch (err) {
        console.warn('[dashboardService] Erreur fallback local :', err);
        return {
          stats: defaultStats,
          pendingSubmissions: [],
          activeProjects: [],
          employees: [],
          activities: [],
        };
      }
    }

    try {
      // 1. PROJECTS (public.projects avec colonnes réelles : name, due_date, status, progress, etc.)
      const projectsPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('id, name, description, status, priority, start_date, due_date, progress, created_by, created_at, updated_at')
            .order('created_at', { ascending: false });

          if (error) {
            console.warn('[dashboardService] Erreur SQL sur public.projects :', error.message);
            return [];
          }
          return data || [];
        } catch (err) {
          console.warn('[dashboardService] Exception sur public.projects :', err);
          return [];
        }
      })();

      // 2. PROFILES (public.profiles avec id, email, full_name, role filtré sur role = 'employee')
      const employeesPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .eq('role', 'employee')
            .order('full_name', { ascending: true });

          if (error) {
            console.warn('[dashboardService] Erreur SQL sur public.profiles :', error.message);
            return [];
          }
          return data || [];
        } catch (err) {
          console.warn('[dashboardService] Exception sur public.profiles :', err);
          return [];
        }
      })();

      // 3. SUBMISSIONS (public.submissions avec status = 'PENDING', created_at, feedback)
      const submissionsPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('submissions')
            .select(`
              id,
              project_id,
              submitted_by,
              title,
              description,
              status,
              created_at,
              reviewed_by,
              reviewed_at,
              feedback
            `)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(5);

          if (error) {
            console.warn('[dashboardService] Erreur SQL sur public.submissions :', error.message);
            return [];
          }
          return data || [];
        } catch (err) {
          console.warn('[dashboardService] Exception sur public.submissions :', err);
          return [];
        }
      })();

      // 4. NOTIFICATIONS (via notificationsService pour cohérence totale et temps réel)
      const unreadNotificationsCountPromise = (async (): Promise<number> => {
        if (!userId) return 0;
        try {
          return await notificationsService.getUnreadCount(userId);
        } catch (err) {
          console.warn('[dashboardService] Exception sur notificationsService :', err);
          return 0;
        }
      })();

      // 5. ACTIVITIES (public.activities avec actor_id, action, entity_type, metadata, created_at)
      const activitiesPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('activities')
            .select('id, actor_id, project_id, action, entity_type, entity_id, metadata, created_at')
            .order('created_at', { ascending: false })
            .limit(6);

          if (error) {
            console.warn('[dashboardService] Erreur SQL sur public.activities :', error.message);
            return [];
          }
          return data || [];
        } catch (err) {
          console.warn('[dashboardService] Exception sur public.activities :', err);
          return [];
        }
      })();

      // Exécution en parallèle
      const [rawProjects, rawEmployees, rawSubmissions, unreadNotificationsCount, rawActivities] =
        await Promise.all([
          projectsPromise,
          employeesPromise,
          submissionsPromise,
          unreadNotificationsCountPromise,
          activitiesPromise,
        ]);

      // Calcul des statistiques de projets basées sur les ENUMS réels
      // ('todo', 'in_progress', 'review', 'completed', 'delayed')
      const totalProjects = rawProjects.length;
      const inProgressProjects = rawProjects.filter(
        (p) => (p.status || '').toLowerCase() === 'in_progress'
      ).length;

      const completedProjects = rawProjects.filter(
        (p) => (p.status || '').toLowerCase() === 'completed'
      ).length;

      const delayedProjects = rawProjects.filter(
        (p) => (p.status || '').toLowerCase() === 'delayed'
      ).length;

      // Mapping des projets vers l'interface frontend (name -> title, due_date -> deadline)
      const mappedProjects: Project[] = rawProjects.map((row) => {
        const rawStatus = (row.status || '').toLowerCase();
        let normalizedStatus: ProjectStatus = 'TODO';
        if (rawStatus === 'in_progress') normalizedStatus = 'IN_PROGRESS';
        else if (rawStatus === 'completed') normalizedStatus = 'COMPLETED';
        else if (rawStatus === 'delayed') normalizedStatus = 'DELAYED';
        else if (rawStatus === 'review') normalizedStatus = 'REVIEW';

        return {
          id: row.id,
          title: row.name || 'Projet sans titre',
          description: row.description || '',
          category: 'Workspace',
          status: normalizedStatus,
          progress: Number(row.progress) || 0,
          deadline: row.due_date || row.created_at || '',
          created_by: row.created_by,
          created_at: row.created_at,
        };
      });

      // Mapping des collaborateurs (fallback visuel pour les données absentes de profiles)
      const employees: Profile[] = rawEmployees.map((p) => ({
        id: p.id,
        user_id: p.id,
        full_name: p.full_name || 'Collaborateur',
        email: p.email || '',
        role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
        job_title: 'Collaborateur',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          p.full_name || p.id
        )}`,
        is_online: true,
        created_at: '',
      }));

      // Récupération des fichiers liés aux soumissions via la relation submission_files -> files
      const submissionIds = rawSubmissions.map((s) => s.id);
      const filesBySubId: Record<string, SubmissionFile[]> = {};

      if (submissionIds.length > 0) {
        try {
          const { data: subFilesData, error: subFilesError } = await supabase
            .from('submission_files')
            .select(`
              submission_id,
              file_id,
              file:files(id, name, storage_path, mime_type, size_bytes)
            `)
            .in('submission_id', submissionIds);

          if (!subFilesError && subFilesData) {
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
                file_url: fileObj.storage_path || '',
                file_type: fileObj.mime_type || 'binary',
              });
            }
          }
        } catch (err) {
          console.warn('[dashboardService] Erreur lors de la liaison submission_files -> files :', err);
        }
      }

      // Profils des auteurs des soumissions
      const authorIds = Array.from(new Set(rawSubmissions.map((s) => s.submitted_by).filter(Boolean)));
      const authorsById: Record<string, Profile> = {};

      if (authorIds.length > 0) {
        try {
          const { data: authorsData } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', authorIds);

          if (authorsData) {
            for (const a of authorsData) {
              authorsById[a.id] = {
                id: a.id,
                full_name: a.full_name || 'Collaborateur',
                email: a.email || '',
                role: a.role as UserRole,
                job_title: 'Collaborateur',
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                  a.full_name || a.id
                )}`,
              };
            }
          }
        } catch (err) {
          console.warn('[dashboardService] Erreur récupération auteurs des soumissions :', err);
        }
      }

      // Mapping des soumissions (created_at, feedback)
      const pendingSubmissions: Submission[] = rawSubmissions.map((row) => ({
        id: row.id,
        project_id: row.project_id,
        submitted_by: row.submitted_by,
        title: row.title || 'Livrable soumis',
        description: row.description || '',
        status: 'PENDING' as SubmissionStatus,
        created_at: row.created_at || '',
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        feedback: row.feedback || null,
        author: authorsById[row.submitted_by] || {
          id: row.submitted_by,
          full_name: 'Collaborateur',
          email: '',
          role: 'employee',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
            row.submitted_by || 'sub'
          )}`,
        },
        files: filesBySubId[row.id] || [],
      }));

      // Profils des acteurs des activités (actor_id -> profiles)
      const actorIds = Array.from(new Set(rawActivities.map((a) => a.actor_id).filter(Boolean)));
      const actorsById: Record<string, Profile> = {};

      if (actorIds.length > 0) {
        try {
          const { data: actorsData } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', actorIds);

          if (actorsData) {
            for (const a of actorsData) {
              actorsById[a.id] = {
                id: a.id,
                full_name: a.full_name || 'Membre agence',
                email: a.email || '',
                role: a.role as UserRole,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                  a.full_name || a.id
                )}`,
              };
            }
          }
        } catch (err) {
          console.warn('[dashboardService] Erreur récupération auteurs activités :', err);
        }
      }

      // Mapping des activités (actor_id, action, metadata robuste)
      const activities: Activity[] = rawActivities.map((row) => {
        let metaObj: Record<string, unknown> | null = null;
        if (row.metadata && typeof row.metadata === 'object') {
          metaObj = row.metadata as Record<string, unknown>;
        } else if (typeof row.metadata === 'string') {
          try {
            metaObj = JSON.parse(row.metadata);
          } catch {
            metaObj = null;
          }
        }

        const description = getActionDescription(row.action, row.entity_type, metaObj);
        const targetName =
          (metaObj &&
            ('target_name' in metaObj || 'title' in metaObj || 'name' in metaObj) &&
            String((metaObj as any).target_name || (metaObj as any).title || (metaObj as any).name)) ||
          (row.entity_type ? `${row.entity_type}` : undefined);

        let actionType: Activity['action_type'] = 'SUBMIT_WORK';
        const actLower = (row.action || '').toLowerCase();
        if (actLower.includes('approve') || actLower.includes('valid')) actionType = 'APPROVE_WORK';
        else if (actLower.includes('upload') || actLower.includes('file')) actionType = 'UPLOAD_FILE';
        else if (actLower.includes('create') || actLower.includes('project')) actionType = 'CREATE_PROJECT';
        else if (actLower.includes('assign')) actionType = 'ASSIGN_MEMBER';
        else if (actLower.includes('message')) actionType = 'SEND_MESSAGE';

        return {
          id: row.id,
          project_id: row.project_id,
          user_id: row.actor_id,
          user: actorsById[row.actor_id],
          action_type: actionType,
          description,
          target_name: targetName,
          created_at: row.created_at,
        };
      });

      // Projets actifs filtrés pour affichage dashboard
      const activeProjects = mappedProjects
        .filter((p) => p.status === 'IN_PROGRESS' || p.status === 'DELAYED' || p.status === 'TODO')
        .slice(0, 3);

      return {
        stats: {
          totalProjects,
          inProgressProjects,
          completedProjects,
          delayedProjects,
          totalEmployees: employees.length,
          pendingSubmissionsCount: rawSubmissions.length,
          unreadNotificationsCount,
        },
        pendingSubmissions,
        activeProjects,
        employees,
        activities: activities.length > 0 ? activities : await activitiesService.getActivities(userId, _isAdmin, 10),
      };
    } catch (globalError) {
      console.warn('[dashboardService] Erreur globale lors de la récupération des données Supabase :', globalError);
      return {
        stats: defaultStats,
        pendingSubmissions: [],
        activeProjects: [],
        employees: [],
        activities: await activitiesService.getActivities(userId, _isAdmin, 10),
      };
    }
  },
};
