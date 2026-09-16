import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { activitiesService } from '../../services/activitiesService';
import { Activity } from '../../types/database';
import { Icon } from '../../components/ui/Icon';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

type ActivityFilter = 'ALL' | 'PROJECTS' | 'SUBMISSIONS' | 'FILES' | 'TEAM';

interface GroupedActivities {
  dayLabel: string;
  activities: Activity[];
}

/**
 * Formatage de l'heure exacte (ex: 11:42)
 */
const formatEventTime = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '--:--';
  }
};

/**
 * Regroupement des activités par date éditoriale (Aujourd'hui, Hier, Date longue)
 */
const groupActivitiesByDay = (activities: Activity[]): GroupedActivities[] => {
  const groups: Record<string, Activity[]> = {};
  const order: string[] = [];

  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  for (const act of activities) {
    if (!act.created_at) continue;
    const d = new Date(act.created_at);
    let label = '';
    if (d.toDateString() === todayStr) {
      label = "Aujourd'hui";
    } else if (d.toDateString() === yesterdayStr) {
      label = 'Hier';
    } else {
      label = d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(act);
  }

  return order.map((label) => ({
    dayLabel: label,
    activities: groups[label],
  }));
};

/**
 * Détermine l'icône discrète et le badge contextuel de l'activité
 */
const getActivityContext = (activity: Activity) => {
  const type = activity.action_type;
  const act = (activity.action || '').toLowerCase();

  if (type === 'APPROVE_WORK' || act.includes('approve') || act.includes('valid')) {
    return {
      icon: 'verified',
      tag: 'Validation',
      isMajor: true,
      accentBorder: 'border-l-emerald-500',
    };
  }
  if (type === 'SUBMIT_WORK' || act.includes('submit')) {
    return {
      icon: 'rule_folder',
      tag: 'Livrable',
      isMajor: true,
      accentBorder: 'border-l-amber-500',
    };
  }
  if (type === 'CREATE_PROJECT' || act.includes('create') && act.includes('project')) {
    return {
      icon: 'rocket_launch',
      tag: 'Projet',
      isMajor: true,
      accentBorder: 'border-l-indigo-500',
    };
  }
  if (type === 'UPLOAD_FILE' || act.includes('file')) {
    return {
      icon: 'description',
      tag: 'Document',
      isMajor: false,
      accentBorder: '',
    };
  }
  if (type === 'ASSIGN_MEMBER' || act.includes('assign')) {
    return {
      icon: 'person_add',
      tag: 'Équipe',
      isMajor: false,
      accentBorder: '',
    };
  }
  if (type === 'SEND_MESSAGE' || act.includes('message')) {
    return {
      icon: 'chat',
      tag: 'Discussion',
      isMajor: false,
      accentBorder: '',
    };
  }

  return {
    icon: 'history',
    tag: 'Activité',
    isMajor: false,
    accentBorder: '',
  };
};

export const ActivityPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('ALL');

  const fetchActivities = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await activitiesService.getActivities(user?.id, isAdmin, 60);
      setActivities(data);
    } catch (err) {
      console.warn('[ActivityPage] Erreur chargement activités :', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    fetchActivities(true);

    const handleNewActivity = () => {
      fetchActivities(false);
    };

    window.addEventListener('tuws:activity_logged', handleNewActivity);

    // Écoute Supabase Realtime en direct sur les tables d'activité
    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('realtime_activities_feed')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'activities' },
            () => fetchActivities(false)
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'projects' },
            () => fetchActivities(false)
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'submissions' },
            () => fetchActivities(false)
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'files' },
            () => fetchActivities(false)
          )
          .subscribe();
      } catch (err) {
        console.warn('[ActivityPage] Erreur souscription temps réel :', err);
      }
    }

    return () => {
      window.removeEventListener('tuws:activity_logged', handleNewActivity);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchActivities]);

  // Filtrage éditorial des activités
  const filteredActivities = useMemo(() => {
    if (activeFilter === 'ALL') return activities;

    return activities.filter((item) => {
      const actLower = (item.action || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const entityLower = (item.entity_type || '').toLowerCase();
      const type = item.action_type;

      if (activeFilter === 'PROJECTS') {
        return (
          type === 'CREATE_PROJECT' ||
          actLower.includes('project') ||
          entityLower === 'project' ||
          descLower.includes('projet')
        );
      }
      if (activeFilter === 'SUBMISSIONS') {
        return (
          type === 'SUBMIT_WORK' ||
          type === 'APPROVE_WORK' ||
          actLower.includes('submit') ||
          actLower.includes('valid') ||
          actLower.includes('approv') ||
          descLower.includes('livrable') ||
          entityLower === 'submission'
        );
      }
      if (activeFilter === 'FILES') {
        return (
          type === 'UPLOAD_FILE' ||
          actLower.includes('file') ||
          actLower.includes('upload') ||
          entityLower === 'file' ||
          descLower.includes('document') ||
          descLower.includes('fichier')
        );
      }
      if (activeFilter === 'TEAM') {
        return (
          type === 'ASSIGN_MEMBER' ||
          actLower.includes('assign') ||
          actLower.includes('member') ||
          descLower.includes('collaborateur') ||
          descLower.includes('équipe')
        );
      }
      return true;
    });
  }, [activities, activeFilter]);

  // Groupement chronologique par journée
  const groupedTimeline = useMemo(() => {
    return groupActivitiesByDay(filteredActivities);
  }, [filteredActivities]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* En-tête Éditorial du Journal d'Agence */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-surface-container">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
              Flux d’Activité
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-container text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Temps réel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-secondary mt-1 font-medium">
            Chronologie vivante des décisions, soumissions, fichiers et livrables réels de TUWSHIUAH.
          </p>
        </div>

        {/* Filtres et bouton rafraîchir */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: 'ALL', label: 'Tout' },
                { key: 'PROJECTS', label: 'Projets' },
                { key: 'SUBMISSIONS', label: 'Livrables' },
                { key: 'FILES', label: 'Fichiers' },
                { key: 'TEAM', label: 'Équipe' },
              ] as { key: ActivityFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeFilter === f.key
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-primary-container'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchActivities(true)}
            title="Actualiser le flux"
            className="p-1.5 rounded-full bg-surface-container-low text-secondary hover:bg-surface-container hover:text-primary-container transition-colors"
          >
            <Icon name="refresh" className={`text-base ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contenu : Chargement, Empty State ou Timeline Verticale */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-secondary">
          <Icon name="spinner" spin className="text-3xl text-brand-orange" />
          <span className="text-xs font-medium">Connexion au flux d'activité en temps réel...</span>
        </div>
      ) : activities.length === 0 ? (
        /* ÉTAT VIDE AUTHENTIQUE SANS DONNÉES DÉMO */
        <div className="py-20 bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary mb-3">
            <Icon name="history" className="text-2xl" />
          </div>
          <h2 className="font-headline text-base font-bold text-primary-container mb-1">
            Aucune activité pour le moment
          </h2>
          <p className="text-xs text-secondary leading-relaxed max-w-sm">
            Les activités réelles de vos projets (création de projet, soumission de livrable, validation, import de fichier) apparaîtront ici automatiquement en temps réel dès leur création.
          </p>
        </div>
      ) : filteredActivities.length === 0 ? (
        /* État filtre sans résultat */
        <div className="py-16 text-center text-secondary text-xs flex flex-col items-center gap-2">
          <Icon name="filter_list_off" className="text-2xl" />
          <span>Aucune activité enregistrée dans cette catégorie.</span>
        </div>
      ) : (
        /* 4. STRUCTURE DE TIMELINE ÉDITORIALE VERTICALE */
        <div className="flex flex-col gap-8">
          {groupedTimeline.map((group) => (
            <div key={group.dayLabel} className="flex flex-col gap-4">
              {/* En-tête de date / journée */}
              <div className="flex items-center gap-3">
                <span className="font-headline text-xs font-bold text-secondary uppercase tracking-wider">
                  {group.dayLabel}
                </span>
                <div className="flex-1 h-px bg-surface-container" />
              </div>

              {/* Ligne chronologique des événements de la journée */}
              <div className="relative pl-3 sm:pl-6 ml-2 sm:ml-4 border-l border-surface-container space-y-6">
                {group.activities.map((item) => {
                  const ctx = getActivityContext(item);
                  const time = formatEventTime(item.created_at);
                  const authorName = item.user?.full_name || 'Membre agence';
                  const isAuthorAdmin = item.user?.role === 'admin';
                  const avatarUrl =
                    item.user?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorName)}`;

                  return (
                    <div
                      key={item.id}
                      className={`relative flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl bg-surface-container-lowest border border-surface-container/80 shadow-xs hover:border-surface-container-high transition-all group ${
                        ctx.isMajor ? ctx.accentBorder : ''
                      }`}
                    >
                      {/* Pastille de l'événement sur la timeline */}
                      <span
                        className={`absolute -left-[19px] sm:-left-[31px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-lowest ${
                          ctx.isMajor ? 'bg-on-tertiary-container' : 'bg-secondary'
                        }`}
                      />

                      {/* Colonne heure sobre */}
                      <div className="font-mono text-[11px] text-secondary font-medium shrink-0 pt-0.5 w-10 sm:w-11">
                        {time}
                      </div>

                      {/* Avatar auteur */}
                      <div className="relative shrink-0">
                        <img
                          src={avatarUrl}
                          alt={authorName}
                          className="w-8 h-8 rounded-full object-cover shadow-2xs ring-1 ring-surface-container"
                        />
                      </div>

                      {/* Corps éditorial de l'événement */}
                      <div className="flex flex-col min-w-0 flex-1">
                        {/* Auteur + Tag contextuel */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-headline text-xs font-bold text-primary-container">
                            {authorName}
                          </span>
                          {isAuthorAdmin && (
                            <span className="text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-1.5 py-0.2 rounded">
                              Direction
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-secondary px-1.5 py-0.2 rounded bg-surface-container">
                            {ctx.tag}
                          </span>
                        </div>

                        {/* Action réalisée (Mise en avant visuelle) */}
                        <p className="text-xs sm:text-sm font-medium text-on-surface leading-relaxed">
                          {item.description}
                        </p>

                        {/* Projet associé cliquable */}
                        {item.project_id && item.project_name && (
                          <div className="mt-2 pt-1.5 border-t border-surface-container/50">
                            <Link
                              to={`/projects/${item.project_id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-on-tertiary-container transition-colors group/link"
                            >
                              <Icon name="folder_open" className="text-[14px] text-secondary" />
                              <span>Projet · {item.project_name}</span>
                              <Icon
                                name="arrow_forward"
                                className="text-[12px] opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 transition-all"
                              />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
