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

const ACTIVITIES_STORAGE_KEY = 'tuws_real_activities_v3';

/**
 * Nettoyage immédiat des anciens enregistrements de démonstration
 */
const purgeDemoStorage = () => {
  try {
    localStorage.removeItem('tuws_activities_feed_v2');
    localStorage.removeItem('tuws_activities_v1');
    localStorage.removeItem('tuws_activities_cache_v1');
  } catch {
    // ignore
  }
};

// Exécuter la purge dès l'importation
purgeDemoStorage();

/**
 * Récupère les activités réelles enregistrées localement (actions faites par l'utilisateur connecté)
 */
const getRealLocalActivities = (): Activity[] => {
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filtrer strictement : aucun enregistrement contenant 'seed-' ou des noms démo
        return parsed.filter(
          (a) =>
            a &&
            !a.id?.startsWith('seed-') &&
            a.user?.full_name !== 'Sarah Benali' &&
            a.user?.full_name !== 'Alexandre Roy' &&
            a.user?.full_name !== 'Lucas Morel'
        );
      }
    }
  } catch (e) {
    console.warn('[activitiesService] Erreur lecture localStorage :', e);
  }
  return [];
};

/**
 * Sauvegarde les activités réelles en local
 */
const saveRealLocalActivities = (activities: Activity[]): void => {
  try {
    const clean = activities.filter((a) => !a.id?.startsWith('seed-'));
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(clean.slice(0, 100)));
  } catch (e) {
    console.warn('[activitiesService] Erreur sauvegarde localStorage :', e);
  }
};

