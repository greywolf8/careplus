import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { CreateCoordinationModal } from '../components/common/CreateCoordinationModal';
import { t } from '../i18n/translations';
import { WarningSign } from '../types';
import { AlertTriangle, Phone, ArrowLeft, ShieldAlert, HeartHandshake } from 'lucide-react';

export const WarningSignsView: React.FC = () => {
  const { patientContext, language, setActiveSubRoute, refreshData } = useAuth();
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [warningSigns, setWarningSigns] = useState<WarningSign[]>([]);

  useEffect(() => {
    let isMounted = true;
    dataService.getWarningSigns(patientContext.patientId).then((signs) => {
      if (isMounted) setWarningSigns(signs);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Navigation Bar with Back Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveSubRoute(null)}
          aria-label="Back to main screen"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-amber-300 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>{t(language, 'warning_signs')}</span>
          </h1>
          <p className="text-xs text-slate-400">Cardiology Emergency Protocol</p>
        </div>
      </div>

      {/* Emergency Call 112 & Contact Care Team Action Banner */}
      <div className="rounded-3xl bg-amber-950/85 border-2 border-amber-600 p-5 shadow-xl text-amber-100 space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-300 uppercase tracking-wide">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>Immediate Emergency Assistance</span>
        </div>
        <p className="text-xs leading-relaxed text-amber-200">
          {t(language, 'emergency_notice')}
        </p>

        {/* Dual Actions: Call 112 (Primary) & Contact Care Team */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href="tel:112"
            className="min-h-[50px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-98"
          >
            <Phone className="w-5 h-5" />
            <span>Call 112</span>
          </a>

          <button
            onClick={() => setShowCoordModal(true)}
            className="min-h-[50px] rounded-2xl bg-slate-900 hover:bg-slate-800 border border-amber-600/80 text-amber-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
          >
            <HeartHandshake className="w-4 h-4 text-amber-400" />
            <span>Contact Care Team</span>
          </button>
        </div>
      </div>

      {/* Notice regarding verbatim preservation */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-[11px] text-slate-400 leading-relaxed">
        {t(language, 'warning_signs_untranslated_notice')}
      </div>

      {/* List of Warning Signs (BYTE-FOR-BYTE, never translated, summarized, reworded or reordered) */}
      <div className="space-y-3">
        {warningSigns.map((sign, idx) => (
          <div
            key={sign.id}
            className="rounded-2xl bg-slate-900/90 border border-amber-800/60 p-4 text-slate-100 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-950 border border-amber-700/80 text-amber-300 text-xs font-bold mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs font-medium leading-relaxed font-sans text-slate-100">
                {sign.original_text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Contact Care Team Coordination Modal */}
      {showCoordModal && (
        <CreateCoordinationModal
          patientContext={patientContext}
          initialType="symptom-report"
          initialDescription="Emergency warning sign observed: "
          onClose={() => setShowCoordModal(false)}
          onCreated={() => refreshData()}
        />
      )}
    </div>
  );
};
