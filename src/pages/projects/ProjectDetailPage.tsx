import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockSubmissions, mockFiles } from '../../services/mockData';
import { projectService } from '../../services/projectService';
import { Project } from '../../types/database';
import { StatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { ProjectFormModal } from '../../components/projects/ProjectFormModal';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProject = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await projectService.getProjectById(id);
      setProject(data);
    } catch (err) {
      console.warn('[ProjectDetailPage] Erreur récupération projet :', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();

    const unsubscribe = projectService.subscribeToProjects(() => {
      loadProject();
    });

    return () => {
      unsubscribe();
    };
  }, [loadProject]);

  const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
    showToast('Projet mis à jour avec succès !', 'success');
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const confirmDelete = window.confirm(
      `Êtes-vous certain de vouloir supprimer le projet "${project.name || project.title}" ?`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const result = await projectService.deleteProject(project.id, user?.id);
      if (result.success) {
        showToast('Projet supprimé avec succès.', 'success');
        navigate('/projects');
      } else {
        showToast(result.error || 'Impossible de supprimer ce projet.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur inattendue lors de la suppression.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="w-48 h-6 bg-surface-container rounded-lg" />
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="w-64 h-7 bg-surface-container rounded-lg" />
            <div className="w-24 h-6 bg-surface-container rounded-full" />
          </div>
          <div className="w-full h-16 bg-surface-container/60 rounded-xl" />
          <div className="flex gap-4">
            <div className="w-32 h-4 bg-surface-container rounded" />
            <div className="w-32 h-4 bg-surface-container rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-surface-container-lowest border border-surface-container rounded-2xl p-8">
        <Icon name="folder_off" className="text-5xl text-secondary" />
        <div className="flex flex-col items-center text-center gap-1">
          <h2 className="font-headline text-lg font-bold text-primary-container">
            Projet introuvable
          </h2>
          <p className="text-sm text-secondary">
            Le projet demandé n'existe pas ou vous n'avez pas les autorisations nécessaires pour y accéder.
          </p>
        </div>
        <Link to="/projects" className="text-brand-orange text-sm font-semibold hover:underline mt-2">
          ← Retour à la liste des projets
        </Link>
      </div>
    );
  }

  // Pour les modules non connectés à cette étape (Fichiers, Livrables), on s'appuie sur la structure existante
  const projectSubmissions = mockSubmissions.filter((s) => s.project_id === project.id);
  const projectFiles = mockFiles.filter((f) => f.project_id === project.id);
  const isDelayed = project.status === 'DELAYED';

  return (
    <div className="flex flex-col gap-5">
      {/* Fil d'Ariane & Actions Administrateur */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Breadcrumb
          items={[
            { label: 'Projets', to: '/projects', icon: 'folder_open' },
            { label: project.name || project.title, icon: 'rocket_launch' },
          ]}
        />

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon="edit"
              onClick={() => setIsEditModalOpen(true)}
            >
              Modifier
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon="delete"
              isLoading={isDeleting}
              onClick={handleDeleteProject}
            >
              Supprimer
            </Button>
          </div>
        )}
      </div>

      {/* Project Hero Header */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-surface-container-highest/30 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex flex-col min-w-0 gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline text-xl font-bold text-primary-container truncate">
                {project.name || project.title}
              </h1>
              <StatusBadge status={project.status} />
              {project.priority && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-secondary uppercase tracking-wider">
                  Priorité {project.priority}
                </span>
              )}
            </div>
            <p className="text-xs text-secondary">{project.category}</p>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
              {project.description || 'Aucune description détaillée renseignée.'}
            </p>
          </div>
        </div>

        {/* Circular Progress Gauge */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low/70 border border-surface-container/60 relative z-10">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              Progression globale du projet
            </span>
            <span className="text-sm font-bold text-primary-container mt-0.5">
              {project.status === 'COMPLETED'
                ? 'Livrables validés et projet achevé'
                : isDelayed
                ? 'Alerte retard sur le planning initial'
                : project.progress >= 75
                ? 'Phase de recettes & validations finales'
                : 'Développement & intégration en cours'}
            </span>
          </div>
          <CircularProgress
            value={project.progress}
            size={56}
            strokeWidth={5}
            status={project.status}
          />
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 pt-2 relative z-10">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDelayed ? 'text-error' : 'text-secondary'}`}>
            <Icon name={isDelayed ? 'warning' : 'event'} className="text-[16px]" />
            <span>
              Échéance : {project.due_date || project.deadline ? formatDate(project.due_date || project.deadline) : 'Non définie'}
            </span>
          </div>
          {project.start_date && (
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <Icon name="calendar_today" className="text-[16px]" />
              <span>Début : {formatDate(project.start_date)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-secondary">
            <Icon name="description" className="text-[16px]" />
            <span>{project.files_count ?? projectFiles.length} fichiers</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-secondary">
            <Icon name="rule_folder" className="text-[16px]" />
            <span>{project.submissions_count ?? projectSubmissions.length} livrables</span>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-primary-container flex items-center gap-2">
            <Icon name="groups" className="text-[20px]" />
            Membres du projet ({project.members?.length || 0})
          </h2>
          {isAdmin && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-semibold text-on-tertiary-container hover:underline flex items-center gap-1"
            >
              <Icon name="person_add" className="text-[16px]" />
              Gérer l'équipe
            </button>
          )}
        </div>

        {project.members && project.members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {project.members.map((m) => {
              const isSelf = m.id === user?.id;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img src={m.avatar_url} alt={m.full_name} className="w-9 h-9 rounded-full object-cover" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-low" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-primary-container truncate">{m.full_name}</span>
                      <span className="text-[10px] text-secondary truncate">
                        {m.role === 'admin' ? 'Administrateur' : 'Collaborateur'}
                      </span>
                    </div>
                  </div>
                  {!isSelf && (
                    <Link
                      to={`/messages?contact=${m.id}`}
                      className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-white transition-colors shrink-0 shadow-2xs"
                      title={`Contacter ${m.full_name}`}
                    >
                      <Icon name="chat_bubble" className="text-[14px]" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-container-low text-xs text-secondary text-center">
            Aucun collaborateur n'est encore assigné à ce projet.
          </div>
        )}
      </div>

      {/* Quick Actions (modules conservés sans modification de logique pour cette étape) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/files" className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-surface-container p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm font-semibold text-primary-container">
          <Icon name="cloud" className="text-[20px] text-secondary" />
          Fichiers
        </Link>
        <Link to={`/messages?project=${project.id}`} className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-surface-container p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm font-semibold text-primary-container">
          <Icon name="chat_bubble" className="text-[20px] text-secondary" />
          Discussions
        </Link>
        <Link to="/submissions" className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-surface-container p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm font-semibold text-primary-container">
          <Icon name="rule_folder" className="text-[20px] text-secondary" />
          Livrables
        </Link>
        <Link to="/activity" className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-surface-container p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm font-semibold text-primary-container">
          <Icon name="history" className="text-[20px] text-secondary" />
          Activité
        </Link>
      </div>

      {/* Files Preview (Structure conservée intacte pour l'étape ultérieure) */}
      {projectFiles.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-bold text-primary-container">Fichiers récents</h2>
            <Link to="/files" className="text-[11px] font-bold text-on-tertiary-container hover:underline flex items-center gap-0.5">
              Tous les fichiers <Icon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {projectFiles.slice(0, 3).map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon name={file.file_type === 'pdf' ? 'description' : file.file_type === 'binary' ? 'memory' : 'draft'} className="text-[20px] text-primary-container shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-on-surface truncate">{file.name}</span>
                    <span className="text-[10px] text-secondary">{file.size_formatted} • {file.uploader?.full_name || 'Collaborateur'}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon="download">
                  <span className="sr-only">Télécharger</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal d'édition de projet (Admin) */}
      {isAdmin && (
        <ProjectFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleProjectUpdated}
          projectToEdit={project}
          currentUserId={user?.id || ''}
        />
      )}
    </div>
  );
};
