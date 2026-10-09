import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Share2, X, Check, Smartphone, Monitor, Sparkles, ExternalLink, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n/translations';

export const PWAInstallButton: React.FC<{ variant?: 'card' | 'compact' }> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, platformName, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android' | 'desktop'>(platformName);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const { language, theme } = useAuth();
  const isLight = theme === 'light';

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstallStatus('prompting');
      const result = await install();
      if (result === 'accepted') {
        setInstallStatus('installed');
        return;
      }
      if (result === 'manual') {
        setSelectedPlatform(platformName);
        setShowGuideModal(true);
      }
      setInstallStatus(null);
    } else {
      setSelectedPlatform(platformName);
      setShowGuideModal(true);
    }
  };

  // If already installed, show subtle status indicator
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div
          className="flex items-center gap-3 p-3.5 rounded-2xl border transition"
          style={
            isLight
              ? { backgroundColor: '#E4F6F1', borderColor: '#A3E3D2', color: '#096444' }
              : { backgroundColor: 'rgba(15,118,110,0.2)', borderColor: 'rgba(20,184,166,0.3)', color: '#2dd4bf' }
          }
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={isLight ? { backgroundColor: '#096444', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
          >
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">CarePlus is installed on your device</p>
            <p className="text-[11px] opacity-80 mt-0.5">Running in standalone app mode with offline readiness.</p>
          </div>
        </div>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
        style={
          isLight
            ? { backgroundColor: '#E4F6F1', color: '#096444' }
            : { backgroundColor: 'rgba(20,184,166,0.2)', color: '#2dd4bf' }
        }
      >
        <Check className="w-3.5 h-3.5" />
        Installed
      </span>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2 font-medium transition-all active:scale-[0.98] cursor-pointer ${
            variant === 'card'
              ? 'w-full justify-center p-3.5 rounded-2xl shadow-md text-sm font-semibold'
              : 'px-3 py-1.5 text-xs rounded-xl font-medium'
          }`}
          style={
            isLight
              ? { backgroundColor: '#00AFA3', color: '#ffffff', boxShadow: '0 4px 12px rgba(0, 175, 163, 0.25)' }
              : { backgroundColor: '#0f766e', color: '#ffffff', boxShadow: '0 4px 12px rgba(15, 118, 110, 0.35)' }
          }
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{t(language, 'install_pwa')}</span>
          {isInstallable && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-1"
              style={
                isLight
                  ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                  : { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
              }
            >
              1-Click
            </span>
          )}
        </button>

        {variant === 'card' && (
          <div className="flex items-center justify-between pt-1 px-1">
            <button
              onClick={() => {
                setSelectedPlatform(platformName);
                setShowGuideModal(true);
              }}
              className="text-[11px] flex items-center gap-1.5 transition hover:underline cursor-pointer"
              style={isLight ? { color: '#008B82' } : { color: '#2dd4bf' }}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Need help installing or on iOS / iPhone?</span>
            </button>
            <span
              className="text-[10px] uppercase font-bold tracking-wider"
              style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}
            >
              PWA 1.0
            </span>
          </div>
        )}
      </div>

      {/* Comprehensive Installation Modal / Guide */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
          <div
            className="w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border transition-all animate-in fade-in slide-in-from-bottom duration-200"
            style={
              isLight
                ? { backgroundColor: '#F2F7FC', borderColor: '#C5DCE8', color: '#18324A' }
                : { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }
            }
          >
            {/* Header */}
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={isLight ? { borderColor: '#DCEBF3' } : { borderColor: '#1e293b' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={isLight ? { backgroundColor: '#E4F6F1', color: '#00AFA3' } : { backgroundColor: 'rgba(15,118,110,0.3)', color: '#2dd4bf' }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Install CarePlus App</h3>
                  <p className="text-xs" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                    Fast home screen access & offline care plan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-xl transition cursor-pointer"
                style={isLight ? { backgroundColor: '#E1F0F7', color: '#587084' } : { backgroundColor: '#1e293b', color: '#94a3b8' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div
              className="flex gap-1.5 p-1 rounded-2xl my-4"
              style={isLight ? { backgroundColor: '#E1F0F7' } : { backgroundColor: '#1e293b' }}
            >
              <button
                onClick={() => setSelectedPlatform('android')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  selectedPlatform === 'android' ? 'shadow-xs' : ''
                }`}
                style={
                  selectedPlatform === 'android'
                    ? isLight
                      ? { backgroundColor: '#00AFA3', color: '#ffffff' }
                      : { backgroundColor: '#0f766e', color: '#ffffff' }
                    : isLight
                    ? { color: '#587084' }
                    : { color: '#94a3b8' }
                }
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>

              <button
                onClick={() => setSelectedPlatform('ios')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  selectedPlatform === 'ios' ? 'shadow-xs' : ''
                }`}
                style={
                  selectedPlatform === 'ios'
                    ? isLight
                      ? { backgroundColor: '#00AFA3', color: '#ffffff' }
                      : { backgroundColor: '#0f766e', color: '#ffffff' }
                    : isLight
                    ? { color: '#587084' }
                    : { color: '#94a3b8' }
                }
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>

              <button
                onClick={() => setSelectedPlatform('desktop')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  selectedPlatform === 'desktop' ? 'shadow-xs' : ''
                }`}
                style={
                  selectedPlatform === 'desktop'
                    ? isLight
                      ? { backgroundColor: '#00AFA3', color: '#ffffff' }
                      : { backgroundColor: '#0f766e', color: '#ffffff' }
                    : isLight
                    ? { color: '#587084' }
                    : { color: '#94a3b8' }
                }
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Computer</span>
              </button>
            </div>

            {/* Platform Instructions */}
            <div className="space-y-3 text-xs mb-5">
              {selectedPlatform === 'android' && (
                <>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      1
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Open in <strong>Chrome</strong> and tap the <strong>three dots (⋮)</strong> menu in top-right corner.
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      2
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      3
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Confirm by tapping <strong>"Install"</strong>. CarePlus will appear right on your phone screen!
                    </p>
                  </div>
                </>
              )}

              {selectedPlatform === 'ios' && (
                <>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      1
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Open this page in <strong>Safari</strong> and tap the <strong>Share</strong> icon (square with arrow pointing up) at the bottom.
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      2
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Scroll down the share sheet and tap <strong>"Add to Home Screen"</strong> (with the ⊞ icon).
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      3
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Tap <strong>"Add"</strong> in top right. Launch CarePlus like a native iOS application!
                    </p>
                  </div>
                </>
              )}

              {selectedPlatform === 'desktop' && (
                <>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      1
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      In Chrome or Edge, look for the <strong>Install icon (⊞ / ↓)</strong> in the right side of the address bar.
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-3 p-3 rounded-2xl border"
                    style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#1e293b', borderColor: '#334155' }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                      style={isLight ? { backgroundColor: '#00AFA3', color: '#ffffff' } : { backgroundColor: '#14b8a6', color: '#042f2e' }}
                    >
                      2
                    </span>
                    <p className="leading-relaxed pt-0.5">
                      Or click <strong>⋮ Menu → "Save and share" → "Install CarePlus..."</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isInstallable ? (
                <button
                  onClick={async () => {
                    const result = await install();
                    if (result === 'accepted') {
                      setShowGuideModal(false);
                    }
                  }}
                  className="flex-1 py-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition"
                  style={
                    isLight
                      ? { backgroundColor: '#00AFA3', color: '#ffffff' }
                      : { backgroundColor: '#0f766e', color: '#ffffff' }
                  }
                >
                  <Download className="w-4 h-4" />
                  <span>Trigger 1-Click Install</span>
                </button>
              ) : null}

              <button
                onClick={() => setShowGuideModal(false)}
                className={`py-3 rounded-2xl font-semibold text-xs transition cursor-pointer ${
                  isInstallable ? 'px-5' : 'w-full'
                }`}
                style={
                  isLight
                    ? { backgroundColor: '#E1F0F7', color: '#18324A', border: '1px solid #C5DCE8' }
                    : { backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }
                }
              >
                {t(language, 'close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
