import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { projectService } from '../../services/projectService';
import { notificationsService } from '../../services/notificationsService';
import { activitiesService } from '../../services/activitiesService';
import { Project, Profile } from '../../types/database';

interface AssignTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskInfo: { title: string; projectName: string; employeeName: string }) => void;
  currentUserId: string;
}

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserId,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [projs, emps] = await Promise.all([
          projectService.getProjects(currentUserId, true),
          projectService.getAvailableEmployees(),
        ]);

        if (mounted) {
          setProjects(projs);
          setEmployees(emps);

          if (projs.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projs[0].id);
          }
          if (emps.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(emps[0].id);
          }

          // Date par défaut : dans 7 jours
          const defaultDue = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
          setDueDate(defaultDue);
        }
      } catch (err) {
        console.warn('[AssignTaskModal] Erreur chargement :', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [isOpen, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskTitle.trim()) {
      setErrorMessage('Veuillez préciser le titre de la tâche.');
      return;
    }
    if (!selectedProjectId) {
      setErrorMessage('Veuillez sélectionner un projet.');
      return;
    }
    if (!selectedEmployeeId) {
      setErrorMessage('Veuillez assigner au moins un collaborateur.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId);
      const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
      const projectName = selectedProject?.name || selectedProject?.title || 'Projet';
      const employeeName = selectedEmployee?.full_name || 'Collaborateur';

      // 1. Assurer l'affectation du collaborateur au projet
      await projectService.addProjectMember(selectedProjectId, selectedEmployeeId, currentUserId);

      // 2. Notification ciblée
      await notificationsService.addNotification({
        user_id: selectedEmployeeId,
        sender_id: currentUserId,
        title: 'Nouvelle tâche assignée',
        message: `Tâche sur « ${projectName} » : ${taskTitle.trim()}${
          dueDate ? ` (Échéance : ${dueDate})` : ''
        }`,
        type: 'PROJECT',
        link: `/projects/${selectedProjectId}`,
      });

      // 3. Enregistrement dans le journal d'activité
      await activitiesService.logActivity({
        actorId: currentUserId,
        projectId: selectedProjectId,
        action: 'assign_member',
        entityType: 'task',
        entityId: selectedProjectId,
        metadata: {
          target_name: employeeName,
          project_name: projectName,
          task_title: taskTitle.trim(),
          priority,
          due_date: dueDate || null,
          description: `a assigné la tâche « ${taskTitle.trim()} » à ${employeeName} sur le projet « ${projectName} »`,
        },
      });

      // Reset form
      setTaskTitle('');
      setTaskDescription('');
      onSuccess({
        title: taskTitle.trim(),
        projectName,
        employeeName,
      });
      onClose();
    } catch (err: any) {
      console.error('[AssignTaskModal] Erreur attribution tâche :', err);
      setErrorMessage(err.message || "Erreur lors de l'attribution de la tâche.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attribuer une tâche"
      subtitle="Affecter une mission opérationnelle à un membre de l'équipe"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[18px] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Icon name="spinner" spin className="text-2xl text-brand-orange" />
            <span className="text-xs text-secondary">Chargement des données...</span>
          </div>
        ) : (
          <>
            {/* Sélection du projet */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
                <Icon name="folder_open" className="text-sm text-secondary" />
                Projet rattaché <span className="text-on-tertiary-container">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors cursor-pointer"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.title} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Titre de la tâche */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
                <Icon name="task_alt" className="text-sm text-secondary" />
                Intitulé de la tâche <span className="text-on-tertiary-container">*</span>
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Ex : Intégration du module de paiement, Tests unitaires API..."
                className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
                required
              />
            </div>

            {/* Sélection du collaborateur */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
                <Icon name="person" className="text-sm text-secondary" />
                Collaborateur assigné <span className="text-on-tertiary-container">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {employees.map((emp) => {
                  const isSelected = selectedEmployeeId === emp.id;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-orange bg-brand-orange/5 shadow-xs'
                          : 'border-surface-container bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <img
                        src={emp.avatar_url}
                        alt={emp.full_name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold text-primary-container truncate">
                          {emp.full_name}
                        </span>
                        <span className="text-[10px] text-secondary truncate">
                          {emp.job_title || 'Collaborateur'}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-brand-orange bg-brand-orange text-white'
                            : 'border-outline-variant'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consignes / Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
                <Icon name="notes" className="text-sm text-secondary" />
                Consignes / Détails opérationnels
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Spécifications, livrables attendus, critères de validation..."
                rows={3}
                className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors resize-none"
              />
            </div>

            {/* Priorité & Échéance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary-container">Priorité</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-surface-container-lowest text-on-surface px-3 py-2 rounded-xl text-xs border border-surface-container outline-none focus:border-brand-orange/60 transition-colors cursor-pointer"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary-container">
                  Date d'échéance
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface px-3 py-2 rounded-xl text-xs border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container mt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon="person_add"
                isLoading={isSubmitting}
              >
                Attribuer la tâche
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
