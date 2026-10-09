import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { useNotification } from './NotificationContext';
import {
  UserProfile,
  PatientContext,
  TabPermissions,
  Language,
  ActiveTab,
  SubRoute,
} from '../types';

export type AppTheme = 'dark' | 'light';

interface SavedSession {
  user: UserProfile;
  patientContext: PatientContext;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  currentUser: UserProfile;
  patientContext: PatientContext;
  tabPermissions: TabPermissions;
  language: Language;
  setLanguage: (lang: Language) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeSubRoute: SubRoute | null;
  setActiveSubRoute: (route: SubRoute | null) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  switchPersona: (role: 'patient' | 'caregiver') => void;
  isOnline: boolean;
  canSeeTab: (tab: ActiveTab) => boolean;
  canSeeSubRoute: (route: SubRoute) => boolean;
  refreshData: () => void;
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  isSupabaseLive: boolean;
  addCaregiver: (caregiver: {
    name: string;
    relationship: string;
    phone?: string;
    email?: string;
    canMarkDone: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_SESSION_KEY = 'careplus_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session / Authentication state
  const [session, setSession] = useState<SavedSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_SESSION_KEY);
        if (stored) {
          return JSON.parse(stored) as SavedSession;
        }
      } catch (err) {
        console.warn('Failed to parse saved session:', err);
      }
    }
    return null;
  });

  const [activePersonaRole, setActivePersonaRole] = useState<'patient' | 'caregiver'>('patient');
  const [activeTab, setActiveTabState] = useState<ActiveTab>('today');
  const [activeSubRoute, setActiveSubRouteState] = useState<SubRoute | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [dbVersion, setDbVersion] = useState<number>(0);
  const [theme, setThemeState] = useState<AppTheme>(
    () => (localStorage.getItem('cp_theme') as AppTheme) || 'dark'
  );

  const { notifyInfo, notifyWarning, notifySuccess } = useNotification();
  const isSupabaseLive = dataService.isUsingRealSupabase();

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem('cp_theme', t);
  }, []);

  // Login method
  const login = useCallback(async (identifier: string, pass: string) => {
    const res = await dataService.loginPatient(identifier, pass);
    if (res.success && res.user && res.patientContext) {
      const newSession: SavedSession = {
        user: res.user,
        patientContext: res.patientContext,
      };
      setSession(newSession);
      setActivePersonaRole('patient');
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newSession));
      } catch (err) {
        console.warn('Failed to persist session:', err);
      }
      notifySuccess(`Welcome back, ${res.user.name}!`, 'Signed In');
      return { success: true };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  }, [notifySuccess]);

  // Logout method
  const logout = useCallback(() => {
    setSession(null);
    setActivePersonaRole('patient');
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // ignore
    }
    notifyInfo('You have been logged out.', 'Signed Out');
  }, [notifyInfo]);

  // Synchronize route state with browser URL path and history
  useEffect(() => {
    const parseUrl = () => {
      const fullPath = window.location.pathname + window.location.hash;
      if (fullPath.includes('warning-signs')) {
        setActiveSubRouteState('warning_signs');
      } else if (fullPath.includes('tests')) {
        setActiveSubRouteState('tests');
      } else if (fullPath.includes('find-care')) {
        setActiveSubRouteState('find_care');
      } else if (fullPath.includes('reminders')) {
        setActiveSubRouteState('reminders');
      } else if (fullPath.includes('settings')) {
        setActiveSubRouteState('settings');
      } else if (fullPath.includes('print')) {
        setActiveSubRouteState('print');
      } else if (fullPath.includes('plan')) {
        setActiveTabState('plan');
        setActiveSubRouteState(null);
      } else if (fullPath.includes('medicines')) {
        setActiveTabState('medicines');
        setActiveSubRouteState(null);
      } else if (fullPath.includes('ask')) {
        setActiveTabState('ask');
        setActiveSubRouteState(null);
      } else if (fullPath.includes('more')) {
        setActiveTabState('more');
        setActiveSubRouteState(null);
      } else {
        setActiveTabState('today');
        setActiveSubRouteState(null);
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  // Connectivity listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      notifyInfo('Network connection restored.', 'Online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      notifyWarning('You are currently offline. Cached care plan is available.', 'Offline Mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [notifyInfo, notifyWarning]);

  // Database subscription for real-time reactivity
  useEffect(() => {
    const patientId = session?.patientContext?.patientId || 'pat_lakshmi_01';
    const unsubscribe = dataService.subscribe(() => {
      setDbVersion((v) => v + 1);
    }, patientId);

    return () => {
      unsubscribe();
    };
  }, [session?.patientContext?.patientId]);

  const refreshData = useCallback(() => {
    setDbVersion((v) => v + 1);
  }, []);

  // Compute active user and patient context based on current logged in user & selected persona
  const currentUser = useMemo((): UserProfile => {
    if (!session) {
      return {
        id: 'guest',
        name: 'Patient',
        role: 'patient',
        preferred_language: 'en',
        email: '',
      };
    }

    if (activePersonaRole === 'caregiver') {
      return {
        id: `cg_${session.user.id}`,
        name: 'Caregiver Delegate',
        role: 'caregiver',
        preferred_language: session.user.preferred_language || 'en',
        email: `caregiver@careplus.health`,
      };
    }

    return session.user;
  }, [session, activePersonaRole]);

  const patientContext = useMemo((): PatientContext => {
    if (!session) {
      return {
        userId: 'pat_default',
        role: 'patient',
        patientId: 'pat_default',
        patientName: 'Patient',
        canMarkDone: true,
        hospital: 'Apollo Speciality Hospitals',
        primaryDoctor: 'Dr. Anita Sharma, MD DM',
        dischargeDate: new Date().toISOString().split('T')[0],
        dischargeDiagnosis: 'Post-Discharge Recovery Care Plan',
      };
    }

    if (activePersonaRole === 'caregiver') {
      return {
        ...session.patientContext,
        userId: `cg_${session.user.id}`,
        role: 'caregiver',
        relationship: 'Family Member',
        canMarkDone: true,
      };
    }

    return session.patientContext;
  }, [session, activePersonaRole]);

  const tabPermissions = useMemo((): TabPermissions => {
    return {
      can_see_today: true,
      can_see_plan: true,
      can_see_medicines: true,
      can_see_ask: true,
      can_see_more: true,
      can_see_warning_signs: true,
      can_see_tests: true,
      can_see_find_care: true,
      can_see_reminders: true,
      can_mark_done: true,
    };
  }, []);

  const [language, setLanguageState] = useState<Language>(currentUser.preferred_language || 'en');

  useEffect(() => {
    if (currentUser.preferred_language) {
      setLanguageState(currentUser.preferred_language);
    }
  }, [currentUser.preferred_language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      if (session?.user?.id) {
        dataService.updateProfileLanguage(session.user.id, lang);
      }
    },
    [session]
  );

  const canSeeTab = useCallback(
    (tab: ActiveTab): boolean => {
      switch (tab) {
        case 'today':
          return tabPermissions.can_see_today;
        case 'plan':
          return tabPermissions.can_see_plan;
        case 'medicines':
          return tabPermissions.can_see_medicines;
        case 'ask':
          return tabPermissions.can_see_ask;
        case 'more':
          return tabPermissions.can_see_more;
        default:
          return true;
      }
    },
    [tabPermissions]
  );

  const canSeeSubRoute = useCallback(
    (route: SubRoute): boolean => {
      switch (route) {
        case 'warning_signs':
          return tabPermissions.can_see_warning_signs;
        case 'tests':
          return tabPermissions.can_see_tests;
        case 'find_care':
          return tabPermissions.can_see_find_care;
        case 'reminders':
          return tabPermissions.can_see_reminders;
        case 'settings':
        case 'print':
          return true;
        default:
          return true;
      }
    },
    [tabPermissions]
  );

  const setActiveTab = useCallback(
    (tab: ActiveTab) => {
      if (canSeeTab(tab)) {
        setActiveSubRouteState(null);
        setActiveTabState(tab);
        const url = tab === 'today' ? '/app' : `/app/${tab}`;
        try {
          window.history.pushState(null, '', url);
        } catch {
          // ignore
        }
      }
    },
    [canSeeTab]
  );

  const setActiveSubRoute = useCallback((route: SubRoute | null) => {
    setActiveSubRouteState(route);
    if (route) {
      const routeMap: Record<SubRoute, string> = {
        warning_signs: '/app/warning-signs',
        tests: '/app/tests',
        find_care: '/app/find-care',
        reminders: '/app/reminders',
        settings: '/app/settings',
        print: '/app/print',
      };
      try {
        window.history.pushState(null, '', routeMap[route]);
      } catch {
        // ignore
      }
    } else {
      try {
        window.history.pushState(null, '', '/app');
      } catch {
        // ignore
      }
    }
  }, []);

  const switchPersona = useCallback((role: 'patient' | 'caregiver') => {
    setSelectedTaskId(null);
    setActiveSubRouteState(null);
    setActiveTabState('today');
    setActivePersonaRole(role);
    try {
      window.history.pushState(null, '', '/app');
    } catch {
      // ignore
    }
  }, []);

  const addCaregiver = useCallback(
    async (caregiver: {
      name: string;
      relationship: string;
      phone?: string;
      email?: string;
      canMarkDone: boolean;
    }) => {
      if (!session) return { success: false, error: 'Not authenticated' };
      const res = await dataService.addCaregiver(session.patientContext.patientId, caregiver);
      if (res.success) {
        notifySuccess(`Added ${caregiver.name} (${caregiver.relationship}) to Care Team.`, 'Caregiver Added');
        refreshData();
      }
      return res;
    },
    [session, notifySuccess, refreshData]
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        login,
        logout,
        currentUser,
        patientContext,
        tabPermissions,
        language,
        setLanguage,
        activeTab,
        setActiveTab,
        activeSubRoute,
        setActiveSubRoute,
        selectedTaskId,
        setSelectedTaskId,
        switchPersona,
        isOnline,
        canSeeTab,
        canSeeSubRoute,
        refreshData,
        theme,
        setTheme,
        isSupabaseLive,
        addCaregiver,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
