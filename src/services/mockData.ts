import { Activity, FileItem, Folder, Message, Notification, Profile, Project, Submission } from '../types/database';

export const mockProfiles: Profile[] = [
  {
    id: 'user-admin',
    user_id: 'auth-user-admin',
    full_name: 'Alexandre Roy',
    email: 'direction@tuwshiuah.com',
    role: 'admin',
    gender: 'male',
    job_title: 'Directeur Général & Fondateur',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnB8-LrzApQulqNkPJbPdGprKfPsV6m6e_qy5NnWlvXmetrpKzZfK_0XcEXlb9H_hJRcf6Uh_QLQDhX26YKcGxMnpdhkUbmln8uliAQkRb6itVjrnyOxX5iAsh2dO31ZdQeeHQbGF8AwNcSEHiZSLfhRqjvfATw0LwX8jbI8JLqYRkb0LVdVA8A8RHx6b5a9juSNpGWhU68laTs8dKx492aA_k0OVTtQOUX_RBoGXIJP9mnV5GqAZngg',
    is_online: true,
    phone: '+33 6 12 34 56 78',
    created_at: '2026-01-01T08:00:00Z',
  },
];

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    title: 'Plateforme NLP Client Alpha',
    description: 'Traitement sémantique automatisé, extraction d’entités nommées et résumés de contrats légaux haute précision.',
    category: 'Traitement du Langage (NLP)',
    status: 'IN_PROGRESS',
    progress: 75,
    deadline: '2026-11-18T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-09-01T10:00:00Z',
    files_count: 24,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
  {
    id: 'proj-2',
    title: 'Infrastructure Cloud Sécurisée',
    description: 'Déploiement cluster Kubernetes hybride avec chiffrement de bout en bout et conformité RGPD/HDS.',
    category: 'DevOps & Sécurité Cloud',
    status: 'DELAYED',
    progress: 40,
    deadline: '2026-11-12T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-09-10T11:00:00Z',
    files_count: 18,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
  {
    id: 'proj-3',
    title: 'API Gateway Microservices',
    description: 'Orchestration des flux de données internes, routage intelligent et passerelle de haute disponibilité.',
    category: 'Architecture Backend',
    status: 'IN_PROGRESS',
    progress: 90,
    deadline: '2026-11-25T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-09-15T09:30:00Z',
    files_count: 32,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
  {
    id: 'proj-4',
    title: 'Modèle IA Vision - Détection',
    description: 'Réseau de neurones convolutionnel et modèle YOLO fine-tuné pour la détection d’objets en temps réel.',
    category: 'Vision par Ordinateur',
    status: 'IN_PROGRESS',
    progress: 60,
    deadline: '2026-12-05T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-09-20T14:00:00Z',
    files_count: 45,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
  {
    id: 'proj-5',
    title: 'Design System & UI Workspace',
    description: 'Conception de la charte visuelle, des tokens CSS et des composants d’interface pour TUWSHIUAH.',
    category: 'Design & UI/UX',
    status: 'COMPLETED',
    progress: 100,
    deadline: '2026-10-30T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-08-01T08:00:00Z',
    files_count: 15,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
  {
    id: 'proj-6',
    title: 'Migration SI Interne & RAG',
    description: 'Mise en place d’un assistant interne connecté aux bases documentaires de l’agence via Vector Database.',
    category: 'Intelligence Artificielle',
    status: 'TODO',
    progress: 10,
    deadline: '2026-12-20T18:00:00Z',
    created_by: 'user-admin',
    created_at: '2026-10-01T15:00:00Z',
    files_count: 8,
    submissions_count: 0,
    members: [mockProfiles[0]],
  },
];

export const mockFolders: Folder[] = [
  {
    id: 'fld-1',
    project_id: 'proj-1',
    name: '01_Spécifications & Architecture',
    created_by: 'user-admin',
    created_at: '2026-09-02T10:00:00Z',
    files_count: 14,
    total_size: '45 Mo',
  },
  {
    id: 'fld-2',
    project_id: 'proj-1',
    name: '02_Datasets & Annotations',
    created_by: 'user-admin',
    created_at: '2026-09-05T11:00:00Z',
    files_count: 8,
    total_size: '1.2 Go',
  },
  {
    id: 'fld-3',
    project_id: 'proj-1',
    name: '03_Modèles & Poids (Weights)',
    created_by: 'user-admin',
    created_at: '2026-09-12T14:30:00Z',
    files_count: 5,
    total_size: '650 Mo',
  },
  {
    id: 'fld-4',
    project_id: 'proj-1',
    name: '04_Livrables & Rapports Direction',
    created_by: 'user-admin',
    created_at: '2026-09-20T16:00:00Z',
    files_count: 6,
    total_size: '28 Mo',
  },
];

export const mockFiles: FileItem[] = [];

export const mockSubmissions: Submission[] = [];

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    project_id: 'proj-1',
    sender_id: 'user-admin',
    sender: mockProfiles[0],
    content: 'Bienvenue sur TUWSHIUAH Workspace. Espace de travail opérationnel.',
    created_at: '2026-09-09T08:00:00Z',
  },
];

export const mockNotifications: Notification[] = [];

export const mockActivities: Activity[] = [
  {
    id: 'act-1',
    project_id: 'proj-6',
    project_title: 'Workspace TUWSHIUAH',
    user_id: 'user-admin',
    user: mockProfiles[0],
    action_type: 'CREATE_PROJECT',
    description: 'Initialisation de l’espace Direction',
    target_name: 'Direction Générale',
    created_at: '2026-09-09T06:00:00Z',
  },
];
