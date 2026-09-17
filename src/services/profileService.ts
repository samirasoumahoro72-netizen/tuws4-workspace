import { supabase, createTransientClient, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types/database';
import { mockProfiles } from './mockData';

const TEAM_PROFILES_KEY = 'tuws_team_profiles_v1';

export const PURGED_EMAILS = [
  'fatimbamba@gmail.com',
  'nouraadiatou@gmail.com',
  'lucas.m@tuwshiuah.com',
  'thomas.l@tuwshiuah.com',
  'sarah.b@tuwshiuah.com',
  'julie.v@tuwshiuah.com',
];

export const isTestOrDemoAccount = (p: Partial<Profile>): boolean => {
  const email = (p.email || '').trim().toLowerCase();
  const id = (p.id || '').trim();
  if (PURGED_EMAILS.some((pe) => email.includes(pe))) return true;
  if (/^user-(lucas|thomas|sarah|julie)/i.test(id)) return true;
  return false;
};

const getLocalProfiles = (): Profile[] => {
  const raw = localStorage.getItem(TEAM_PROFILES_KEY);
  if (!raw) {
    localStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(mockProfiles));
    return [...mockProfiles];
  }
  try {
    const list: Profile[] = JSON.parse(raw);
    const filtered = list.filter((p) => !isTestOrDemoAccount(p));
    if (filtered.length !== list.length) {
      localStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(filtered));
    }
    return filtered.length > 0 ? filtered : [...mockProfiles];
  } catch {
    return [...mockProfiles];
  }
};

const saveLocalProfiles = (profiles: Profile[]) => {
  const sanitized = profiles.filter((p) => !isTestOrDemoAccount(p));
  localStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(sanitized));
};

