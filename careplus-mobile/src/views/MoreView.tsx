import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SubRoute } from '../types';
import { t } from '../i18n/translations';
import { AboutModal } from './AboutModal';
import {
  AlertTriangle,
  FileCheck,
  MapPin,
  Clock,
  Settings,
  Printer,
  Info,
  ChevronRight,
  Phone,
} from 'lucide-react';

export const MoreView: React.FC = () => {
  const { language, setActiveSubRoute, canSeeSubRoute, theme } = useAuth();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const isLight = theme === 'light';

  type MenuItem = {
    id: SubRoute | 'about';
    labelKey: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    iconStyle: React.CSSProperties;
  };

  const menuItems: MenuItem[] = [
    {
      id: 'warning_signs',
      labelKey: 'warning_signs',
      description: 'Critical emergency signs and call 112',
      icon: AlertTriangle,
      iconStyle: isLight
        ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
        : { backgroundColor: 'rgba(120,53,15,0.7)', border: '1px solid rgba(146,64,14,0.8)', color: '#fbbf24' },
    },
    {
      id: 'tests',
      labelKey: 'tests_results',
      description: 'Scheduled lab tests and released results',
      icon: FileCheck,
      iconStyle: isLight
        ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #A8D9D5', color: '#007A73' }
        : { backgroundColor: 'rgba(19,78,74,0.7)', border: '1px solid rgba(20,184,166,0.5)', color: '#2dd4bf' },
    },
    {
      id: 'find_care',
      labelKey: 'find_care',
      description: 'Clinics, diagnostic labs, and pharmacies',
      icon: MapPin,
      iconStyle: isLight
        ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA', color: '#2B5F8A' }
        : { backgroundColor: 'rgba(30,58,138,0.7)', border: '1px solid rgba(37,99,235,0.5)', color: '#60a5fa' },
    },
    {
      id: 'reminders',
      labelKey: 'reminders',
      description: 'Simulated WhatsApp and SMS notifications',
      icon: Clock,
      iconStyle: isLight
        ? { backgroundColor: '#F3EEFF', border: '1px solid #D4B8F0', color: '#7C3AED' }
        : { backgroundColor: 'rgba(88,28,135,0.7)', border: '1px solid rgba(109,40,217,0.5)', color: '#c084fc' },
    },
    {
      id: 'settings',
      labelKey: 'settings',
      description: 'Language, caregiver access, and PWA setup',
      icon: Settings,
      iconStyle: isLight
        ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
        : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' },
    },
    {
      id: 'print',
      labelKey: 'print',
      description: 'A4 discharge summary document',
      icon: Printer,
      iconStyle: isLight
        ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
        : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' },
    },
    {
      id: 'about',
      labelKey: 'about',
      description: 'Clinical safety protocols and app information',
      icon: Info,
      iconStyle: isLight
        ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
        : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' },
    },
  ];

  const handleItemClick = (id: SubRoute | 'about') => {
    if (id === 'about') setShowAboutModal(true);
    else setActiveSubRoute(id);
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-lg font-bold tracking-tight" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
          More Options
        </h1>
        <p className="text-xs" style={isLight ? { color: '#007A73' } : { color: 'rgba(94,234,212,0.8)' }}>
          Support, clinical records, and settings
        </p>
      </div>

      {/* Emergency quick-dial card */}
      <div
        className="rounded-2xl p-3.5 flex items-center justify-between"
        style={isLight
          ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', boxShadow: '0 1px 4px rgba(197,138,0,0.10)' }
          : { backgroundColor: 'rgba(120,53,15,0.6)', border: '1px solid rgba(146,64,14,0.7)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={isLight
              ? { backgroundColor: '#FDEFC3', border: '1px solid #F5D57A', color: '#C58A00' }
              : { backgroundColor: 'rgba(146,64,14,0.8)', color: '#fcd34d' }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold" style={isLight ? { color: '#7A4F00' } : { color: '#fde68a' }}>
              Emergency Protocol
            </div>
            <div className="text-[11px]" style={isLight ? { color: '#C58A00' } : { color: 'rgba(253,230,138,0.8)' }}>
              National Emergency Services
            </div>
          </div>
        </div>
        <a
          href="tel:112"
          className="min-h-[40px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
          style={{ backgroundColor: '#C58A00', color: '#ffffff' }}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Call 112</span>
        </a>
      </div>

      {/* Menu list */}
      <div
        className="rounded-3xl overflow-hidden shadow-sm"
        style={isLight
          ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8' }
          : { backgroundColor: '#0f172a', border: '1px solid rgba(20,184,166,0.15)' }}
      >
        {menuItems.map((item, idx) => {
          if (item.id !== 'about' && !canSeeSubRoute(item.id as SubRoute)) return null;
          const Icon = item.icon;
          const isLast = idx === menuItems.length - 1;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className="w-full min-h-[58px] p-3.5 flex items-center justify-between transition text-left active:opacity-80"
              style={{
                borderBottom: isLast ? 'none' : isLight ? '1px solid #D4E9F4' : '1px solid rgba(30,41,59,0.8)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = isLight
                  ? 'rgba(0,175,163,0.06)' : 'rgba(30,41,59,0.6)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={item.iconStyle}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-tight truncate" style={isLight ? { color: '#18324A' } : { color: '#f1f5f9' }}>
                    {t(language, item.labelKey)}
                  </div>
                  <div className="text-[11px] truncate mt-0.5" style={isLight ? { color: '#587084' } : { color: '#64748b' }}>
                    {item.description}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 ml-2" style={isLight ? { color: '#7A9AAD' } : { color: '#475569' }} />
            </button>
          );
        })}
      </div>

      {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}
    </div>
  );
};
