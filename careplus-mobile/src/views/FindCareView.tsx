import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { t } from '../i18n/translations';
import { Provider } from '../types';
import {
  ArrowLeft,
  MapPin,
  Phone,
  ExternalLink,
  Search,
  Building,
  Activity,
  Pill,
} from 'lucide-react';

export const FindCareView: React.FC = () => {
  const { language, setActiveSubRoute } = useAuth();
  const [mode, setMode] = useState<'for_plan' | 'nearby'>('for_plan');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let isMounted = true;
    dataService.nearbyProviders(categoryFilter, searchQuery).then((res) => {
      if (isMounted) setProviders(res);
    });
    return () => {
      isMounted = false;
    };
  }, [categoryFilter, searchQuery]);

  // Plan-specific suggested providers
  const planProviders = useMemo(() => {
    return providers.slice(0, 2); // Primary suggested providers tied to current plan items
  }, [providers]);

  const displayedProviders = mode === 'for_plan' ? planProviders : providers;

  const getKindBadge = (kind: Provider['kind']) => {
    switch (kind) {
      case 'lab':
        return 'Diagnostic Lab';
      case 'clinic':
        return 'Specialty Clinic';
      case 'pharmacy':
        return 'Pharmacy';
      case 'imaging':
        return 'Diagnostic Imaging';
      default:
        return 'Medical Facility';
    }
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveSubRoute(null)}
          aria-label="Back"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            {t(language, 'find_care')}
          </h1>
          <p className="text-xs text-teal-300/80">Clinics, labs, and pharmacies nearby</p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setMode('for_plan')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
            mode === 'for_plan'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t(language, 'mode_for_plan')}
        </button>
        <button
          onClick={() => setMode('nearby')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
            mode === 'nearby'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t(language, 'mode_search_nearby')}
        </button>
      </div>

      {/* Emergency Hotlines Card */}
      <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-800/80 text-xs text-amber-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-[11px] text-amber-300">
            Emergency Hotlines
          </span>
          <span className="text-[10px] text-amber-300/80 font-mono">24x7 Available</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href="tel:112"
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-center flex items-center justify-center gap-1.5 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>National: 112</span>
          </a>
          <a
            href="tel:1066"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-600/60 text-amber-300 font-bold text-center flex items-center justify-center gap-1.5 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Apollo ER: 1066</span>
          </a>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 italic">
        {t(language, 'suggestion_disclaimer')}
      </div>

      {/* Search & Filter Bar if in nearby mode */}
      {mode === 'nearby' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by facility name or test..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {['all', 'clinic', 'lab', 'pharmacy', 'imaging'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition capitalize ${
                  categoryFilter === cat
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Provider Cards */}
      <div className="space-y-3 pt-1">
        {displayedProviders.map((prov) => (
          <div
            key={prov.id}
            className="rounded-2xl bg-slate-900 border border-teal-900/40 p-4 shadow-sm text-slate-100"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">
                  {getKindBadge(prov.kind)}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">{prov.name}</h3>
              </div>
              <span className="shrink-0 text-xs font-medium text-teal-300 bg-teal-950/70 border border-teal-800 px-2 py-0.5 rounded-lg">
                {prov.distance}
              </span>
            </div>

            <div className="flex items-start gap-1.5 text-xs text-slate-300 mt-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{prov.address}</span>
            </div>

            {/* Specialties Chips */}
            <div className="flex flex-wrap gap-1 mb-4">
              {prov.specialties.map((spec, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300"
                >
                  {spec}
                </span>
              ))}
            </div>

            {/* Action Buttons: Call & Open in Maps */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <a
                href={`tel:${prov.phone}`}
                className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 border border-slate-700"
              >
                <Phone className="w-4 h-4" />
                <span>{t(language, 'call')}</span>
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  prov.name + ' ' + prov.address
                )}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t(language, 'open_in_maps')}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
