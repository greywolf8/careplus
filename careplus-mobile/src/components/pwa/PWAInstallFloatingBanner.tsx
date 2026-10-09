import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ArrowDownCircle, Check } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

const DISMISS_KEY = 'careplus_install_banner_dismissed';

export const PWAInstallFloatingBanner: React.FC = () => {
  const { isInstallable, isInstalled, install, platformName } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (isStandalone) return;

      const urlParams = new URLSearchParams(window.location.search);
      const isDirectInstallUrl = urlParams.get('install') === 'true' || window.location.hash.includes('install');

      const isDismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
      if (!isDismissed || isDirectInstallUrl) {
        // Show banner immediately for direct install or after short delay
        const delay = isDirectInstallUrl ? 100 : 800;
        const timer = setTimeout(() => {
          setDismissed(false);
          if (isDirectInstallUrl && isInstallable) {
            install();
          }
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstalled, isInstallable, install]);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    }
  };

  const handleInstallClick = async () => {
    const res = await install();
    if (res === 'accepted') {
      setInstalledSuccess(true);
      setTimeout(() => {
        setDismissed(true);
      }, 2500);
    } else if (res === 'manual') {
      // Prompt not available or iOS/custom browser - show quick instructions
      setShowInstructions(true);
    }
  };

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      role="alert"
      aria-live="polite"
    >
      <div
        className="rounded-2xl p-3.5 shadow-2xl border backdrop-blur-md flex flex-col gap-2.5 transition-all"
        style={{
          backgroundColor: 'var(--cp-card-bg, #ffffff)',
          borderColor: 'var(--cp-card-border, #00B8A9)',
          boxShadow: '0 12px 30px -4px rgba(0, 184, 169, 0.25), 0 8px 16px -4px rgba(0,0,0,0.15)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* App Icon */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Smartphone className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--cp-text)' }}>
                  Install CarePlus App
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  APK / PWA
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--cp-muted)' }}>
                {installedSuccess
                  ? 'App installed successfully!'
                  : '1-click install for instant mobile access'}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button or Instructions */}
        {installedSuccess ? (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4" />
            <span>Added to your Home Screen!</span>
          </div>
        ) : showInstructions ? (
          <div className="text-xs p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-slate-700 dark:text-slate-200 flex flex-col gap-1">
            <p className="font-medium">
              {platformName === 'ios'
                ? 'To install on iOS:'
                : 'To install in Chrome:'}
            </p>
            <p className="text-[11px] opacity-90">
              {platformName === 'ios'
                ? 'Tap the Share icon (⎙) at the bottom and choose "Add to Home Screen".'
                : 'Tap Chrome menu (⋮) at top-right and choose "Install app" or "Add to Home screen".'}
            </p>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-[11px] text-teal-600 dark:text-teal-300 font-semibold underline text-left mt-1"
            >
              Close instructions
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              id="btn-pwa-quick-install"
              className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Directly</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
