import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContextType } from '../types/auth';
import { Profile, UserRole } from '../types/database';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { mockProfiles } from '../services/mockData';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronise le profil correspondant à l'ID utilisateur
  const syncProfile = async (userId: string, emailFallback?: string): Promise<Profile | null> => {
    try {
      const p = await profileService.getProfile(userId);
      if (p) {
        setProfile(p);
        if (p.role === 'admin') {
          try {
            localStorage.setItem('tuws_boss_profile', JSON.stringify(p));
          } catch {}
        }
        return p;
      }
    } catch (err) {
      console.warn('[AuthProvider] Erreur syncProfile :', err);
    }

    if (emailFallback) {
      const fallback = mockProfiles.find((m) => m.email.toLowerCase() === emailFallback.toLowerCase()) || mockProfiles[0];
      setProfile(fallback);
      return fallback;
    }

    setProfile(null);
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const isExplicitProd = import.meta.env.VITE_DEMO_MODE === 'false' || import.meta.env.PROD;

        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.getSession();
          if (data?.session && !error) {
            if (mounted) {
              setSession(data.session);
              setUser(data.session.user);
              await syncProfile(data.session.user.id, data.session.user.email);
            }
            if (mounted) setLoading(false);
            return;
          }
        }

        // Si aucun compte n'est authentifié : ne JAMAIS auto-connecter un visiteur !
        // En mode démo local, restaurer UNIQUEMENT si l'utilisateur s'est déjà connecté manuellement
        if (!isExplicitProd) {
          const demoUser = authService.getLocalDemoUser();
          if (demoUser && mounted) {
            const fakeUser: User = {
              id: demoUser.id,
              app_metadata: {},
              user_metadata: { full_name: demoUser.full_name, avatar_url: demoUser.avatar_url },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
              email: demoUser.email,
            };
            setUser(fakeUser);
            setProfile(demoUser);
          } else if (mounted) {
            setUser(null);
            setProfile(null);
            setSession(null);
          }
        } else if (mounted) {
          setUser(null);
          setProfile(null);
          setSession(null);
        }
      } catch (err) {
        console.warn('[AuthProvider] Erreur lors de l’initialisation auth :', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Écoute en temps réel des changements d'état Supabase Auth
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user || null);

        if (newSession?.user) {
          await syncProfile(newSession.user.id, newSession.user.email);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
        setLoading(false);
      });
      authListener = data;
    }

    return () => {
      mounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password?: string): Promise<{ error?: string | null }> => {
    setLoading(true);
    try {
      const res = await authService.signIn(email, password);
      if (res.error) {
        return { error: res.error };
      }

      setUser(res.user);
      setSession(res.session);

      if (res.profile) {
        setProfile(res.profile);
      } else if (res.user) {
        await syncProfile(res.user.id, res.user.email);
      }

      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'employee' = 'employee') => {
    setLoading(true);
    try {
      const res = await authService.signUp(email, password, fullName, role);
      if (res.error) {
        return { error: res.error };
      }
      if (res.session && res.user) {
        setSession(res.session);
        setUser(res.user);
        await syncProfile(res.user.id, email);
      }
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Alias de rétrocompatibilité
  const login = async (email: string, _role?: UserRole) => {
    const res = await signIn(email);
    if (res.error) throw new Error(res.error);
  };

  const logout = async () => {
    await signOut();
  };

  // Sélecteur rapide de profil (démo)
  const switchUser = async (userId: string) => {
    setLoading(true);
    try {
      const switched = await authService.switchUser(userId);
      const fakeUser: User = {
        id: switched.id,
        app_metadata: {},
        user_metadata: { full_name: switched.full_name, avatar_url: switched.avatar_url },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: switched.email,
      };
      setUser(fakeUser);
      setProfile(switched);
    } finally {
      setLoading(false);
    }
  };

  const role = useMemo<UserRole | null>(() => {
    if (!profile) return null;
    return profile.role?.toLowerCase() === 'admin' ? 'admin' : 'employee';
  }, [profile]);

  const isAdmin = useMemo<boolean>(() => {
    return role === 'admin';
  }, [role]);

  const isAuthenticated = useMemo<boolean>(() => {
    return !!user;
  }, [user]);

  const updateUserProfile = async (updates: Partial<Profile>): Promise<Profile | null> => {
    if (!profile?.id && !user?.id) return null;
    const targetId = profile?.id || user!.id;
    try {
      const updated = await profileService.updateProfile(targetId, updates);
      if (updated) {
        setProfile((prev) => ({ ...(prev || {}), ...updated }));
        if (updated.role === 'admin' || isAdmin) {
          try {
            localStorage.setItem('tuws_boss_profile', JSON.stringify({ ...(profile || {}), ...updated, role: 'admin' }));
          } catch {}
        }
      }
      return updated;
    } catch (err) {
      console.warn('[AuthProvider] Erreur updateUserProfile :', err);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    role,
    loading,
    isLoading: loading,
    isAuthenticated,
    isAdmin,
    session,
    signIn,
    signUp,
    signOut,
    login,
    logout,
    switchUser,
    updateUserProfile,
    availableProfiles: mockProfiles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
