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
      // Fallback when the profiles row is missing. Use the role encoded on the
      // auth user (patient logins carry role:'patient') instead of blindly
      // defaulting to 'doctor' — otherwise a patient session masquerades as a
      // doctor in the UI while the backend correctly rejects care-team actions.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metaRole = user.user_metadata?.role;
        const resolvedRole: 'doctor' | 'patient' | 'caregiver' =
          metaRole === 'patient' || metaRole === 'caregiver' ? metaRole : 'doctor';

        // Self-heal a doctor profile only for doctor-type accounts
        // (never turn a patient's auth user into a doctor profile).
        if (resolvedRole === 'doctor') {
          try {
            await supabase.from('profiles').upsert(
              {
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email || 'Doctor',
                role: 'doctor',
                preferred_language: 'en',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          } catch (healErr) {
            console.error('[AuthContext] Failed to self-heal profiles row:', healErr);
          }
        }

        const fallbackProfile: Profile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || null,
          role: resolvedRole,
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