/**
 * Synthétise une description éditoriale claire à partir de l'action, de l'entité et des métadonnées réelles
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
   * Récupère le flux 100% RÉEL des activités de l'application :
   * 1. Requête la table public.activities.
   * 2. Syntétise également les événements réels existants (projets, soumissions de livrables, documents importés).
   * 3. Récupère les vrais profils des utilisateurs de votre workspace (nom, rôle, avatar).
   * 4. AUCUNE donnée démo / fictive.
   */
  async getActivities(userId?: string, isAdmin: boolean = true, limit: number = 60): Promise<Activity[]> {
    purgeDemoStorage();

    const realActivities: Activity[] = [];
    const seenEntityKeys = new Set<string>();

    if (isSupabaseConfigured) {
      try {
        let allowedProjectIds: string[] = [];

        // Pour les employés, filtrer sur leurs projets assignés
        if (!isAdmin && userId) {
          const { data: memberRows } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', userId);

          if (memberRows) {
            allowedProjectIds = memberRows.map((m) => m.project_id);
          }
        }

        // 1. Récupération des activités explicites depuis public.activities
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

        if (!actErr && rawActivities && rawActivities.length > 0) {
          const visibleRows = isAdmin
            ? rawActivities
            : rawActivities.filter(
                (a) =>
                  (a.project_id && allowedProjectIds.includes(a.project_id)) ||
                  a.actor_id === userId
              );

          for (const row of visibleRows) {
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

            const dedupeKey = `${row.entity_type || 'act'}_${row.entity_id || row.id}_${row.action}`;
            seenEntityKeys.add(dedupeKey);

            realActivities.push({
              id: row.id,
              project_id: row.project_id,
              user_id: row.actor_id,
              actor_id: row.actor_id,
              action_type: resolveActionType(row.action),
              action: row.action,
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              metadata: metaObj,
              description,
              target_name: targetName,
              created_at: row.created_at,
            });
          }
        }

        // 2. Synthese automatique des créations de projets réels
        try {
          let projQuery = supabase
            .from('projects')
            .select('id, name, created_by, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

          if (!isAdmin && allowedProjectIds.length > 0) {
            projQuery = projQuery.in('id', allowedProjectIds);
          }

          const { data: realProjects } = await projQuery;
          if (realProjects) {
            for (const p of realProjects) {
              const dedupeKey = `project_${p.id}_create_project`;
              if (!seenEntityKeys.has(dedupeKey)) {
                seenEntityKeys.add(dedupeKey);
                realActivities.push({
                  id: `synth-proj-${p.id}`,
                  project_id: p.id,
                  project_name: p.name,
                  project_title: p.name,
                  user_id: p.created_by,
                  actor_id: p.created_by,
                  action_type: 'CREATE_PROJECT',
                  action: 'create_project',
                  entity_type: 'project',
                  entity_id: p.id,
                  description: `a créé le projet « ${p.name} »`,
                  target_name: p.name,
                  created_at: p.created_at,
                });
              }
            }
          }
        } catch (projErr) {
          console.warn('[activitiesService] Erreur synthèse projets :', projErr);
        }

        // 3. Synthèse automatique des soumissions de livrables réels
        try {
          let subQuery = supabase
            .from('submissions')
            .select('id, project_id, submitted_by, title, status, created_at, reviewed_by, reviewed_at')
            .order('created_at', { ascending: false })
            .limit(30);

          if (!isAdmin && allowedProjectIds.length > 0) {
            subQuery = subQuery.in('project_id', allowedProjectIds);
          }

          const { data: realSubs } = await subQuery;
          if (realSubs) {
            for (const s of realSubs) {
              const dedupeKey = `submission_${s.id}_submit_work`;
              if (!seenEntityKeys.has(dedupeKey)) {
                seenEntityKeys.add(dedupeKey);
                realActivities.push({
                  id: `synth-sub-${s.id}`,
                  project_id: s.project_id,
                  user_id: s.submitted_by,
                  actor_id: s.submitted_by,
                  action_type: s.status === 'APPROVED' ? 'APPROVE_WORK' : 'SUBMIT_WORK',
                  action: s.status === 'APPROVED' ? 'approve_work' : 'submit_work',
                  entity_type: 'submission',
                  entity_id: s.id,
                  description:
                    s.status === 'APPROVED'
                      ? `a validé le livrable « ${s.title} »`
                      : `a soumis le livrable « ${s.title} »`,
                  target_name: s.title,
                  created_at: s.created_at,
                });
              }
            }
          }
        } catch (subErr) {
          console.warn('[activitiesService] Erreur synthèse soumissions :', subErr);
        }

        // 4. Synthèse automatique des fichiers réels importés
        try {
          let filesQuery = supabase
            .from('files')
            .select('id, project_id, name, uploaded_by, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

          if (!isAdmin && allowedProjectIds.length > 0) {
            filesQuery = filesQuery.in('project_id', allowedProjectIds);
          }

          const { data: realFiles } = await filesQuery;
          if (realFiles) {
            for (const f of realFiles) {
              const dedupeKey = `file_${f.id}_upload_file`;
              if (!seenEntityKeys.has(dedupeKey)) {
                seenEntityKeys.add(dedupeKey);
                realActivities.push({
                  id: `synth-file-${f.id}`,
                  project_id: f.project_id,
                  user_id: f.uploaded_by,
                  actor_id: f.uploaded_by,
                  action_type: 'UPLOAD_FILE',
                  action: 'upload_file',
                  entity_type: 'file',
                  entity_id: f.id,
                  description: `a importé le document « ${f.name} »`,
                  target_name: f.name,
                  created_at: f.created_at,
                });
              }
            }
          }
        } catch (fileErr) {
          console.warn('[activitiesService] Erreur synthèse fichiers :', fileErr);
        }

        // 5. Récupération des vrais profils des utilisateurs de votre workspace
        const actorIds = Array.from(
          new Set(realActivities.map((a) => a.actor_id || a.user_id).filter(Boolean) as string[])
        );
        const projectIds = Array.from(
          new Set(realActivities.map((a) => a.project_id).filter(Boolean) as string[])
        );

        const profilesById: Record<string, Profile> = {};
        if (actorIds.length > 0) {
          try {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name, email, role, avatar_url, gender')
              .in('id', actorIds);

            if (profilesData) {
              for (const p of profilesData) {
                const name = p.full_name || p.email?.split('@')[0] || 'Membre du workspace';
                const avatar =
                  p.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

                profilesById[p.id] = {
                  id: p.id,
                  full_name: name,
                  email: p.email || '',
                  role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
                  avatar_url: avatar,
                  gender: p.gender,
                };
              }
            }
          } catch (pErr) {
            console.warn('[activitiesService] Erreur profils :', pErr);
          }
        }

        // Récupération des noms réels des projets
        const projectsById: Record<string, string> = {};
        if (projectIds.length > 0) {
          try {
            const { data: prData } = await supabase
              .from('projects')
              .select('id, name')
              .in('id', projectIds);

            if (prData) {
              for (const pr of prData) {
                projectsById[pr.id] = pr.name || 'Projet';
              }
            }
          } catch (prErr) {
            console.warn('[activitiesService] Erreur projets :', prErr);
          }
        }

        // Injection des profils et titres réels
        for (const act of realActivities) {
          const actId = act.actor_id || act.user_id;
          if (actId && profilesById[actId]) {
            act.user = profilesById[actId];
          } else if (!act.user) {
            act.user = {
              id: actId || 'user',
              full_name: 'Collaborateur',
              email: '',
              role: 'employee',
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(actId || 'user')}`,
            };
          }

          if (act.project_id && projectsById[act.project_id]) {
            act.project_name = projectsById[act.project_id];
            act.project_title = projectsById[act.project_id];
          }
        }
      } catch (globalErr) {
        console.warn('[activitiesService] Erreur récupération activités réelles Supabase :', globalErr);
      }
    }

    // Fusion avec les activités réelles récemment enregistrées dans la session locale
    const localReal = getRealLocalActivities();
    if (localReal.length > 0) {
      const existingIds = new Set(realActivities.map((a) => a.id));
      for (const loc of localReal) {
        if (!existingIds.has(loc.id)) {
          realActivities.push(loc);
        }
      }
    }

    // Tri chronologique décroissant strict (les plus récents en premier)
    realActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return realActivities.slice(0, limit);
  },

  /**
   * Enregistre un événement réel dans le flux d'activité
   */
  async logActivity(params: LogActivityParams): Promise<boolean> {
    if (!params.actorId || !params.action) {
      return false;
    }

    const targetName =
      (params.metadata &&
        ('target_name' in params.metadata || 'title' in params.metadata || 'name' in params.metadata) &&
        String(
          (params.metadata as any).target_name ||
            (params.metadata as any).title ||
            (params.metadata as any).name
        )) ||
      undefined;

    const projectName =
      (params.metadata &&
        ('project_name' in params.metadata || 'project_title' in params.metadata) &&
        String((params.metadata as any).project_name || (params.metadata as any).project_title)) ||
      undefined;

    const actorName =
      (params.metadata &&
        'actor_name' in params.metadata &&
        typeof (params.metadata as any).actor_name === 'string' &&
        (params.metadata as any).actor_name) ||
      'Collaborateur';

    const actorRole =
      (params.metadata &&
        'actor_role' in params.metadata &&
        (params.metadata as any).actor_role === 'admin'
        ? 'admin'
        : 'employee') as UserRole;

    const newActivity: Activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      project_id: params.projectId || null,
      project_name: projectName,
      project_title: projectName,
      user_id: params.actorId,
      actor_id: params.actorId,
      user: {
        id: params.actorId,
        full_name: actorName,
        email: '',
        role: actorRole,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(actorName)}`,
      },
      action_type: resolveActionType(params.action),
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata,
      description: formatActivityDescription(params.action, params.entityType, params.metadata),
      target_name: targetName,
      created_at: new Date().toISOString(),
    };

    // 1. Enregistrement local
    try {
      const current = getRealLocalActivities();
      saveRealLocalActivities([newActivity, ...current]);
    } catch (e) {
      console.warn('[activitiesService] Erreur mise à jour locale :', e);
    }

    // 2. Notification locale
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tuws:activity_logged', { detail: newActivity }));
      }
    } catch {
      // ignore
    }

    // 3. Enregistrement Supabase
    if (isSupabaseConfigured) {
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
          console.warn('[activitiesService] Erreur insertion Supabase activity :', error.message);
        }
      } catch (err) {
        console.warn('[activitiesService] Exception insertion Supabase activity :', err);
      }
    }

    return true;
  },
};

