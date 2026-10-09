import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Language } from '../../types';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useAuth();

  const languages: { code: Language; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिंदी', short: 'हिं' },
    { code: 'ta', label: 'தமிழ்', short: 'தமி' },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-teal-950/70 border border-teal-800/60 rounded-xl p-0.5 text-xs text-slate-300">
      <div className="px-1.5 text-teal-400">
        <Globe className="w-3.5 h-3.5" />
      </div>
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLanguage(l.code)}
          aria-label={`Switch language to ${l.label}`}
          className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-medium transition-all ${
            language === l.code
              ? 'bg-teal-600 text-white shadow-sm font-semibold'
              : 'text-teal-200/80 hover:text-white hover:bg-teal-900/40'
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
};
