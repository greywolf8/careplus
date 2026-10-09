import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { MedicineCard } from '../components/medicines/MedicineCard';
import { t } from '../i18n/translations';
import { Medication, AdherenceLog } from '../types';
import { Pill, ShieldCheck } from 'lucide-react';

export const MedicinesView: React.FC = () => {
  const { patientContext, language, theme } = useAuth();
  const isLight = theme === 'light';
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayAdherence, setTodayAdherence] = useState<AdherenceLog[]>([]);

  useEffect(() => {
    let isMounted = true;
    const patId = patientContext.patientId;
    dataService.getMedications(patId).then((meds) => {
      if (isMounted) setMedications(meds);
    });
    dataService.getAdherenceLogs(patId, '2026-10-08').then((logs) => {
      if (isMounted) setTodayAdherence(logs);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const adherenceMap = useMemo(() => {
    const map = new Map<string, AdherenceLog>();
    todayAdherence.forEach((log) => map.set(log.medication_id, log));
    return map;
  }, [todayAdherence]);

  const takenCount = todayAdherence.filter((l) => l.status === 'taken').length;

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">

      {/* Header summary card */}
      <div
        className="rounded-3xl p-5 shadow-sm"
        style={isLight
          ? { background: 'linear-gradient(135deg, #D4EEF7 0%, #E8F5FB 100%)', border: '1px solid #B8D9E8', boxShadow: '0 2px 10px rgba(24,50,74,0.07)' }
          : { backgroundColor: '#0f172a', border: '1px solid rgba(20,184,166,0.25)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
              Prescription Regimen
            </span>
            <h1 className="text-xl font-bold tracking-tight mt-0.5" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
              {t(language, 'medicines')}
            </h1>
          </div>
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
            style={isLight
              ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #A8D9D5', color: '#007A73' }
              : { backgroundColor: 'rgba(19,78,74,0.5)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}
          >
            <Pill className="w-5 h-5" />
          </div>
        </div>

        <div
          className="mt-4 pt-3 flex items-center justify-between text-xs"
          style={{ borderTop: isLight ? '1px solid #C5DCE8' : '1px solid rgba(30,41,59,1)' }}
        >
          <span style={isLight ? { color: '#587084' } : { color: '#cbd5e1' }}>
            Today's Check-ins:{' '}
            <strong style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
              {takenCount} of {medications.length} logged taken
            </strong>
          </span>
          <span className="font-semibold" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
            08 Oct 2026
          </span>
        </div>
      </div>

      {/* Safety notice */}
      <div
        className="rounded-2xl p-3 flex items-start gap-2.5"
        style={isLight
          ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA' }
          : { backgroundColor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(30,41,59,1)' }}
      >
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
        <p className="leading-relaxed text-[11px]" style={isLight ? { color: '#2B5F8A' } : { color: '#94a3b8' }}>
          Instructions are shown verbatim from your hospital prescription. Never adjust doses or stop cardiac medications without consulting your cardiologist.
        </p>
      </div>

      {/* Medicine cards */}
      <div className="space-y-3.5">
        {medications.map((med) => (
          <MedicineCard key={med.id} medication={med} adherenceLog={adherenceMap.get(med.id)} />
        ))}
      </div>
    </div>
  );
};
