import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { dataService } from '../services/dataService';
import { Language, AccessRequest } from '../types';
import { t } from '../i18n/translations';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import {
  ArrowLeft, Globe, Users, Check, X, UserCheck, UserPlus,
  Download, RotateCcw, Moon, Sun, Shield, Database, LogOut,
  Phone, Mail, HeartHandshake,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    currentUser, patientContext, language, setLanguage,
    setActiveSubRoute, refreshData, switchPersona, theme, setTheme, isSupabaseLive,
    logout, addCaregiver,
  } = useAuth();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();
  const isLight = theme === 'light';

  const isPatientOwner = currentUser.role === 'patient';
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [showAddCaregiver, setShowAddCaregiver] = useState(false);
  const [cgName, setCgName] = useState('');
  const [cgRelation, setCgRelation] = useState('Son');
  const [cgPhone, setCgPhone] = useState('');
  const [cgEmail, setCgEmail] = useState('');
  const [cgCanMark, setCgCanMark] = useState(true);
  const [isSubmittingCg, setIsSubmittingCg] = useState(false);

  useEffect(() => {
    let isMounted = true;
    dataService.getAccessRequests().then((reqs) => {
      if (isMounted) setAccessRequests(reqs);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const pendingRequests = accessRequests.filter((r) => r.status === 'pending');

  const handleDecideRequest = async (requestId: string, decision: 'approved' | 'denied') => {
    const res = await dataService.decideAccessRequest(requestId, decision);
    if (res.success) {
      notifySuccess(
        `Caregiver access request was ${decision}.`,
        'Caregiver Permissions'
      );
      const updated = await dataService.getAccessRequests();
      setAccessRequests(updated);
      refreshData();
    } else {
      notifyError(res.error || 'Failed to update access request.', 'Update Error');
    }
  };

  const handleToggleCaregiverMarkDone = async (allowed: boolean) => {
    await dataService.updateCaregiverCanMarkDone('usr_caregiver_delegate', allowed);
    notifyInfo(
      `Caregiver task completion permission set to: ${allowed ? 'Allowed' : 'View Only'}`,
      'Caregiver Delegation'
    );
    refreshData();
  };

  const handleCreateCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cgName.trim()) return;

    setIsSubmittingCg(true);
    const res = await addCaregiver({
      name: cgName.trim(),
      relationship: cgRelation,
      phone: cgPhone.trim() || undefined,
      email: cgEmail.trim() || undefined,
      canMarkDone: cgCanMark,
    });
    setIsSubmittingCg(false);

    if (res.success) {
      setCgName('');
      setCgPhone('');
      setCgEmail('');
      setShowAddCaregiver(false);
    } else {
      notifyError(res.error || 'Failed to add caregiver.', 'Caregiver Error');
    }
  };

  /* ── shared style helpers ── */
  const card: React.CSSProperties = isLight
    ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', boxShadow: '0 1px 4px rgba(24,50,74,0.07)' }
    : { backgroundColor: '#0f172a', border: '1px solid rgba(20,184,166,0.15)' };

  const subCell: React.CSSProperties = isLight
    ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8' }
    : { backgroundColor: 'rgba(2,8,23,0.6)', border: '1px solid rgba(30,41,59,0.8)' };

  const hd: React.CSSProperties  = isLight ? { color: '#18324A' } : { color: '#ffffff' };
  const md: React.CSSProperties  = isLight ? { color: '#587084' } : { color: '#94a3b8' };
  const acc: React.CSSProperties = isLight ? { color: '#00AFA3' } : { color: '#2dd4bf' };
  const div: React.CSSProperties = isLight ? { borderColor: '#C5DCE8' } : { borderColor: 'rgba(30,41,59,0.8)' };

  const languages: { code: Language; label: string; sub: string }[] = [
    { code: 'en', label: 'English', sub: 'Primary' },
    { code: 'hi', label: 'हिंदी', sub: 'Hindi' },
    { code: 'ta', label: 'தமிழ்', sub: 'Tamil' },
  ];

  const patientInitials = (patientContext.patientName || 'Patient')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top bar with back button */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setActiveSubRoute(null)}
          aria-label="Back to dashboard"
          className="p-2.5 rounded-2xl border transition cursor-pointer"
          style={subCell}
        >
          <ArrowLeft className="w-4 h-4" style={hd} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={hd}>
            {t(language, 'settings_title')}
          </h1>
          <p className="text-[11px]" style={md}>
            Preferences, caregiver access, and account settings
          </p>
        </div>
      </div>

      {/* Logged in Patient Profile Card */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white font-bold text-base shadow-md">
            {patientInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold truncate" style={hd}>
                {patientContext.patientName}
              </h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300">
                Patient
              </span>
            </div>
            <p className="text-xs truncate" style={md}>
              {currentUser.email || `${patientContext.patientId}@careplus.health`}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t space-y-1.5 text-xs" style={div}>
          <div className="flex justify-between">
            <span style={md}>Hospital:</span>
            <span className="font-semibold text-right max-w-[200px] truncate" style={hd}>
              {patientContext.hospital || 'Apollo Speciality Hospitals'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={md}>Primary Doctor:</span>
            <span className="font-semibold text-right" style={hd}>
              {patientContext.primaryDoctor || 'Dr. Anita Sharma, MD'}
            </span>
          </div>
          {patientContext.dischargeDiagnosis && (
            <div className="flex justify-between">
              <span style={md}>Diagnosis:</span>
              <span className="font-semibold text-right max-w-[200px] truncate" style={hd}>
                {patientContext.dischargeDiagnosis}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Backend / System Live Status */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" style={acc} />
            <div>
              <div className="text-xs font-bold" style={hd}>Supabase Live Database</div>
              <div className="text-[10px]" style={md}>
                {isSupabaseLive ? 'Connected to live cloud database' : 'Local cached data mode'}
              </div>
            </div>
          </div>
          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase"
            style={
              isSupabaseLive
                ? isLight
                  ? { backgroundColor: '#E4F6F1', color: '#1A7A50', border: '1px solid #A8DFC9' }
                  : { backgroundColor: 'rgba(6,78,59,0.8)', color: '#6ee7b7' }
                : isLight
                ? { backgroundColor: '#F0F4F8', color: '#587084' }
                : { backgroundColor: 'rgba(30,41,59,0.8)', color: '#94a3b8' }
            }
          >
            {isSupabaseLive ? '● Live' : '○ Local'}
          </span>
        </div>
      </div>

      {/* Theme selector */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center gap-2 mb-2">
          {isLight ? <Sun className="w-4 h-4" style={acc} /> : <Moon className="w-4 h-4" style={acc} />}
          <h2 className="text-xs font-bold uppercase tracking-wider" style={acc}>
            {t(language, 'appearance_title')}
          </h2>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={md}>
          Select your preferred visual style. Clinical Mint is tailored for daytime reading.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTheme('dark')}
            className="p-3 rounded-2xl text-left transition flex items-center justify-between cursor-pointer"
            style={!isLight ? { backgroundColor: '#0f766e', color: '#ffffff' } : subCell}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-teal-300" />
              <div>
                <div className="text-xs font-bold" style={!isLight ? { color: '#ffffff' } : hd}>Dark Mode</div>
                <div className="text-[10px]" style={!isLight ? { color: 'rgba(255,255,255,0.7)' } : md}>Default Slate</div>
              </div>
            </div>
            {!isLight && <Check className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => setTheme('light')}
            className="p-3 rounded-2xl text-left transition flex items-center justify-between cursor-pointer"
            style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : subCell}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-200" />
              <div>
                <div className="text-xs font-bold" style={isLight ? { color: '#ffffff' } : hd}>Clinical Mint</div>
                <div className="text-[10px]" style={isLight ? { color: 'rgba(255,255,255,0.8)' } : md}>Crisp Light</div>
              </div>
            </div>
            {isLight && <Check className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Language Selection */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4" style={acc} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={acc}>
            {t(language, 'language_title')}
          </h2>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={md}>
          {t(language, 'language_desc')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                notifySuccess(`Language set to ${lang.label}.`, 'Language Updated');
              }}
              className="p-3 rounded-2xl text-left transition min-h-[58px] cursor-pointer"
              style={
                language === lang.code
                  ? { backgroundColor: isLight ? '#00AFA3' : '#0f766e', color: '#ffffff' }
                  : subCell
              }
            >
              <div className="text-xs font-bold" style={language === lang.code ? { color: '#ffffff' } : hd}>
                {lang.label}
              </div>
              <div className="text-[10px] mt-0.5" style={language === lang.code ? { color: 'rgba(255,255,255,0.8)' } : md}>
                {lang.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Persona Switcher (Patient vs Caregiver Mode) */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4" style={acc} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={acc}>
            Switch View Persona
          </h2>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={md}>
          Toggle between primary patient view and caregiver delegate mode.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => switchPersona('patient')}
            className="p-3 rounded-2xl text-left transition min-h-[64px] cursor-pointer"
            style={
              currentUser.role === 'patient'
                ? { backgroundColor: isLight ? '#00AFA3' : '#0f766e', color: '#ffffff' }
                : subCell
            }
          >
            <div className="text-xs font-bold" style={currentUser.role === 'patient' ? { color: '#ffffff' } : hd}>
              {patientContext.patientName}
            </div>
            <div className="text-[10px] mt-0.5" style={currentUser.role === 'patient' ? { color: 'rgba(255,255,255,0.8)' } : md}>
              Primary Patient (Self)
            </div>
          </button>
          <button
            onClick={() => switchPersona('caregiver')}
            className="p-3 rounded-2xl text-left transition min-h-[64px] cursor-pointer"
            style={
              currentUser.role === 'caregiver'
                ? { backgroundColor: isLight ? '#00AFA3' : '#0f766e', color: '#ffffff' }
                : subCell
            }
          >
            <div className="text-xs font-bold" style={currentUser.role === 'caregiver' ? { color: '#ffffff' } : hd}>
              Caregiver Mode
            </div>
            <div className="text-[10px] mt-0.5" style={currentUser.role === 'caregiver' ? { color: 'rgba(255,255,255,0.8)' } : md}>
              Delegate Access
            </div>
          </button>
        </div>
      </div>

      {/* Caregiver Access Control (Only visible to Patient) */}
      {isPatientOwner && (
        <div className="rounded-3xl p-4 shadow-sm" style={card}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" style={acc} />
              <h2 className="text-xs font-bold uppercase tracking-wider" style={acc}>
                Care Team & Caregivers
              </h2>
            </div>
            <button
              onClick={() => setShowAddCaregiver(!showAddCaregiver)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddCaregiver ? 'Close' : 'Add Caregiver'}</span>
            </button>
          </div>
          <p className="text-xs mb-3 leading-relaxed" style={md}>
            Manage family member permissions and task completion authority.
          </p>

          {/* Add Caregiver Form */}
          {showAddCaregiver && (
            <form onSubmit={handleCreateCaregiver} className="p-3.5 rounded-2xl mb-3 border space-y-2.5 animate-in fade-in" style={subCell}>
              <div className="text-xs font-bold" style={hd}>Add Family Member / Caregiver</div>
              <div>
                <label className="block text-[11px] mb-1 font-medium" style={md}>Full Name</label>
                <input
                  type="text"
                  value={cgName}
                  onChange={(e) => setCgName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--cp-input-bg)',
                    borderColor: 'var(--cp-input-border)',
                    color: 'var(--cp-text)',
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-1 font-medium" style={md}>Relationship</label>
                  <select
                    value={cgRelation}
                    onChange={(e) => setCgRelation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: 'var(--cp-input-bg)',
                      borderColor: 'var(--cp-input-border)',
                      color: 'var(--cp-text)',
                    }}
                  >
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Home Nurse">Home Nurse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1 font-medium" style={md}>Mobile Number</label>
                  <input
                    type="text"
                    value={cgPhone}
                    onChange={(e) => setCgPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: 'var(--cp-input-bg)',
                      borderColor: 'var(--cp-input-border)',
                      color: 'var(--cp-text)',
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs" style={hd}>Allow Marking Tasks Done</span>
                <input
                  type="checkbox"
                  checked={cgCanMark}
                  onChange={(e) => setCgCanMark(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingCg || !cgName.trim()}
                className="w-full mt-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCg ? 'Adding...' : 'Confirm & Add to Care Team'}
              </button>
            </form>
          )}

          {/* Active linked caregiver */}
          <div className="p-3 rounded-2xl mb-3" style={subCell}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold" style={hd}>Family Caregiver Link</div>
                <div className="text-[11px]" style={md}>Status: Active Linked Access</div>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                style={isLight
                  ? { backgroundColor: '#E4F6F1', color: '#1A7A50' }
                  : { backgroundColor: 'rgba(6,78,59,0.6)', color: '#6ee7b7' }}
              >
                Active
              </span>
            </div>

            <div className="mt-3 pt-3 flex items-center justify-between border-t" style={div}>
              <div>
                <div className="text-xs font-semibold" style={hd}>Allow Marking Tasks Done</div>
                <div className="text-[10px]" style={md}>Caregiver can complete medicines & tasks</div>
              </div>
              <button
                onClick={() => handleToggleCaregiverMarkDone(!patientContext.canMarkDone)}
                className="min-h-[32px] px-3 rounded-xl text-xs font-bold transition cursor-pointer"
                style={
                  patientContext.canMarkDone
                    ? isLight
                      ? { backgroundColor: '#E4F6F1', color: '#1A7A50', border: '1px solid #A8DFC9' }
                      : { backgroundColor: 'rgba(6,78,59,0.8)', color: '#6ee7b7' }
                    : isLight
                    ? { backgroundColor: '#FFF5D9', color: '#C58A00', border: '1px solid #F5D57A' }
                    : { backgroundColor: 'rgba(120,53,15,0.8)', color: '#fcd34d' }
                }
              >
                {patientContext.canMarkDone ? 'Allowed' : 'View Only'}
              </button>
            </div>
          </div>

          {/* Pending access requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider" style={acc}>
                Pending Access Requests
              </div>
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-3 rounded-2xl flex items-center justify-between" style={subCell}>
                  <div>
                    <div className="text-xs font-bold" style={hd}>{req.caregiver_name}</div>
                    <div className="text-[11px]" style={md}>{req.relationship} ({req.caregiver_email})</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDecideRequest(req.id, 'approved')}
                      aria-label="Approve"
                      className="p-2 rounded-xl text-white transition cursor-pointer"
                      style={{ backgroundColor: '#00AFA3' }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDecideRequest(req.id, 'denied')}
                      aria-label="Deny"
                      className="p-2 rounded-xl text-rose-300 transition cursor-pointer"
                      style={isLight ? { backgroundColor: '#FEE2E2', color: '#DC2626' } : { backgroundColor: 'rgba(127,29,29,0.6)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PWA Installation */}
      <div className="rounded-3xl p-4 shadow-sm" style={card}>
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-4 h-4" style={acc} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={acc}>
            {t(language, 'install_pwa')}
          </h2>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={md}>{t(language, 'install_desc')}</p>
        <PWAInstallButton variant="card" />
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full min-h-[46px] rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer border text-rose-500 hover:bg-rose-500/10 border-rose-500/30"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of CarePlus</span>
        </button>
      </div>

      {/* Reset demo */}
      <div>
        <button
          onClick={() => {
            if (confirm('Reset prototype demo state to default factory values?')) {
              dataService.resetToDefault();
              notifyInfo('Demo state has been reset to factory defaults.', 'Reset Complete');
              refreshData();
            }
          }}
          className="w-full min-h-[40px] rounded-2xl flex items-center justify-center gap-2 text-[11px] transition cursor-pointer"
          style={isLight
            ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#7A9AAD' }
            : { backgroundColor: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,1)', color: '#475569' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </div>
  );
};
