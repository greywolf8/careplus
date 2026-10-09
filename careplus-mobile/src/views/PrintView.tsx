import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { t } from '../i18n/translations';
import { FollowupItem, Medication, WarningSign, Provider } from '../types';
import { ArrowLeft, Printer, Share2, AlertTriangle, Phone } from 'lucide-react';

export const PrintView: React.FC = () => {
  const { patientContext, language, setActiveSubRoute } = useAuth();
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [warningSigns, setWarningSigns] = useState<WarningSign[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let isMounted = true;
    const patId = patientContext.patientId;
    dataService.getEffectiveItems(patId).then((res) => {
      if (isMounted) setItems(res.filter((i) => i.effective_status !== 'needs_review'));
    });
    dataService.getMedications(patId).then((res) => {
      if (isMounted) setMedications(res);
    });
    dataService.getWarningSigns(patId).then((res) => {
      if (isMounted) setWarningSigns(res);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const appointments = useMemo(() => items.filter((i) => i.category === 'appointment'), [items]);
  const tests = useMemo(() => items.filter((i) => i.category === 'test'), [items]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header (Hidden when printing) */}
      <div className="flex items-center justify-between gap-2 no-print">
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
              {t(language, 'print_plan')}
            </h1>
            <p className="text-xs text-teal-300/80">Printable discharge summary document</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="min-h-[44px] px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>{t(language, 'print')}</span>
        </button>
      </div>

      {/* A4 Single Column Printable Document */}
      <div className="rounded-3xl bg-white text-slate-900 p-6 shadow-xl border border-slate-200 space-y-6">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-widest text-teal-800">
              CarePlus Follow-up Coordination Summary
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">
              {patientContext.patientName}
            </h2>
            <div className="text-xs text-slate-600 mt-0.5">
              Apollo Speciality Hospitals · Greams Road, Chennai
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div>Discharge: 04 Oct 2026</div>
            <div>Printed: 08 Oct 2026</div>
          </div>
        </div>

        {/* Diagnosis & Attending Cardiologist */}
        <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-1">
          <div>
            <strong>Diagnosis:</strong> Post-PCI to LAD with Drug-Eluting Stent, Type 2 DM, HTN
          </div>
          <div>
            <strong>Cardiologist:</strong> Dr. Anita Sharma, MD DM (Cardiology)
          </div>
        </div>

        {/* 1. Critical Warning Signs (Byte-for-byte, prominent) */}
        <div>
          <h3 className="text-xs uppercase font-black tracking-wider text-amber-700 border-b border-amber-300 pb-1 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Emergency Warning Signs (Emergency Call: 112)</span>
          </h3>
          <ul className="list-disc pl-5 text-xs text-slate-800 space-y-1">
            {warningSigns.map((w) => (
              <li key={w.id} className="leading-relaxed">
                {w.original_text}
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Prescribed Medications */}
        <div>
          <h3 className="text-xs uppercase font-black tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Prescription Medications (Verbatim)
          </h3>
          <div className="space-y-2">
            {medications.map((m) => (
              <div key={m.id} className="text-xs border-b border-slate-100 pb-1.5">
                <div className="font-bold text-slate-900">
                  {m.drug_name} — {m.dose} ({m.how_often})
                </div>
                <div className="text-slate-600 text-[11px] font-mono mt-0.5">
                  {m.original_instruction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Follow-up Appointments */}
        <div>
          <h3 className="text-xs uppercase font-black tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Scheduled Appointments
          </h3>
          <div className="space-y-1.5 text-xs">
            {appointments.map((a) => (
              <div key={a.id} className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold">{a.title}</span>
                <span className="text-slate-600 font-mono">
                  {a.due_date} {a.due_time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Scheduled Tests */}
        <div>
          <h3 className="text-xs uppercase font-black tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Laboratory & Diagnostic Tests
          </h3>
          <div className="space-y-1.5 text-xs">
            {tests.map((tItem) => (
              <div key={tItem.id} className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold">{tItem.title}</span>
                <span className="text-slate-600 font-mono">{tItem.due_date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Synthetic Care Providers & Emergency Contact */}
        <div>
          <h3 className="text-xs uppercase font-black tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Emergency Contacts & Care Facilities
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {providers.slice(0, 4).map((p) => (
              <div key={p.id} className="p-2 bg-slate-50 rounded-lg">
                <div className="font-bold">{p.name}</div>
                <div className="text-[11px] text-slate-600">{p.address}</div>
                <div className="text-[11px] text-teal-800 font-semibold">{p.phone}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer Footer */}
        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 text-center leading-relaxed">
          CarePlus Discharge Coordination Summary · Intended for patient and caregiver reference · Not a replacement for official medical discharge records.
        </div>
      </div>
    </div>
  );
};
