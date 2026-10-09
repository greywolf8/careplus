import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n/translations';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { isOnline, language } = useAuth();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md z-40 sticky top-0 animate-in slide-in-from-top duration-150 no-print">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{t(language, 'offline_banner')}</span>
    </div>
  );
};
