import { Project, ProjectStatus } from '../types/database';
import { mockProjects } from './mockData';

let projectsStore: Project[] = [...mockProjects];

export const projectsService = {
  async getAll(): Promise<Project[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...projectsStore]), 100);
    });
  },

  async getById(id: string): Promise<Project | null> {
    const project = projectsStore.find((p) => p.id === id) || null;
    return new Promise((resolve) => {
      setTimeout(() => resolve(project), 100);
    });
  },

  async create(projectData: Partial<Project>): Promise<Project> {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      title: projectData.title || 'Nouveau Projet',
      description: projectData.description || '',
      category: projectData.category || 'Intelligence Artificielle',
      status: projectData.status || 'IN_PROGRESS',
      progress: projectData.progress || 0,
      deadline: projectData.deadline || new Date(Date.now() + 30 * 86400000).toISOString(),
      created_by: projectData.created_by || 'user-admin',
      created_at: new Date().toISOString(),
      files_count: 0,
      submissions_count: 0,
      members: projectData.members || [],
    };
    projectsStore = [newProject, ...projectsStore];
    return newProject;
  },

  async updateStatus(id: string, status: ProjectStatus): Promise<Project | null> {
    const idx = projectsStore.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    projectsStore[idx] = { ...projectsStore[idx], status };
    return projectsStore[idx];
  },
};
