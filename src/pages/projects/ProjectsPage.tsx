import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { ProjectCard } from '../../components/projects/ProjectCard';
import { ProjectFormModal } from '../../components/projects/ProjectFormModal';
import { projectService } from '../../services/projectService';
import { Project, ProjectStatus } from '../../types/database';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

type FilterType = 'all' | ProjectStatus;

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { showToast } = useToast();
  const { user, isAdmin } = useAuth();

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await projectService.getProjects(user?.id, isAdmin);
      setProjects(data);
    } catch (err) {
      console.warn('[ProjectsPage] Erreur lors du chargement des projets :', err);
      showToast('Impossible de récupérer la liste des projets.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAdmin, showToast]);

  useEffect(() => {
    loadProjects();

    const unsubscribe = projectService.subscribeToProjects(() => {
      loadProjects();
    });

    return () => {
      unsubscribe();
    };
  }, [loadProjects]);

  const handleProjectCreated = (newProj: Project) => {
    setProjects((prev) => [newProj, ...prev]);
    showToast(`Projet "${newProj.name || newProj.title}" créé avec succès !`, 'success');
  };

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: projects.length },
    {
      key: 'IN_PROGRESS',
      label: 'En cours',
      count: projects.filter((p) => p.status === 'IN_PROGRESS').length,
    },
    {
      key: 'TODO',
      label: 'À faire',
      count: projects.filter((p) => p.status === 'TODO').length,
    },
    {
      key: 'COMPLETED',
      label: 'Terminés',
      count: projects.filter((p) => p.status === 'COMPLETED').length,
    },
    {
      key: 'DELAYED',
      label: 'En retard',
      count: projects.filter((p) => p.status === 'DELAYED').length,
    },
  ];

  const filteredProjects = projects
    .filter((p) => activeFilter === 'all' || p.status === activeFilter)
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = (p.title || p.name || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const memberMatch = (p.members || []).some((m) =>
        (m.full_name || '').toLowerCase().includes(q)
      );
      return titleMatch || descMatch || memberMatch;
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <h1 className="font-headline text-2xl font-bold text-primary tracking-tight">
            Projets de l'Agence
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="text-xs font-semibold text-secondary">
              {projects.length} projet{projects.length > 1 ? 's' : ''} au total
            </span>
            <span className="text-secondary text-[11px]">•</span>
            <span className="text-[11px] font-bold text-on-tertiary-container">Workspace IA</span>
          </div>
        </div>

        {isAdmin && (
          <Button
            variant="orange"
            icon="add"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Nouveau
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-secondary">
          <Icon name="search" className="text-[20px]" />
        </div>
        <input
          className="w-full bg-surface-container-lowest text-on-surface placeholder:text-secondary pl-10 pr-12 py-3 h-11 rounded-xl text-sm shadow-sm border border-surface-container outline-none focus:border-brand-orange/50 focus:bg-white transition-all"
          placeholder="Rechercher un projet, un mot-clé, un membre..."
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary hover:text-primary-container transition-colors"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-4 px-4 no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95 ${
              activeFilter === f.key
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'bg-surface-container-high text-secondary hover:text-primary-container'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm flex flex-col gap-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-surface-container" />
                  <div className="flex flex-col gap-1.5">
                    <div className="w-32 h-4 bg-surface-container rounded" />
                    <div className="w-20 h-3 bg-surface-container rounded" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-surface-container rounded-full" />
              </div>
              <div className="w-full h-10 bg-surface-container/60 rounded-xl" />
              <div className="flex items-center justify-between pt-2 border-t border-surface-container/60">
                <div className="w-20 h-6 bg-surface-container rounded-full" />
                <div className="w-24 h-4 bg-surface-container rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        // Empty state global
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4 bg-surface-container-lowest border border-surface-container rounded-2xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Icon name="folder_off" className="text-3xl" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-headline text-base font-bold text-primary-container">
              {isAdmin ? 'Aucun projet pour le moment' : "Vous n'avez encore aucun projet assigné."}
            </h3>
            <p className="text-xs text-secondary max-w-sm">
              {isAdmin
                ? 'Créez votre premier projet d’agence et assignez vos collaborateurs pour démarrer.'
                : 'Dès que l’administrateur vous aura assigné à un projet, il apparaîtra directement ici.'}
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="orange"
              icon="add"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Créer un projet
            </Button>
          )}
        </div>
      ) : (
        // Empty state recherche / filtre
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Icon name="search_off" className="text-5xl text-secondary" />
          <p className="text-sm text-secondary">Aucun projet trouvé pour ce filtre.</p>
        </div>
      )}

      {/* Modal création projet (Admin) */}
      {isAdmin && (
        <ProjectFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleProjectCreated}
          currentUserId={user?.id || ''}
        />
      )}
    </div>
  );
};
