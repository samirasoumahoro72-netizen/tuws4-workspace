import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../../types/database';
import { StatusBadge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { CircularProgress } from '../ui/CircularProgress';
import { formatDate } from '../../lib/utils';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const navigate = useNavigate();

  const isDelayed = project.status === 'DELAYED';
  const isCompleted = project.status === 'COMPLETED';

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between gap-4"
    >
      {/* Top row: Category, Title & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0 group-hover:scale-105 transition-transform">
            <Icon
              name={
                (project.category || '').includes('NLP')
                  ? 'neurology'
                  : (project.category || '').includes('Vision')
                  ? 'smart_toy'
                  : (project.category || '').includes('Cloud') || (project.category || '').includes('DevOps')
                  ? 'shield'
                  : (project.category || '').includes('Design')
                  ? 'palette'
                  : 'rocket_launch'
              }
              className="text-[24px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-headline text-base font-bold text-primary-container truncate group-hover:text-on-tertiary-container transition-colors">
              {project.name || project.title}
            </h3>
            <span className="text-xs text-secondary truncate">{project.category || 'Workspace'}</span>
          </div>
        </div>

        <StatusBadge status={project.status} />
      </div>

      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
        {project.description}
      </p>

      {/* Circular Progress Gauge */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/70 border border-surface-container/60">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider">
            Progression
          </span>
          <span className="text-xs font-semibold text-primary-container mt-0.5">
            {isCompleted
              ? 'Projet achevé'
              : isDelayed
              ? 'Attention au retard'
              : project.progress >= 75
              ? 'Finalisation en cours'
              : project.progress >= 30
              ? 'Développement actif'
              : 'Initialisation'}
          </span>
        </div>
        <CircularProgress
          value={project.progress}
          size={48}
          strokeWidth={4.5}
          status={project.status}
        />
      </div>

      {/* Footer: Team Avatars & Deadline */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-container/60 text-xs">
        {/* Avatars */}
        <div className="flex items-center -space-x-2 shrink-0">
          {project.members?.slice(0, 3).map((m, idx) => (
            <img
              key={idx}
              src={m.avatar_url}
              alt={m.full_name}
              title={m.full_name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-surface-container-lowest shadow-xs"
            />
          ))}
          {(project.members?.length || 0) > 3 && (
            <div className="w-7 h-7 rounded-full bg-surface-container-high text-primary-container text-[10px] font-bold flex items-center justify-center ring-2 ring-surface-container-lowest">
              +{(project.members?.length || 0) - 3}
            </div>
          )}
        </div>

        {/* Deadline */}
        <div
          className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded-md ${
            isDelayed
              ? 'text-error bg-error-container/40'
              : 'text-secondary bg-surface-container'
          }`}
        >
          <Icon name="event" className="text-[14px]" />
          <span>{project.due_date || project.deadline ? formatDate(project.due_date || project.deadline) : 'Non définie'}</span>
        </div>
      </div>
    </div>
  );
};
