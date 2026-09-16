import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Activity, Profile, UserRole } from '../types/database';

export interface LogActivityParams {
  actorId: string;
  projectId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Synthétise une description éditoriale claire à partir de l'action, de l'entité et des métadonnées
 */
const formatActivityDescription = (
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
    return `a soumis le livrable${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('approve') || actLower.includes('valid')) {
    return `a validé le livrable${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('reject') || actLower.includes('change')) {
    return `a demandé des modifications sur${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('upload') || actLower.includes('file')) {
    return `a importé le document${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('create') && (actLower.includes('project') || entityType === 'project')) {
    return `a créé le projet${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('update') && (actLower.includes('project') || entityType === 'project')) {
    return `a mis à jour les paramètres du projet${target ? ` « ${target} »` : ''}`;
  }
  if (actLower.includes('assign')) {
    return `a assigné un collaborateur${target ? ` au projet « ${target} »` : ''}`;
  }
  if (actLower.includes('message')) {
    return `a partagé un message dans la discussion${target ? ` « ${target} »` : ''}`;
  }

  return action ? `${action}${target ? ` (${target})` : ''}` : 'a effectué une action dans le workspace';
};

/**
 * Mappe l'action réelle vers les types standard d'interface
 */
const resolveActionType = (action?: string): Activity['action_type'] => {
  const actLower = (action || '').toLowerCase();
  if (actLower.includes('approve') || actLower.includes('valid')) return 'APPROVE_WORK';
  if (actLower.includes('upload') || actLower.includes('file')) return 'UPLOAD_FILE';
  if (actLower.includes('create') && actLower.includes('project')) return 'CREATE_PROJECT';
  if (actLower.includes('assign')) return 'ASSIGN_MEMBER';
  if (actLower.includes('message')) return 'SEND_MESSAGE';
  return 'SUBMIT_WORK';
};

export const activitiesService = {
  /**
   * Récupère le flux des activités de l'agence avec contrôle strict des permissions par rôle.
   * - Administrateur : Toutes les activités de l'agence.
   * - Employé : Uniquement les activités liées aux projets auxquels il est assigné ou qu'il a lui-même initiées.
   */
  async getActivities(userId?: string, isAdmin: boolean = true, limit: number = 50): Promise<Activity[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      let allowedProjectIds: string[] = [];

      // Si l'utilisateur est employé, identifier ses projets assignés
      if (!isAdmin && userId) {
        const { data: memberRows, error: memberErr } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userId);

        if (!memberErr && memberRows) {
          allowedProjectIds = memberRows.map((m) => m.project_id);
        }
      }

      // Requête principale sur public.activities
      const { data: rawActivities, error: actErr } = await supabase
        .from('activities')
        .select(`
          id,
          actor_id,
          project_id,
          action,
          entity_type,
          entity_id,
          metadata,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (actErr || !rawActivities || rawActivities.length === 0) {
        if (actErr) console.warn('[activitiesService] Erreur récupération public.activities :', actErr.message);
        return [];
      }

      // Filtrage de sécurité côté rôle (employé)
      const visibleActivities = isAdmin
        ? rawActivities
        : rawActivities.filter(
            (a) =>
              (a.project_id && allowedProjectIds.includes(a.project_id)) ||
              a.actor_id === userId
          );

      if (visibleActivities.length === 0) {
        return [];
      }

      // Récupération des profils des acteurs
      const actorIds = Array.from(new Set(visibleActivities.map((a) => a.actor_id).filter(Boolean)));
      const actorsById: Record<string, Profile> = {};

      if (actorIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', actorIds);

          if (profilesData) {
            for (const p of profilesData) {
              actorsById[p.id] = {
                id: p.id,
                full_name: p.full_name || 'Membre Agence',
                email: p.email || '',
                role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                  p.full_name || p.id
                )}`,
              };
            }
          }
        } catch (err) {
          console.warn('[activitiesService] Erreur récupération profiles acteurs :', err);
        }
      }

      // Récupération des noms des projets concernés
      const projectIds = Array.from(new Set(visibleActivities.map((a) => a.project_id).filter(Boolean)));
      const projectsById: Record<string, { id: string; name: string }> = {};

      if (projectIds.length > 0) {
        try {
          const { data: projectsData } = await supabase
            .from('projects')
            .select('id, name')
            .in('id', projectIds);

          if (projectsData) {
            for (const pr of projectsData) {
              projectsById[pr.id] = { id: pr.id, name: pr.name || 'Projet sans titre' };
            }
          }
        } catch (err) {
          console.warn('[activitiesService] Erreur récupération projets liés aux activités :', err);
        }
      }

      // Construction des objets Activity avec mapping rigoureux
      return visibleActivities.map((row) => {
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

        const description = formatActivityDescription(row.action, row.entity_type, metaObj);
        const targetName =
          (metaObj &&
            ('target_name' in metaObj || 'title' in metaObj || 'name' in metaObj) &&
            String((metaObj as any).target_name || (metaObj as any).title || (metaObj as any).name)) ||
          undefined;

        const projectName = row.project_id ? projectsById[row.project_id]?.name : undefined;

        return {
          id: row.id,
          project_id: row.project_id,
          project_title: projectName,
          project_name: projectName,
          user_id: row.actor_id,
          actor_id: row.actor_id,
          user: actorsById[row.actor_id] || {
            id: row.actor_id,
            full_name: 'Collaborateur',
            email: '',
            role: 'employee',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
              row.actor_id || 'user'
            )}`,
          },
          action_type: resolveActionType(row.action),
          action: row.action,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          metadata: metaObj,
          description,
          target_name: targetName,
          created_at: row.created_at,
        };
      });
    } catch (globalErr) {
      console.warn('[activitiesService] Exception getActivities :', globalErr);
      return [];
    }
  },

  /**
   * Enregistre un nouvel événement dans public.activities.
   */
  async logActivity(params: LogActivityParams): Promise<boolean> {
    if (!isSupabaseConfigured || !params.actorId || !params.action) {
      return false;
    }

    try {
      const payload = {
        actor_id: params.actorId,
        project_id: params.projectId || null,
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        metadata: params.metadata || null,
      };

      const { error } = await supabase.from('activities').insert(payload);
      if (error) {
        console.warn('[activitiesService] Impossible d’insérer l’activité dans Supabase :', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[activitiesService] Exception logActivity :', err);
      return false;
    }
  },
};
