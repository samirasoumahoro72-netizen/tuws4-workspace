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

const ACTIVITIES_STORAGE_KEY = 'tuws_activities_feed_v2';

/**
 * Génère des activités initiales dynamiques et réalistes calées sur les dernières heures/jours
 */
const createSeedActivities = (): Activity[] => {
  const now = Date.now();
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;

  return [
    {
      id: 'seed-act-1',
      project_id: 'proj-1',
      project_name: 'Plateforme NLP Client Alpha',
      project_title: 'Plateforme NLP Client Alpha',
      user_id: 'user-sarah',
      actor_id: 'user-sarah',
      user: {
        id: 'user-sarah',
        full_name: 'Sarah Benali',
        email: 'sarah.b@tuwshiuah.com',
        role: 'employee',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah%20Benali&gender=female',
      },
      action_type: 'SUBMIT_WORK',
      action: 'submit_work',
      entity_type: 'submission',
      description: 'a soumis le livrable « Module Détection Objets & Parsing v2 »',
      target_name: 'Module Détection Objets & Parsing v2',
      created_at: new Date(now - 18 * m).toISOString(),
    },
    {
      id: 'seed-act-2',
      project_id: 'proj-2',
      project_name: 'Infrastructure Cloud',
      project_title: 'Infrastructure Cloud',
      user_id: 'user-admin',
      actor_id: 'user-admin',
      user: {
        id: 'user-admin',
        full_name: 'Alexandre Roy',
        email: 'direction@tuwshiuah.com',
        role: 'admin',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexandre%20Roy&gender=male',
      },
      action_type: 'APPROVE_WORK',
      action: 'approve_work',
      entity_type: 'submission',
      description: 'a validé le livrable « Architecture Microservices Kubernetes »',
      target_name: 'Architecture Microservices Kubernetes',
      created_at: new Date(now - 52 * m).toISOString(),
    },
    {
      id: 'seed-act-3',
      project_id: 'proj-2',
      project_name: 'Infrastructure Cloud',
      project_title: 'Infrastructure Cloud',
      user_id: 'user-lucas',
      actor_id: 'user-lucas',
      user: {
        id: 'user-lucas',
        full_name: 'Lucas Morel',
        email: 'lucas.m@tuwshiuah.com',
        role: 'employee',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas%20Morel&gender=male',
      },
      action_type: 'UPLOAD_FILE',
      action: 'upload_file',
      entity_type: 'file',
      description: 'a importé le document « spec_technique_cloud_k8s_v2.pdf »',
      target_name: 'spec_technique_cloud_k8s_v2.pdf',
      created_at: new Date(now - 2 * h).toISOString(),
    },
    {
      id: 'seed-act-4',
      project_id: 'proj-1',
      project_name: 'Plateforme NLP Client Alpha',
      project_title: 'Plateforme NLP Client Alpha',
      user_id: 'user-thomas',
      actor_id: 'user-thomas',
      user: {
        id: 'user-thomas',
        full_name: 'Thomas Laurent',
        email: 'thomas.l@tuwshiuah.com',
        role: 'employee',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas%20Laurent&gender=male',
      },
      action_type: 'SUBMIT_WORK',
      action: 'submit_work',
      entity_type: 'submission',
      description: 'a soumis le livrable « Audit Réseau Core & VPN Sécurisé »',
      target_name: 'Audit Réseau Core & VPN Sécurisé',
      created_at: new Date(now - 1 * d - 3 * h).toISOString(),
    },
    {
      id: 'seed-act-5',
      project_id: 'proj-5',
      project_name: 'Refonte Portail Utilisateur',
      project_title: 'Refonte Portail Utilisateur',
      user_id: 'user-admin',
      actor_id: 'user-admin',
      user: {
        id: 'user-admin',
        full_name: 'Alexandre Roy',
        email: 'direction@tuwshiuah.com',
        role: 'admin',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexandre%20Roy&gender=male',
      },
      action_type: 'ASSIGN_MEMBER',
      action: 'assign_member',
      entity_type: 'project',
      description: 'a assigné Julie Vasseur au projet « Refonte Portail Utilisateur »',
      target_name: 'Refonte Portail Utilisateur',
      created_at: new Date(now - 1 * d - 6 * h).toISOString(),
    },
    {
      id: 'seed-act-6',
      project_id: 'proj-5',
      project_name: 'Refonte Portail Utilisateur',
      project_title: 'Refonte Portail Utilisateur',
      user_id: 'user-julie',
      actor_id: 'user-julie',
      user: {
        id: 'user-julie',
        full_name: 'Julie Vasseur',
        email: 'julie.v@tuwshiuah.com',
        role: 'employee',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julie%20Vasseur&gender=female',
      },
      action_type: 'UPLOAD_FILE',
      action: 'upload_file',
      entity_type: 'file',
      description: 'a importé le document « maquette_figma_portail_v3.pdf »',
      target_name: 'maquette_figma_portail_v3.pdf',
      created_at: new Date(now - 1 * d - 8 * h).toISOString(),
    },
    {
      id: 'seed-act-7',
      project_id: 'proj-6',
      project_name: 'Migration SI Interne & RAG',
      project_title: 'Migration SI Interne & RAG',
      user_id: 'user-admin',
      actor_id: 'user-admin',
      user: {
        id: 'user-admin',
        full_name: 'Alexandre Roy',
        email: 'direction@tuwshiuah.com',
        role: 'admin',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexandre%20Roy&gender=male',
      },
      action_type: 'CREATE_PROJECT',
      action: 'create_project',
      entity_type: 'project',
      description: 'a créé le projet « Migration SI Interne & RAG »',
      target_name: 'Migration SI Interne & RAG',
      created_at: new Date(now - 2 * d - 4 * h).toISOString(),
    },
    {
      id: 'seed-act-8',
      project_id: 'proj-4',
      project_name: 'Modèle IA Vision',
      project_title: 'Modèle IA Vision',
      user_id: 'user-sarah',
      actor_id: 'user-sarah',
      user: {
        id: 'user-sarah',
        full_name: 'Sarah Benali',
        email: 'sarah.b@tuwshiuah.com',
        role: 'employee',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah%20Benali&gender=female',
      },
      action_type: 'SUBMIT_WORK',
      action: 'submit_work',
      entity_type: 'submission',
      description: 'a soumis le livrable « Dataset Entraînement Modèle v1 »',
      target_name: 'Dataset Entraînement Modèle v1',
      created_at: new Date(now - 3 * d).toISOString(),
    },
  ];
};

