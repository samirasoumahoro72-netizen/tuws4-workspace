import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { dashboardService, DashboardData } from '../../services/dashboardService';
import { projectService } from '../../services/projectService';
import { formatRelativeTime } from '../../lib/utils';
import { ProjectFormModal } from '../../components/projects/ProjectFormModal';
import { AssignTaskModal } from '../../components/projects/AssignTaskModal';
import { Project } from '../../types/database';

export const DashboardPage: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await dashboardService.getDashboardData(user?.id, isAdmin);
      setDashboardData(data);
      if (isManualRefresh) {
        showToast('Données du Dashboard actualisées depuis Supabase', 'sync', 'success');
      }
    } catch {
      showToast('Erreur lors de la synchronisation des données', 'error', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = projectService.subscribeToProjects(() => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, isAdmin]);

  const handleProjectCreated = (newProj: Project) => {
    showToast(`Projet « ${newProj.name || newProj.title} » créé avec succès !`, 'success');
    loadData();
  };

  const handleTaskAssigned = (info: { title: string; projectName: string; employeeName: string }) => {
    showToast(`Tâche « ${info.title} » attribuée à ${info.employeeName} !`, 'success');
    loadData();
  };

  const stats = dashboardData?.stats || {
    totalProjects: 0,
    inProgressProjects: 0,
    completedProjects: 0,
    delayedProjects: 0,
    totalMembers: 1,
    totalAdmins: 1,
    totalEmployees: 0,
    pendingSubmissionsCount: 0,
    unreadNotificationsCount: 0,
  };

  const totalMembers = stats.totalMembers ?? (Math.max(stats.totalAdmins || 1, 1) + (stats.totalEmployees || 0));
  const totalAdmins = stats.totalAdmins || 1;

  const isFemale =
    profile?.gender === 'female' ||
    ((user as any)?.user_metadata?.gender === 'female') ||
    (profile?.gender === undefined && (
      (profile?.full_name && /samira|sarah|julie|amina|inès|ines|marie|laura|claire|sophie|camille|emma|chloé|léa|noura/i.test(profile.full_name)) ||
      (user?.email && /samira/i.test(user.email))
    ));

  const pendingSubmissions = dashboardData?.pendingSubmissions || [];
  const activeProjects = dashboardData?.activeProjects || [];
  const employees = dashboardData?.employees || [];
  const activities = dashboardData?.activities || [];

  if (loading && !dashboardData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Icon name="spinner" spin className="text-3xl text-brand-orange" />
        <span className="font-headline text-sm font-semibold text-primary-container">
          Chargement des indicateurs en direct depuis Supabase...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Welcome */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container text-on-primary shadow-sm">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isAdmin ? 'Vue Direction Générale' : 'Espace Collaborateur'}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-high p-0.5 rounded-lg">
            <button className="px-3 py-1 rounded text-[11px] font-semibold bg-surface-container-lowest text-primary-container shadow-sm transition-all">
              Aujourd'hui
            </button>
            <button className="px-3 py-1 rounded text-[11px] font-semibold text-secondary hover:text-primary-container transition-all">
              Cette semaine
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {isAdmin ? (
            <>
              <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
                {isFemale ? 'Bonjour, Mme la Directrice' : 'Bonjour, M. le Directeur'}
              </h1>
              <p className="text-sm text-secondary">
                Supervision globale et arbitrages opérationnels de l'agence.
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
                    {isFemale ? 'Bonjour, Mme' : 'Bonjour, M.'} {(profile?.full_name || (user as any)?.user_metadata?.full_name || user?.email || 'Collaborateur').split(' ')[0]}
                  </h1>
                </div>
                <p className="text-sm text-secondary">
                  {profile?.job_title || 'Collaborateur'} •{' '}
                  <span className="text-on-tertiary-container font-semibold">
                    {stats.pendingSubmissionsCount > 0 ? `${stats.pendingSubmissionsCount} livrables` : 'Workspace'}
                  </span>{' '}
                  cette semaine
                </p>
              </div>
              <div className="relative shrink-0 w-12 h-12 rounded-xl bg-surface-container-high p-1 shadow-sm flex items-center justify-center">
                <img
                  src={profile?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnB8-LrzApQulqNkPJbPdGprKfPsV6m6e_qy5NnWlvXmetrpKzZfK_0XcEXlb9H_hJRcf6Uh_QLQDhX26YKcGxMnpdhkUbmln8uliAQkRb6itVjrnyOxX5iAsh2dO31ZdQeeHQbGF8AwNcSEHiZSLfhRqjvfATw0LwX8jbI8JLqYRkb0LVdVA8A8RHx6b5a9juSNpGWhU68laTs8dKx492aA_k0OVTtQOUX_RBoGXIJP9mnV5GqAZngg'}
                  alt={profile?.full_name || 'Collaborateur'}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {isAdmin ? (
          <div className="grid grid-cols-2 gap-3 mt-1">
            <Button
              variant="orange"
              icon="add_circle"
              className="shadow-md"
              onClick={() => setIsCreateProjectModalOpen(true)}
            >
              Nouveau projet
            </Button>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => setIsAssignTaskModalOpen(true)}
            >
              Attribuer tâche
            </Button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-primary-container p-5 text-on-primary shadow-md">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-on-tertiary-container/15 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-secondary-fixed">
                  <Icon name="verified_user" className="text-[18px]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Livrable Validateur Officiel
                  </span>
                </div>
                <span className="text-[11px] font-semibold bg-white/10 px-2 py-0.5 rounded-full text-surface-dim">
                  Audit Direct
                </span>
              </div>
              <div className="flex flex-col">
                <h2 className="font-headline text-lg font-bold text-on-primary">
                  Validation Hiérarchique
                </h2>
                <p className="text-xs text-primary-fixed-dim">
                  Transmettez vos modèles, notebooks et rapports de sprint au Patron en un clic.
                </p>
              </div>
              <Button
                variant="orange"
                icon="cloud_upload"
                className="w-full"
                onClick={() => navigate('/submissions')}
              >
                Soumettre un travail officiel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Effectif */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase">
              {isAdmin ? 'Effectif' : 'Projets Assignés'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
              <Icon name={isAdmin ? 'badge' : 'folder_copy'} className="text-[18px]" />
            </div>
          </div>
          <div>
            <div className="font-headline text-2xl font-bold text-primary-container">
              {isAdmin ? `${totalMembers} ${totalMembers > 1 ? 'membres' : 'membre'}` : stats.totalProjects}
            </div>
            <div className="text-xs text-secondary truncate mt-0.5">
              {isAdmin
                ? `${totalAdmins} Direction • ${stats.totalEmployees} ${stats.totalEmployees > 1 ? 'Collaborateurs' : 'Collaborateur'}`
                : 'actifs'}
            </div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary-container h-full w-full rounded-full" />
          </div>
        </div>

        {/* Card 2: Projets Actifs */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase">
              {isAdmin ? 'Projets Actifs' : 'Tâches en cours'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container">
              <Icon name={isAdmin ? 'rocket_launch' : 'pending_actions'} className="text-[18px]" />
            </div>
          </div>
          <div>
            <div className="font-headline text-2xl font-bold text-primary-container">
              {isAdmin ? `${stats.totalProjects} ${stats.totalProjects > 1 ? 'projets' : 'projet'}` : stats.inProgressProjects}
            </div>
            <div className="text-xs text-secondary truncate mt-0.5">
              {isAdmin
                ? `${stats.inProgressProjects} en cours • ${stats.delayedProjects} retard`
                : '2 urgentes'}
            </div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-on-tertiary-container h-full w-4/6 rounded-l-full" />
            <div className="bg-error h-full w-1/6" />
            <div className="bg-emerald-500 h-full w-1/6 rounded-r-full" />
          </div>
        </div>

        {/* Card 3: À Valider */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase">
              {isAdmin ? 'À Valider' : 'Validations'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
              <Icon name={isAdmin ? 'rule_folder' : 'check_circle'} className="text-[18px]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline text-2xl font-bold text-primary-container">
                {isAdmin ? stats.pendingSubmissionsCount : stats.completedProjects}
              </span>
              {isAdmin && stats.pendingSubmissionsCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-container text-[11px] font-bold">
                  Urgent
                </span>
              )}
            </div>
            <div className="text-xs text-secondary truncate mt-0.5">
              {isAdmin ? 'Livrables soumis' : 'ce mois-ci'}
            </div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-on-tertiary-container h-full w-3/4 rounded-full" />
          </div>
        </div>
      </div>

      {/* Priority Deliverables (Admin) */}
      {isAdmin && pendingSubmissions.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container" />
              <h2 className="font-headline text-base font-bold text-primary-container">
                Travaux à valider en priorité
              </h2>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-secondary">
              {pendingSubmissions.length} {pendingSubmissions.length > 1 ? 'requêtes' : 'requête'}
            </span>
          </div>

          {pendingSubmissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-4 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
                    <Icon
                      name={sub.title.toLowerCase().includes('vision') ? 'smart_toy' : 'security'}
                      className="text-[20px]"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-headline text-base font-bold text-primary-container truncate">
                      {sub.title}
                    </h3>
                    <p className="text-xs text-secondary flex items-center gap-1 mt-0.5">
                      <span>Soumis par</span>
                      <strong className="font-semibold text-on-surface">
                        {sub.author?.full_name || 'Collaborateur'}
                      </strong>
                      <span>• {formatRelativeTime(sub.created_at)}</span>
                    </p>
                  </div>
                </div>
                <StatusBadge status={sub.status} />
              </div>

              {sub.files?.[0] && (
                <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between text-secondary text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      name={sub.files[0].file_type === 'binary' ? 'memory' : 'description'}
                      className="text-[18px] text-primary-container"
                    />
                    <span className="truncate">{sub.files[0].file_name}</span>
                  </div>
                  <span className="text-[11px] font-mono shrink-0 ml-2">
                    {sub.files[0].file_size}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="visibility"
                  className="flex-1"
                  onClick={() => showToast('Ouverture du document...')}
                >
                  Examiner
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon="check_circle"
                  className="flex-1"
                  onClick={() => showToast(`"${sub.title}" validé par la Direction !`)}
                >
                  Valider
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee: Priority message from Boss */}
      {!isAdmin && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wide">
              Direction Générale
            </span>
            <span className="font-mono text-xs text-secondary">Aujourd'hui</span>
          </div>
          <div className="p-5 rounded-2xl bg-surface-container-high border border-surface-container flex flex-col gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnB8-LrzApQulqNkPJbPdGprKfPsV6m6e_qy5NnWlvXmetrpKzZfK_0XcEXlb9H_hJRcf6Uh_QLQDhX26YKcGxMnpdhkUbmln8uliAQkRb6itVjrnyOxX5iAsh2dO31ZdQeeHQbGF8AwNcSEHiZSLfhRqjvfATw0LwX8jbI8JLqYRkb0LVdVA8A8RHx6b5a9juSNpGWhU68laTs8dKx492aA_k0OVTtQOUX_RBoGXIJP9mnV5GqAZngg"
                  alt="Direction"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-on-tertiary-container ring-2 ring-surface-container-high" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-headline text-sm font-bold text-on-surface truncate">
                    Direction Générale
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-primary-container text-[11px] font-semibold">
                    Important
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mt-1 leading-snug">
                  «&nbsp;{(profile?.full_name || (user as any)?.user_metadata?.full_name || 'Collaborateur').split(' ')[0]}, bienvenue sur l'espace opérationnel de TUWSHIUAH. Consultez vos projets assignés et soumettez vos livrables ci-dessous.&nbsp;»
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button variant="primary" size="sm" icon="chat">
                Ouvrir discussion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active Projects */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-primary-container">
            {isAdmin ? 'Projets en cours' : 'Mes Projets Actifs'}
          </h2>
          <Link
            to="/projects"
            className="text-[11px] font-bold text-on-tertiary-container hover:underline flex items-center gap-0.5"
          >
            Voir les {stats.totalProjects}
            <Icon name="arrow_forward" className="text-[14px]" />
          </Link>
        </div>

        {activeProjects.length === 0 ? (
          <div className="p-6 bg-surface-container-lowest rounded-2xl border border-surface-container text-center flex flex-col items-center justify-center gap-2">
            <Icon name="folder_open" className="text-2xl text-secondary" />
            <p className="text-sm font-semibold text-primary-container">Aucun projet en cours</p>
            <p className="text-xs text-secondary">
              {isAdmin ? 'Créez un nouveau projet pour lancer les opérations.' : 'Aucun projet ne vous est actuellement assigné.'}
            </p>
          </div>
        ) : (
          activeProjects.map((project) => {
            const isDelayed = (project.status || '').toUpperCase() === 'DELAYED';
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-3 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-headline text-base font-bold text-primary-container truncate">
                      {project.title}
                    </h3>
                    <p className="text-xs text-secondary mt-0.5 line-clamp-1">{project.description}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low/70 border border-surface-container/60">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-secondary">Progression globale</span>
                    <span className="text-xs font-bold text-primary-container">
                      {project.progress >= 80 ? 'Finalisation' : project.progress >= 40 ? 'En cours' : 'Démarrage'}
                    </span>
                  </div>
                  <CircularProgress
                    value={project.progress || 0}
                    size={42}
                    strokeWidth={4}
                    status={project.status}
                  />
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className={`flex items-center gap-1 ${isDelayed ? 'text-error' : 'text-secondary'}`}>
                    <Icon name={isDelayed ? 'warning' : 'event'} className="text-[16px]" />
                    <span className="font-mono text-xs">
                      {isDelayed
                        ? 'Échéance dépassée'
                        : project.deadline
                        ? `Échéance: ${new Date(project.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                        : 'Aucune échéance fixée'}
                    </span>
                  </div>
                  <div className="flex items-center -space-x-2">
                    {project.members?.slice(0, 3).map((m, i) => (
                      <img
                        key={i}
                        src={m.avatar_url}
                        alt={m.full_name}
                        className="w-6 h-6 rounded-full object-cover shadow-sm ring-2 ring-surface-container-lowest"
                      />
                    ))}
                    {(project.members?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full bg-surface-container-high text-primary-container text-[10px] font-bold flex items-center justify-center ring-2 ring-surface-container-lowest">
                        +{(project.members?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Team Collaborators (Admin) */}
      {isAdmin && (
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="groups" className="text-[20px] text-primary-container" />
              <h2 className="font-headline text-base font-bold text-primary-container">
                Statut Collaborateurs ({employees.length})
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              {employees.length} {employees.length > 1 ? 'collaborateurs' : 'collaborateur'}
            </span>
          </div>

          {employees.length === 0 ? (
            <div className="p-4 text-center text-xs text-secondary bg-surface-container-low rounded-xl">
              Aucun collaborateur inscrit dans l'annuaire Supabase.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {employees.slice(0, 8).map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-col items-center text-center p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src={
                        emp.avatar_url ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(emp.full_name)}`
                      }
                      alt={emp.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                  </div>
                  <span className="text-[11px] font-semibold text-primary-container mt-1 truncate w-full">
                    {emp.full_name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-secondary truncate w-full">
                    {(emp.job_title || 'Collaborateur').split('&')[0].trim()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-primary-container">
            Flux d'Activité Récente
          </h2>
          <button
            className="text-[11px] font-semibold text-secondary flex items-center gap-1 hover:text-primary-container transition-colors disabled:opacity-50"
            disabled={refreshing}
            onClick={() => loadData(true)}
          >
            <Icon name="sync" className={`text-[16px] ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm">
          {activities.length === 0 ? (
            <div className="p-4 text-center text-xs text-secondary">
              Aucune activité récente enregistrée dans le système.
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-container">
              {activities.map((act, idx) => {
                const dotColor =
                  act.action_type === 'SUBMIT_WORK'
                    ? 'bg-on-tertiary-container shadow-[0_0_0_4px_rgba(234,104,3,0.15)]'
                    : act.action_type === 'UPLOAD_FILE'
                    ? 'bg-primary-container shadow-[0_0_0_4px_rgba(15,41,66,0.1)]'
                    : 'bg-emerald-600 shadow-[0_0_0_4px_rgba(5,150,105,0.15)]';

                return (
                  <div key={act.id || idx} className="relative">
                    <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ${dotColor}`} />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm text-primary-container">
                        {act.user && (
                          <strong className="font-semibold text-on-surface">
                            {act.user.full_name}
                          </strong>
                        )}{' '}
                        {act.description}
                      </p>
                      <span className="font-mono text-xs text-secondary">
                        {formatRelativeTime(act.created_at)}
                        {act.target_name && ` • ${act.target_name}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals pour Administrateur */}
      {isAdmin && (
        <>
          <ProjectFormModal
            isOpen={isCreateProjectModalOpen}
            onClose={() => setIsCreateProjectModalOpen(false)}
            onSuccess={handleProjectCreated}
            currentUserId={user?.id || ''}
          />
          <AssignTaskModal
            isOpen={isAssignTaskModalOpen}
            onClose={() => setIsAssignTaskModalOpen(false)}
            onSuccess={handleTaskAssigned}
            currentUserId={user?.id || ''}
          />
        </>
      )}
    </div>
  );
};

export default DashboardPage;
