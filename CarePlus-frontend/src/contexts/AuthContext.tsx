import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../lib/auth';
import type { Profile } from '../types';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await loadProfile();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() {
    try {
      const userProfile = await getCurrentProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('[AuthContext] Failed to load profile from profiles table:', error);
      // Fallback: Use auth user data if profiles table is inaccessible (RLS issue)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Create a minimal profile from auth user data
        const fallbackProfile: Profile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || null,
          role: 'doctor', // Default to doctor for demo
          preferred_language: 'en',
          created_at: user.created_at || new Date().toISOString(),
          updated_at: user.updated_at || new Date().toISOString(),
        };
        setProfile(fallbackProfile);
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
