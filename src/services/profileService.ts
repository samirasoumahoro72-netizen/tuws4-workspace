import { supabase, createTransientClient, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types/database';
import { mockProfiles } from './mockData';

const TEAM_PROFILES_KEY = 'tuws_team_profiles_v1';

const getLocalProfiles = (): Profile[] => {
  const raw = localStorage.getItem(TEAM_PROFILES_KEY);
  if (!raw) {
    localStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(mockProfiles));
    return [...mockProfiles];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [...mockProfiles];
  }
};

const saveLocalProfiles = (profiles: Profile[]) => {
  localStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(profiles));
};

export const profileService = {
  /**
   * Récupère la liste de tous les profils / collaborateurs
   */
  async getAllProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data) {
          const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';
          if (data.length > 0 || isExplicitProd) {
            const formatted = data.map((p) => ({
              ...p,
              role: (p.role?.toLowerCase() === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee',
            }));
            saveLocalProfiles(formatted);
            return formatted;
          }
        }
      } catch (err) {
        console.warn('[profileService] Erreur lors de la récupération des profils Supabase, utilisation du cache local :', err);
      }
    }

    return getLocalProfiles();
  },

  /**
   * Récupère le profil d'un utilisateur depuis Supabase 'profiles'
   */
  async getProfile(userId: string): Promise<Profile | null> {
    if (!userId) return null;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, email, role, avatar_url, job_title, phone, is_online, created_at')
          .or(`id.eq.${userId},user_id.eq.${userId}`)
          .maybeSingle();

        if (data && !error) {
          const isSamiraOrDir =
            data.email?.toLowerCase().includes('samira') ||
            data.email?.toLowerCase().includes('direction');
          return {
            ...data,
            role: isSamiraOrDir || data.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
          };
        }

        // Si la ligne n'existe pas encore dans public.profiles mais l'utilisateur est authentifié
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user && authData.user.id === userId) {
          const userEmail = authData.user.email || '';
          const isSamiraOrDir =
            userEmail.toLowerCase().includes('samira') ||
            userEmail.toLowerCase().includes('direction');
          const assignedRole: 'admin' | 'employee' = isSamiraOrDir ? 'admin' : 'employee';

          const newProfile: Profile = {
            id: userId,
            full_name: authData.user.user_metadata?.full_name || (isSamiraOrDir ? 'Samira Soumahoro' : userEmail.split('@')[0]),
            email: userEmail,
            role: assignedRole,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail)}`,
            job_title: assignedRole === 'admin' ? 'Direction Générale' : 'Collaborateur',
            is_online: true,
            created_at: new Date().toISOString(),
          };

          try {
            await supabase.from('profiles').upsert({
              id: userId,
              full_name: newProfile.full_name,
              email: newProfile.email,
              role: assignedRole,
              avatar_url: newProfile.avatar_url,
              job_title: newProfile.job_title,
            });
          } catch {
            // ignoré
          }

          return newProfile;
        }
      } catch (err) {
        console.warn('[profileService] Erreur lors de la récupération du profil Supabase :', err);
      }
    }

    // Repli local
    const local = getLocalProfiles();
    const found = local.find(
      (p) => p.id === userId || p.user_id === userId || p.email.toLowerCase() === userId.toLowerCase()
    );
    return found || local[0] || null;
  },

  /**
   * Mise à jour du profil personnel par l'utilisateur connecté (sans pouvoir altérer son rôle)
   */
  async updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'role'>>): Promise<Profile | null> {
    const sanitizedUpdates = { ...updates };
    delete (sanitizedUpdates as any).role;
    delete (sanitizedUpdates as any).id;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update(sanitizedUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (data && !error) {
          const updated: Profile = {
            ...data,
            role: (data.role?.toLowerCase() === 'admin' ? 'admin' : 'employee'),
          };
          const current = getLocalProfiles();
          const idx = current.findIndex((p) => p.id === userId);
          if (idx !== -1) {
            current[idx] = updated;
            saveLocalProfiles(current);
          }
          return updated;
        }
      } catch (err) {
        console.warn('[profileService] Erreur lors de la mise à jour Supabase :', err);
      }
    }

    const current = getLocalProfiles();
    const idx = current.findIndex((p) => p.id === userId);
    if (idx !== -1) {
      const updated = { ...current[idx], ...sanitizedUpdates };
      current[idx] = updated;
      saveLocalProfiles(current);
      return updated;
    }
    return null;
  },

  /**
   * [ADMIN] Ajout d'un nouveau collaborateur
   */
  /**
   * [ADMIN] Inscription et création complète d'un compte collaborateur
   * avec identifiants Supabase Auth (email + mot de passe) et informations personnelles.
   */
  async addMember(memberData: {
    full_name: string;
    email: string;
    password?: string;
    role: 'admin' | 'employee';
    gender?: 'male' | 'female';
    job_title: string;
    phone?: string;
    avatar_url?: string;
  }): Promise<Profile> {
    const isFemale = memberData.gender === 'female';
    const defaultAvatar = isFemale
      ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&auto=format&fit=crop&q=80';

    const selectedAvatar = memberData.avatar_url?.trim() || defaultAvatar;

    if (isSupabaseConfigured && memberData.password) {
      // 1. Inscription dans Supabase Auth via client isolé sans persistance de session
      // (Permet à l'administrateur de créer l'accès sans être déconnecté)
      const transientClient = createTransientClient();

      const { data: authData, error: authError } = await transientClient.auth.signUp({
        email: memberData.email.trim(),
        password: memberData.password,
        options: {
          data: {
            full_name: memberData.full_name.trim(),
            role: memberData.role,
            gender: memberData.gender || (isFemale ? 'female' : 'male'),
            job_title: memberData.job_title.trim(),
            phone: memberData.phone?.trim() || '',
            avatar_url: selectedAvatar,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
          throw new Error('Un collaborateur avec cette adresse e-mail existe déjà.');
        }
        if (authError.message.includes('Password should be at least')) {
          throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
        }
        throw new Error(authError.message || "Erreur lors de la création de l'accès collaborateur.");
      }

      if (authData.user) {
        const userId = authData.user.id;

        // 2. Mise à jour de la fiche profil avec toutes les informations personnelles
        const { data: updatedProfile, error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: memberData.full_name.trim(),
            role: memberData.role,
            job_title: memberData.job_title.trim(),
            phone: memberData.phone?.trim() || '+33 6 00 00 00 00',
            avatar_url: selectedAvatar,
            is_online: false,
          })
          .eq('id', userId)
          .select()
          .single();

        const finalProfile: Profile = updatedProfile && !profileError
          ? {
              ...updatedProfile,
              gender: memberData.gender,
              role: updatedProfile.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
            }
          : {
              id: userId,
              user_id: userId,
              full_name: memberData.full_name.trim(),
              email: memberData.email.trim(),
              role: memberData.role,
              gender: memberData.gender,
              job_title: memberData.job_title.trim(),
              phone: memberData.phone?.trim() || '+33 6 00 00 00 00',
              avatar_url: selectedAvatar,
              is_online: false,
              created_at: new Date().toISOString(),
            };

        const current = getLocalProfiles();
        current.push(finalProfile);
        saveLocalProfiles(current);
        return finalProfile;
      }
    }

    // Repli local
    const newId = `user-${Date.now()}`;
    const newProfile: Profile = {
      id: newId,
      user_id: `auth-${newId}`,
      full_name: memberData.full_name.trim(),
      email: memberData.email.trim(),
      role: memberData.role,
      gender: memberData.gender,
      job_title: memberData.job_title.trim(),
      phone: memberData.phone?.trim() || '+33 6 00 00 00 00',
      avatar_url: selectedAvatar,
      is_online: true,
      created_at: new Date().toISOString(),
    };

    const current = getLocalProfiles();
    current.push(newProfile);
    saveLocalProfiles(current);
    return newProfile;
  },

  /**
   * [ADMIN] Modification des informations d'un collaborateur
   */
  async updateMember(memberId: string, memberData: Partial<Profile>): Promise<Profile | null> {
    const sanitized: Partial<Profile> = { ...memberData };
    delete sanitized.id;

    // Éviter l'erreur Postgres si la colonne 'gender' n'existe pas encore dans la table distante
    const dbPayload = { ...sanitized };
    delete (dbPayload as any).gender;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update(dbPayload)
          .eq('id', memberId)
          .select()
          .single();

        if (data && !error) {
          const updated: Profile = {
            ...data,
            gender: memberData.gender,
            role: (data.role?.toLowerCase() === 'admin' ? 'admin' : 'employee'),
          };
          const current = getLocalProfiles();
          const idx = current.findIndex((p) => p.id === memberId);
          if (idx !== -1) {
            current[idx] = updated;
            saveLocalProfiles(current);
          }
          return updated;
        }
      } catch (err) {
        console.warn('[profileService] Erreur updateMember Supabase :', err);
      }
    }

    const current = getLocalProfiles();
    const idx = current.findIndex((p) => p.id === memberId);
    if (idx !== -1) {
      const updated = { ...current[idx], ...sanitized };
      current[idx] = updated;
      saveLocalProfiles(current);
      return updated;
    }
    return null;
  },

  /**
   * [ADMIN] Suppression d'un collaborateur
   */
  async deleteMember(memberId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', memberId);

        if (error) {
          console.warn('[profileService] Erreur deleteMember Supabase :', error);
        }
      } catch (err) {
        console.warn('[profileService] Erreur suppression Supabase :', err);
      }
    }

    const current = getLocalProfiles();
    const filtered = current.filter((p) => p.id !== memberId);
    saveLocalProfiles(filtered);
    return true;
  },
};
