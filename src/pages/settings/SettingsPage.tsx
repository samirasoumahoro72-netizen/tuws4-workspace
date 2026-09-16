import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { BrandName } from '../../components/ui/Logo';

export const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationsSlack, setNotificationsSlack] = useState(false);
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleSave = () => {
    showToast('Paramètres mis à jour avec succès', 'check_circle', 'success');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
          Paramètres du Workspace
        </h1>
        <p className="text-sm text-secondary mt-0.5">
          Gérez vos préférences de compte, alertes et intégrations agence.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Workspace Identity & Environment */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs">
          <h2 className="text-base font-bold text-primary-container flex items-center gap-2 mb-4">
            <Icon name="corporate_fare" className="text-brand-orange" />
            Environnement TUWSHIUAH
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-xs text-secondary font-medium">Agence</span>
              <div className="mt-0.5">
                <BrandName className="text-sm" />
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-xs text-secondary font-medium">Instance Active</span>
              <p className="text-sm font-bold text-primary-container">Espace Collaboratif Local / Hybride Supabase</p>
            </div>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-4">
          <h2 className="text-base font-bold text-primary-container flex items-center gap-2">
            <Icon name="notifications" className="text-brand-orange" />
            Préférences de Notifications
          </h2>

          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface">Notifications par email</span>
              <span className="text-xs text-secondary">Recevoir les alertes de validation de livrables et messages urgents</span>
            </div>
            <input
              type="checkbox"
              checked={notificationsEmail}
              onChange={(e) => setNotificationsEmail(e.target.checked)}
              className="w-5 h-5 rounded text-brand-orange accent-brand-orange cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface">Pont Slack & Webhook Interne</span>
              <span className="text-xs text-secondary">Diffuser les validations dans le canal #agence-general</span>
            </div>
            <input
              type="checkbox"
              checked={notificationsSlack}
              onChange={(e) => setNotificationsSlack(e.target.checked)}
              className="w-5 h-5 rounded text-brand-orange accent-brand-orange cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface">Sauvegarde automatique des brouillons</span>
              <span className="text-xs text-secondary">Enregistrer automatiquement les retours et dépôts en cours</span>
            </div>
            <input
              type="checkbox"
              checked={autoSaveDrafts}
              onChange={(e) => setAutoSaveDrafts(e.target.checked)}
              className="w-5 h-5 rounded text-brand-orange accent-brand-orange cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface">Mode sombre expérimental (Dark Theme)</span>
              <span className="text-xs text-secondary">Activer la palette nocturne haute densité</span>
            </div>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="w-5 h-5 rounded text-brand-orange accent-brand-orange cursor-pointer"
            />
          </label>
        </div>

        {/* Security & Access */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-4">
          <h2 className="text-base font-bold text-primary-container flex items-center gap-2">
            <Icon name="security" className="text-brand-orange" />
            Sécurité & Accès
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-on-surface">
                Rôle Actuel : {isAdmin ? 'Direction (Admin)' : 'Collaborateur'}
              </span>
              <p className="text-xs text-secondary">
                {isAdmin
                  ? 'Accès illimité : Validation finale, gestion de projets et contrôle complet.'
                  : 'Accès collaborateur : Dépôt de livrables, consultation et échanges de fichiers.'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-container text-on-primary">
              {isAdmin ? 'Super Admin' : 'Membre'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="primary" icon="save" onClick={handleSave}>
            Enregistrer les préférences
          </Button>
        </div>
      </div>
    </div>
  );
};