/**
 * Récupère ou initialise les activités stockées localement
 */
const getStoredActivities = (): Activity[] => {
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[activitiesService] Erreur lecture localStorage :', e);
  }

  const seeds = createSeedActivities();
  try {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(seeds));
  } catch (e) {
    console.warn('[activitiesService] Erreur écriture seed localStorage :', e);
  }
  return seeds;
};

/**
 * Sauvegarde les activités localement
 */
const saveStoredActivities = (activities: Activity[]): void => {
  try {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities.slice(0, 100)));
  } catch (e) {
    console.warn('[activitiesService] Erreur sauvegarde localStorage :', e);
  }
};

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
   * - Repli dynamique garanti : Si la table distante est vide ou inaccessible, affiche le journal local enrichi.
   */
  async getActivities(userId?: string, isAdmin: boolean = true, limit: number = 60): Promise<Activity[]> {
    let remoteActivities: Activity[] = [];

    if (isSupabaseConfigured) {
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

        if (!actErr && rawActivities && rawActivities.length > 0) {
          // Filtrage de sécurité côté rôle (employé)
          const visibleActivities = isAdmin
            ? rawActivities
            : rawActivities.filter(
                (a) =>
                  (a.project_id && allowedProjectIds.includes(a.project_id)) ||
                  a.actor_id === userId
              );

          if (visibleActivities.length > 0) {
            // Récupération des profils des acteurs
            const actorIds = Array.from(new Set(visibleActivities.map((a) => a.actor_id).filter(Boolean)));
            const actorsById: Record<string, Profile> = {};

            if (actorIds.length > 0) {
              try {
                const { data: profilesData } = await supabase
                  .from('profiles')
                  .select('id, full_name, email, role, avatar_url')
                  .in('id', actorIds);

                if (profilesData) {
                  for (const p of profilesData) {
                    actorsById[p.id] = {
                      id: p.id,
                      full_name: p.full_name || 'Membre Agence',
                      email: p.email || '',
                      role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as UserRole,
                      avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
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
            remoteActivities = visibleActivities.map((row) => {
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
          }
        }
      } catch (globalErr) {
        console.warn('[activitiesService] Exception Supabase getActivities :', globalErr);
      }
    }

    // Récupération locale pour fusion ou repli si distant est vide
    const localActivities = getStoredActivities();

    let combined: Activity[];
    if (remoteActivities.length > 0) {
      // Fusionner : privilégier distant, ajouter locaux récents non dupliqués
      const remoteIds = new Set(remoteActivities.map((a) => a.id));
      const localExtras = localActivities.filter((a) => !remoteIds.has(a.id) && !a.id.startsWith('seed-'));
      combined = [...localExtras, ...remoteActivities];
    } else {
      // Distant vide ou inaccessible : utiliser le journal local garanti
      combined = localActivities;
    }

    // Filtrage par permission pour les employés si mode local
    if (!isAdmin && userId) {
      combined = combined.filter((a) => a.actor_id === userId || a.user_id === userId);
    }

    // Tri chronologique décroissant et limitation
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined.slice(0, limit);
  },

  /**
   * Enregistre un nouvel événement dans le flux d'activité :
   * - Met à jour immédiatement le cache local en temps réel.
   * - Déclenche un événement custom pour actualiser l'interface instantanément.
   * - Tente l'enregistrement asynchrone dans Supabase si connecté.
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
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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

    // 1. Enregistrement local immédiat
    try {
      const current = getStoredActivities();
      saveStoredActivities([newActivity, ...current]);
    } catch (e) {
      console.warn('[activitiesService] Erreur mise à jour locale :', e);
    }

    // 2. Notification d'événement global
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tuws:activity_logged', { detail: newActivity }));
      }
    } catch {
      // ignore
    }

    // 3. Enregistrement dans Supabase si disponible
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
          console.warn('[activitiesService] Supabase insert activity warning :', error.message);
        }
      } catch (err) {
        console.warn('[activitiesService] Exception Supabase insert activity :', err);
      }
    }

    return true;
  },
};