export const getBossProfile = (): Profile => {
  try {
    const rawBoss = localStorage.getItem('tuws_boss_profile');
    if (rawBoss) {
      const parsed = JSON.parse(rawBoss);
      if (parsed && !isTestOrDemoAccount(parsed) && (parsed.role === 'admin' || parsed.email?.includes('direction') || parsed.email?.includes('samira'))) {
        return {
          ...parsed,
          role: 'admin',
        };
      }
    }
    const rawSess = localStorage.getItem('tuwshiuah_workspace_session');
    if (rawSess) {
      const parsed = JSON.parse(rawSess);
      if (parsed && !isTestOrDemoAccount(parsed) && (parsed.role === 'admin' || parsed.email?.includes('direction') || parsed.email?.includes('samira'))) {
        return {
          ...parsed,
          role: 'admin',
        };
      }
    }
  } catch {}

  const local = getLocalProfiles();
  const foundAdmin = local.find(
    (p) => !isTestOrDemoAccount(p) && (p.role === 'admin' || p.email?.includes('direction') || p.email?.includes('samira'))
  );
  if (foundAdmin) {
    return { ...foundAdmin, role: 'admin' };
  }

  const mockAdmin = mockProfiles.find((p) => p.role === 'admin');
  return mockAdmin || mockProfiles[0];
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
            // Nettoyage et suppression automatique dans Supabase des comptes démo / tests créés
            const validRows = data.filter((p) => {
              if (isTestOrDemoAccount(p)) {
                // Tenter de purger de la base distante en tâche de fond
                (async () => {
                  try {
                    await supabase.rpc('delete_user_account', { target_user_id: p.id });
                    await supabase.from('profiles').delete().eq('id', p.id);
                  } catch {}
                })();
                return false;
              }
              return true;
            });

            let formatted: Profile[] = validRows.map((p) => {
              const isSamiraOrDir =
                p.email?.toLowerCase().includes('samira') ||
                p.email?.toLowerCase().includes('direction') ||
                (p.job_title?.toLowerCase().includes('direct') && !p.job_title?.toLowerCase().includes('sous')) ||
                p.role?.toLowerCase() === 'admin';
              return {
                ...p,
                role: (isSamiraOrDir ? 'admin' : 'employee') as 'admin' | 'employee',
              };
            });

            // Garantir que le profil du patron (Direction / Admin) est toujours présent
            const hasAdmin = formatted.some((p) => (p.role || '').toLowerCase() === 'admin');
            if (!hasAdmin) {
              const boss = getBossProfile();
              formatted = [boss, ...formatted];
            }

            // Toujours positionner le patron en tête de liste
            formatted.sort((a, b) => {
              const aIsAdmin = (a.role || '').toLowerCase() === 'admin';
              const bIsAdmin = (b.role || '').toLowerCase() === 'admin';
              if (aIsAdmin && !bIsAdmin) return -1;
              if (!aIsAdmin && bIsAdmin) return 1;
              return 0;
            });

            saveLocalProfiles(formatted);
            return formatted;
          }
        }
      } catch (err) {
        console.warn('[profileService] Erreur lors de la récupération des profils Supabase, utilisation du cache local :', err);
      }
    }

    const localList = getLocalProfiles().filter((p) => !isTestOrDemoAccount(p));
    const hasAdminLocal = localList.some((p) => (p.role || '').toLowerCase() === 'admin');
    const fullList = hasAdminLocal ? localList : [getBossProfile(), ...localList];
    return fullList.sort((a, b) => {
      const aIsAdmin = (a.role || '').toLowerCase() === 'admin';
      const bIsAdmin = (b.role || '').toLowerCase() === 'admin';
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return 0;
    });
  },

  /**
   * Récupère le profil d'un utilisateur depuis Supabase 'profiles'
   */
  async getProfile(userId: string): Promise<Profile | null> {
    if (!userId) return null;
    if (isTestOrDemoAccount({ id: userId, email: userId })) return null;

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
            data.email?.toLowerCase().includes('direction') ||
            (data.job_title?.toLowerCase().includes('direct') && !data.job_title?.toLowerCase().includes('sous'));
          const role = isSamiraOrDir || data.role?.toLowerCase() === 'admin' ? 'admin' : 'employee';
          const prof: Profile = {
            ...data,
            role,
          };
          if (role === 'admin') {
            try {
              localStorage.setItem('tuws_boss_profile', JSON.stringify(prof));
            } catch {}
          }
          return prof;
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

          if (assignedRole === 'admin') {
            try {
              localStorage.setItem('tuws_boss_profile', JSON.stringify(newProfile));
            } catch {}
          }

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
        // Mettre à jour les métadonnées de l'utilisateur dans Supabase Auth
        if (sanitizedUpdates.gender || sanitizedUpdates.full_name) {
          try {
            await supabase.auth.updateUser({
              data: {
                ...(sanitizedUpdates.gender ? { gender: sanitizedUpdates.gender } : {}),
                ...(sanitizedUpdates.full_name ? { full_name: sanitizedUpdates.full_name } : {}),
              },
            });
          } catch {
            // non bloquant
          }
        }

        let { data, error } = await supabase
          .from('profiles')
          .update(sanitizedUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (error && error.message?.toLowerCase().includes('gender')) {
          const fallbackUpdates = { ...sanitizedUpdates };
          delete (fallbackUpdates as any).gender;
          const retry = await supabase
            .from('profiles')
            .update(fallbackUpdates)
            .eq('id', userId)
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (data && !error) {
          const isBoss =
            data.role?.toLowerCase() === 'admin' ||
            data.email?.toLowerCase().includes('samira') ||
            data.email?.toLowerCase().includes('direction') ||
            (data.job_title?.toLowerCase().includes('direct') && !data.job_title?.toLowerCase().includes('sous'));
          const updated: Profile = {
            ...data,
            gender: sanitizedUpdates.gender || data.gender,
            role: (isBoss ? 'admin' : 'employee'),
          };
          const current = getLocalProfiles();
          const idx = current.findIndex((p) => p.id === userId);
          if (idx !== -1) {
            current[idx] = updated;
            saveLocalProfiles(current);
          }
          try {
            const sessRaw = localStorage.getItem('tuwshiuah_workspace_session');
            if (sessRaw) {
              const sess = JSON.parse(sessRaw);
              localStorage.setItem('tuwshiuah_workspace_session', JSON.stringify({ ...sess, ...updated }));
            }
            if (isBoss) {
              localStorage.setItem('tuws_boss_profile', JSON.stringify(updated));
            }
          } catch {
            // ignoré
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
      try {
        const sessRaw = localStorage.getItem('tuwshiuah_workspace_session');
        if (sessRaw) {
          const sess = JSON.parse(sessRaw);
          localStorage.setItem('tuwshiuah_workspace_session', JSON.stringify({ ...sess, ...updated }));
        }
      } catch {
        // ignoré
      }
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
    const seed = encodeURIComponent(memberData.full_name?.trim() || (isFemale ? 'femme' : 'homme'));
    const defaultAvatar = isFemale
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&top=bob,bun,curly,curvy,dreads,longButNotTooLong,miaWallace,straight02,straight01,straightAndStrand&facialHairProbability=0`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&top=shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar,theCaesarAndSidePart`;

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
  /**
   * [ADMIN] Modification des informations d'un collaborateur
   */
  async updateMember(memberId: string, memberData: Partial<Profile>): Promise<Profile | null> {
    const sanitized: Partial<Profile> = { ...memberData };
    delete sanitized.id;

    // Éviter l'erreur Postgres si la colonne 'gender' n'existe pas encore dans la table distante
    const dbPayload = { ...sanitized };
    delete (dbPayload as any).gender;

    // Supprimer les clés undefined
    Object.keys(dbPayload).forEach((k) => {
      if ((dbPayload as any)[k] === undefined) {
        delete (dbPayload as any)[k];
      }
    });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isSupabaseConfigured && isUUID) {
      let updatedFromDb: any = null;

      // 1. Tenter d'abord la fonction RPC sécurisée (SECURITY DEFINER)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_profile', {
          target_user_id: memberId,
          p_full_name: dbPayload.full_name || null,
          p_job_title: dbPayload.job_title || null,
          p_phone: dbPayload.phone || null,
          p_role: dbPayload.role || null,
          p_avatar_url: dbPayload.avatar_url || null,
        });

        if (!rpcError && rpcData) {
          updatedFromDb = rpcData;
        }
      } catch (rpcErr) {
        console.warn('[profileService] RPC admin_update_profile non disponible, repli direct :', rpcErr);
      }

      // 2. Repli par mise à jour directe sur la table public.profiles
      if (!updatedFromDb) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(dbPayload)
            .eq('id', memberId)
            .select()
            .maybeSingle();

          if (error) {
            console.warn('[profileService] Erreur update direct Supabase :', error.message);
          } else if (data) {
            updatedFromDb = data;
          }
        } catch (dbErr) {
          console.warn('[profileService] Erreur réseau / Supabase lors de updateMember :', dbErr);
        }
      }

      if (updatedFromDb) {
        const updated: Profile = {
          ...updatedFromDb,
          gender: memberData.gender,
          role: (updatedFromDb.role?.toLowerCase() === 'admin' ? 'admin' : 'employee'),
        };
        const current = getLocalProfiles();
        const idx = current.findIndex((p) => p.id === memberId);
        if (idx !== -1) {
          current[idx] = updated;
          saveLocalProfiles(current);
        }
        return updated;
      }
    }

    // Repli local si compte hors Supabase (ou si RLS en attente d'application SQL)
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

  async deleteMember(memberId: string): Promise<boolean> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isSupabaseConfigured && isUUID) {
      let dbDeleteSuccess = false;

      // 1. Tenter d'abord la suppression complète via RPC (auth.users + public.profiles + storage)
      try {
        const { error: rpcError } = await supabase.rpc('delete_user_account', {
          target_user_id: memberId,
        });

        if (!rpcError) {
          dbDeleteSuccess = true;
        } else {
          console.warn('[profileService] RPC delete_user_account échoué, repli direct profiles :', rpcError.message);
        }
      } catch (err) {
        console.warn('[profileService] Erreur appel RPC delete_user_account :', err);
      }

      // 2. Repli par suppression directe dans la table profiles
      if (!dbDeleteSuccess) {
        try {
          const { error: delError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', memberId);

          if (delError) {
            console.warn('[profileService] Repli suppression direct profiles échoué :', delError.message);
          } else {
            dbDeleteSuccess = true;
          }
        } catch (err) {
          console.warn('[profileService] Exception lors de delete profiles :', err);
        }
      }
    }

    // Mise à jour immédiate du cache local
    const current = getLocalProfiles();
    const filtered = current.filter((p) => p.id !== memberId);
    saveLocalProfiles(filtered);
    return true;
  },
};
