import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import {
  DbProjectStatus,
  Profile,
  Project,
  ProjectPriority,
} from '../../types/database';
import {
  projectService,
  PROJECT_STATUS_LABELS,
  PROJECT_PRIORITY_LABELS,
  toDbProjectStatus,
} from '../../services/projectService';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  projectToEdit?: Project | null;
  currentUserId: string;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectToEdit,
  currentUserId,
}) => {
  const isEditing = Boolean(projectToEdit);

  // États du formulaire
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DbProjectStatus>('in_progress');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [progress, setProgress] = useState<number>(0);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Liste des employés disponibles pour assignation
  const [availableEmployees, setAvailableEmployees] = useState<Profile[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les collaborateurs disponibles
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const emps = await projectService.getAvailableEmployees();
        if (mounted) {
          setAvailableEmployees(emps);
        }
      } catch (err) {
        console.warn('[ProjectFormModal] Erreur chargement collaborateurs :', err);
      } finally {
        if (mounted) setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Initialisation des données lors de l'ouverture (création vs édition)
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);

    if (projectToEdit) {
      setName(projectToEdit.name || projectToEdit.title || '');
      setDescription(projectToEdit.description || '');
      setStatus(toDbProjectStatus(projectToEdit.status));
      setPriority(projectToEdit.priority || 'medium');
      setStartDate(
        projectToEdit.start_date
          ? projectToEdit.start_date.split('T')[0]
          : ''
      );
      setDueDate(
        projectToEdit.due_date || projectToEdit.deadline
          ? (projectToEdit.due_date || projectToEdit.deadline).split('T')[0]
          : ''
      );
      setProgress(Number(projectToEdit.progress) || 0);
      setSelectedMemberIds((projectToEdit.members || []).map((m) => m.id));
    } else {
      // Valeurs par défaut pour un nouveau projet
      setName('');
      setDescription('');
      setStatus('in_progress');
      setPriority('medium');
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split('T')[0];
      setStartDate(today);
      setDueDate(thirtyDaysLater);
      setProgress(0);
      setSelectedMemberIds([]);
    }
  }, [isOpen, projectToEdit]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Le nom du projet est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && projectToEdit) {
        const result = await projectService.updateProject(
          projectToEdit.id,
          {
            name: name.trim(),
            description: description.trim(),
            status,
            priority,
            start_date: startDate ? new Date(startDate).toISOString() : null,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            progress,
          },
          selectedMemberIds,
          currentUserId
        );

        if (result.error || !result.data) {
          setErrorMessage(result.error || 'Erreur lors de la mise à jour du projet.');
          setIsSubmitting(false);
          return;
        }

        onSuccess(result.data);
      } else {
        const result = await projectService.createProject(
          {
            name: name.trim(),
            description: description.trim(),
            status,
            priority,
            start_date: startDate ? new Date(startDate).toISOString() : null,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            progress,
          },
          selectedMemberIds,
          currentUserId
        );

        if (result.error || !result.data) {
          setErrorMessage(result.error || 'Erreur lors de la création du projet.');
          setIsSubmitting(false);
          return;
        }

        onSuccess(result.data);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le projet' : 'Nouveau Projet'}
      subtitle={
        isEditing
          ? 'Mettre à jour les informations et l’équipe du projet'
          : 'Créer un nouveau projet et assigner des collaborateurs'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-error-container/40 border border-error/30 text-error flex items-start gap-2.5 text-xs">
            <Icon name="error" className="text-[18px] shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Nom du projet */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-primary-container">
            Nom du projet <span className="text-on-tertiary-container">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Ex : Refonte Plateforme IA & Vision"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-secondary px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-primary-container">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Objectifs, contexte, périmètre et livrables attendus..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-secondary px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors resize-none"
          />
        </div>

        {/* Statut & Priorité */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-primary-container">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DbProjectStatus)}
              className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors cursor-pointer"
            >
              {(Object.keys(PROJECT_STATUS_LABELS) as DbProjectStatus[]).map((key) => (
                <option key={key} value={key}>
                  {PROJECT_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-primary-container">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority)}
              className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2.5 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors cursor-pointer"
            >
              {(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((key) => (
                <option key={key} value={key}>
                  {PROJECT_PRIORITY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates début et échéance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-primary-container">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-primary-container">
              Date d'échéance
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface px-3.5 py-2 rounded-xl text-sm border border-surface-container outline-none focus:border-brand-orange/60 transition-colors"
            />
          </div>
        </div>

        {/* Progression */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low/70 border border-surface-container/60">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-primary-container">
              Progression ({progress}%)
            </label>
            <span className="text-xs font-semibold text-secondary">
              {progress === 100
                ? 'Terminé'
                : progress >= 50
                ? 'Avancé'
                : progress > 0
                ? 'En cours'
                : 'Initialisation'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-on-tertiary-container cursor-pointer"
          />
        </div>

        {/* Collaborateurs assignés */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
              <Icon name="groups" className="text-[16px] text-secondary" />
              Collaborateurs assignés ({selectedMemberIds.length})
            </label>
            <span className="text-[11px] text-secondary">
              Employés uniquement
            </span>
          </div>

          {isLoadingEmployees ? (
            <div className="py-4 text-center text-xs text-secondary flex items-center justify-center gap-2">
              <Icon name="spinner" spin className="text-[16px]" />
              Chargement des collaborateurs...
            </div>
          ) : availableEmployees.length === 0 ? (
            <div className="py-3 px-3 rounded-xl bg-surface-container-low text-xs text-secondary text-center">
              Aucun collaborateur avec le rôle employé enregistré dans le système.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-surface-container rounded-xl divide-y divide-surface-container bg-surface-container-lowest">
              {availableEmployees.map((emp) => {
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleMember(emp.id)}
                    className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-container/5 hover:bg-primary-container/10'
                        : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={emp.avatar_url}
                        alt={emp.full_name}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-primary-container truncate">
                          {emp.full_name}
                        </span>
                        <span className="text-[10px] text-secondary truncate">
                          {emp.email}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-on-tertiary-container border-on-tertiary-container text-on-primary'
                          : 'border-outline-variant bg-transparent'
                      }`}
                    >
                      {isSelected && <Icon name="check" className="text-[14px]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            variant="orange"
            size="md"
            icon={isEditing ? 'check' : 'add'}
            isLoading={isSubmitting}
          >
            {isEditing ? 'Enregistrer les modifications' : 'Créer le projet'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
