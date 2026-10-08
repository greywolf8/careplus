import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function AuthPage() {
  const { profile } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (profile) {
    // User is already authenticated, will be redirected by App.tsx
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        console.log('[Auth] Attempting sign in with:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('[Auth] Sign in result:', { data, error });
        if (error) {
          console.error('[Auth] Sign in error:', error);
          if (error.message.includes('Email not confirmed')) {
            setError('Please confirm your email address first. Check your inbox for the confirmation link.');
          } else if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please try again.');
          } else {
            throw error;
          }
        }
      } else {
        console.log('[Auth] Attempting sign up with:', { email, fullName });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: undefined, // Disable email confirmation for development
          },
        });
        console.log('[Auth] Sign up result:', { data, error });
        if (error) {
          console.error('[Auth] Sign up error:', error);
          // If user already exists, suggest logging in
          if (error.message.includes('already registered') || error.message.includes('rate limit')) {
            setError('Email already registered. Please sign in instead.');
            setIsLogin(true);
            return;
          }
          throw error;
        }

        // Create profile entry
        if (data.user) {
          console.log('[Auth] Creating profile for user:', data.user.id);
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            role: 'doctor', // Default to doctor for demo
            preferred_language: 'en',
          });
          console.log('[Auth] Profile creation result:', { profileError });
          if (profileError) throw profileError;
        }
      }
    } catch (err: any) {
      console.error('[Auth] Authentication error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <span className="text-xl font-bold">+</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">CarePlus</span>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isLogin ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {isLogin 
              ? 'Welcome back to CarePlus Doctor Portal'
              : 'Join CarePlus to manage patient discharges'
            }
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-warning-container/10 border border-warning/20 text-sm text-warning">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Dr. John Smith"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="doctor@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-primary hover:text-primary-700 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          CarePlus Discharge & Follow-up Coordinator
        </p>
      </div>
    </div>
  );
}
