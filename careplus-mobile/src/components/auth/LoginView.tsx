import React, { useState } from 'react';
import { ShieldCheck, Heart, ArrowRight, Phone, Mail, Lock, CheckCircle2, AlertCircle, Download, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../pwa/usePWAInstall';

export const LoginView: React.FC = () => {
  const { login, theme } = useAuth();
  const { isInstalled, install, isInstallable } = usePWAInstall();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLight = theme === 'light';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Please enter your email or mobile number and password/phone.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await login(identifier, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div
      data-theme={theme}
      className="min-h-[100dvh] w-full flex justify-center selection:bg-teal-500 selection:text-white transition-colors duration-300"
      style={{ backgroundColor: 'var(--cp-bg)' }}
    >
      <div
        className="w-full max-w-md min-h-[100dvh] flex flex-col justify-between p-6 border-x relative shadow-2xl transition-colors duration-300"
        style={{
          backgroundColor: 'var(--cp-bg)',
          borderColor: 'var(--cp-border)',
        }}
      >
        {/* Header Branding */}
        <div className="pt-6">
          <div className="flex items-center justify-between gap-2.5 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                <Heart className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--cp-text)' }}>
                    CarePlus
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                    Patient Portal
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--cp-text-muted)' }}>
                  Post-Discharge Recovery & Care Plan
                </p>
              </div>
            </div>

            {!isInstalled && (
              <button
                type="button"
                onClick={() => install()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
                title="Install App to Home Screen"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--cp-text)' }}>
              Sign in to your care plan
            </h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--cp-text-muted)' }}>
              Access your personalized medications, doctor appointments, and recovery instructions.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl border flex items-start gap-2.5 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <div className="text-xs font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cp-text)' }}>
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. rahul@gmail.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30"
                  style={{
                    backgroundColor: 'var(--cp-input-bg)',
                    borderColor: 'var(--cp-input-border)',
                    color: 'var(--cp-text)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cp-text)' }}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30"
                  style={{
                    backgroundColor: 'var(--cp-input-bg)',
                    borderColor: 'var(--cp-input-border)',
                    color: 'var(--cp-text)',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Badges */}
        <div className="pt-6 pb-2 text-center flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--cp-text-muted)' }}>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span>256-bit Encrypted · ABHA / HIPAA Standards</span>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--cp-text-subtle)' }}>
            Apollo Speciality Hospitals · CarePlus Discharge System
          </p>
        </div>
      </div>
    </div>
  );
};
