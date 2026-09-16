import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from '../components/layout/Topbar';
import { Sidebar } from '../components/layout/Sidebar';
import { BottomNav } from '../components/layout/BottomNav';

export const MainLayout: React.FC = () => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/projects/')) return 'Détails Projet';
    if (path.startsWith('/projects')) return 'Catalogue Projets';
    if (path.startsWith('/submissions')) return 'Validation des Livrables';
    if (path.startsWith('/files')) return 'Explorateur Fichiers';
    if (path.startsWith('/messages')) return 'Discussions Collaboratives';
    if (path.startsWith('/team')) return 'Équipe Agence';
    if (path.startsWith('/activity')) return 'Flux d’Activité';
    if (path.startsWith('/settings')) return 'Paramètres';
    if (path.startsWith('/profile')) return 'Mon Profil';
    return 'Tableau de bord';
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Topbar pageTitle={getPageTitle()} />

      <div className="flex flex-1 pt-16">
        <Sidebar />

        <main className="flex-1 lg:ml-64 w-full min-h-[calc(100vh-4rem)] pb-24 lg:pb-12 px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
};
