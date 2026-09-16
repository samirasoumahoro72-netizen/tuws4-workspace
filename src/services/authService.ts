import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockProfiles } from './mockData';
import { Profile } from '../types/database';
import { validatePasswordPolicy } from '../lib/security';

const SESSION_KEY = 'tuwshiuah_workspace_session';

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  profile?: Profile | null;
  error?: string | null;
}

export const authService = {
  /**
   * Inscription d'un nouvel utilisateur dans Supabase Auth
   */
  async signUp(email: string, password: string, fullName: string, role: 'admin' | 'employee' = 'employee'): Promise<AuthResponse> {
    if (!email || !email.trim() || !password) {
      return { user: null, session: null, error: 'Veuillez saisir votre e-mail et un mot de passe.' };
    }

    if (!isSupabaseConfigured) {
      return {
        user: null,
        session: null,
        error: "Supabase n'est pas encore configuré avec vos clés réelles dans .env.local.",
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim() || email.split('@')[0],
            role: role,
          },
        },
      });

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      return {
        user: null,
        session: null,
        error: err.message || "Erreur lors de l'inscription.",
      };
    }
  },

  /**
   * Connexion via Supabase Auth avec mot de passe
   */
  async signIn(email: string, password?: string): Promise<AuthResponse> {
    if (!email || !email.trim()) {
      return { user: null, session: null, error: 'Veuillez saisir votre adresse e-mail.' };
    }

    const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false';

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password || '',
        });

        if (error) {
          if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_grant')) {
            // Vérification si le compte existe dans la base pour distinguer mot de passe incorrect vs compte inexistant
            try {
              const { data: exists } = await supabase.rpc('check_user_exists', {
                user_email: email.trim(),
              });
              if (exists === true) {
                return { user: null, session: null, error: "Mot de passe incorrect." };
              } else if (exists === false) {
                return { user: null, session: null, error: "Le compte n'existe pas." };
              }
            } catch {
              // Repli par interrogation directe de la table profiles
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id')
                  .ilike('email', email.trim())
                  .maybeSingle();
                if (profile) {
                  return { user: null, session: null, error: "Mot de passe incorrect." };
                }
              } catch {
                // ignoré
              }
            }
            return { user: null, session: null, error: "Le compte n'existe pas." };
          } else if (error.message.includes('Email not confirmed')) {
            return { user: null, session: null, error: "Veuillez confirmer votre adresse e-mail avant de vous connecter." };
          } else if (error.message.includes('rate limit')) {
            return { user: null, session: null, error: "Trop de tentatives. Veuillez patienter un instant avant de réessayer." };
          }
          return { user: null, session: null, error: "Le compte n'existe pas." };
        }

        return { user: data.user, session: data.session, error: null };
      } catch (err: any) {
        return {
          user: null,
          session: null,
          error: "Le compte n'existe pas.",
        };
      }
    }

    if (isExplicitProd) {
      const existsInMock = mockProfiles.some(
        (p) => p.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (existsInMock) {
        return {
          user: null,
          session: null,
          error: "Mot de passe incorrect.",
        };
      }
      return {
        user: null,
        session: null,
        error: "Le compte n'existe pas.",
      };
    }

    // Mode démo / fallback local si Supabase n'est pas encore provisionné
    const matchedProfile = mockProfiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase()) || mockProfiles[0];
    localStorage.setItem(SESSION_KEY, JSON.stringify(matchedProfile));

    // Fake Supabase User object pour assurer la cohérence de type
    const fakeUser: User = {
      id: matchedProfile.id,
      app_metadata: {},
      user_metadata: { full_name: matchedProfile.full_name, avatar_url: matchedProfile.avatar_url },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: matchedProfile.email,
    };

    return { user: fakeUser, session: null, profile: matchedProfile, error: null };
  },

  /**
   * Déconnexion complète via Supabase Auth
   */
  async signOut(): Promise<void> {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[authService] Erreur signOut Supabase :', err);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      try {
        sessionStorage.clear();
      } catch {
        // ignoré
      }
    }
  },

  /**
   * Récupère la session Supabase active
   */
  async getSession(): Promise<Session | null> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getSession();
        return data.session;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Bascule rapide d'utilisateur pour démonstration
   */
  async switchUser(userId: string): Promise<Profile> {
    const found = mockProfiles.find((p) => p.id === userId) || mockProfiles[0];
    localStorage.setItem(SESSION_KEY, JSON.stringify(found));
    return found;
  },

  /**
   * Envoi d'un lien de réinitialisation de mot de passe par e-mail
   */
  async resetPassword(email: string): Promise<{ error?: string | null; success?: boolean }> {
    if (!email || !email.trim()) {
      return { error: 'Veuillez saisir votre adresse e-mail professionnelle.' };
    }

    if (isSupabaseConfigured) {
      try {
        // Vérifier d'abord si le compte existe
        try {
          const { data: exists } = await supabase.rpc('check_user_exists', {
            user_email: email.trim(),
          });
          if (exists === false) {
            return { error: "Le compte n'existe pas." };
          }
        } catch {
          // Repli : tester dans profiles
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .ilike('email', email.trim())
              .maybeSingle();
            if (!profile) {
              return { error: "Le compte n'existe pas." };
            }
          } catch {
            // Continuer si RLS bloque
          }
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login?mode=update-password`,
        });

        if (error) {
          return { error: error.message };
        }
        return { success: true };
      } catch (err: any) {
        return { error: err.message || 'Impossible d’envoyer le lien de réinitialisation.' };
      }
    }

    // Mode local / vérification
    const exists = mockProfiles.some(
      (p) => p.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!exists) {
      return { error: "Le compte n'existe pas." };
    }
    return { success: true };
  },

  /**
   * Mise à jour effective du mot de passe
   */
  async updatePassword(newPassword: string): Promise<{ error?: string | null; success?: boolean }> {
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return { error: `Politique de mot de passe : ${policy.errors.join(' ')}` };
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          return { error: error.message };
        }
        return { success: true };
      } catch (err: any) {
        return { error: err.message || 'Erreur lors de la mise à jour du mot de passe.' };
      }
    }

    return { success: true };
  },

  /**
   * Récupère l'utilisateur local de démo
   */
  getLocalDemoUser(): Profile | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
};
