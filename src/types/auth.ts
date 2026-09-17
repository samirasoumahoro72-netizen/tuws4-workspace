import { User, Session } from '@supabase/supabase-js';
import { Profile, UserRole } from './database';

export interface AuthUser extends Profile {
  token?: string;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  session?: Session | null;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password?: string) => Promise<{ error?: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: 'admin' | 'employee') => Promise<{ error?: string | null }>;
  signOut: () => Promise<void>;
  login: (email: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  updateUserProfile?: (updates: Partial<Profile>) => Promise<Profile | null>;
  availableProfiles: Profile[];
}
