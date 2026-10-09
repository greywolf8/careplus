import React from 'react';
import { X, Heart, Shield, CheckCircle } from 'lucide-react';

export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <h3 className="text-base font-bold text-white">CarePlus Mobile</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            <strong>CarePlus</strong> is a patient and caregiver discharge and follow-up care coordinator designed for smartphone and progressive web app (PWA) environments.
          </p>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] space-y-1.5">
            <div className="text-teal-400 font-bold uppercase tracking-wider text-[10px]">
              Clinical Safety Core
            </div>
            <div>✓ Preserves verbatim hospital discharge instructions</div>
            <div>✓ Escalates all symptom and medication queries</div>
            <div>✓ Verbatim emergency warning protocol with 112 direct call</div>
            <div>✓ No automated medical diagnoses or prescribing</div>
          </div>

          <div className="text-[11px] text-slate-400">
            Version 1.0.0 · Synthetic Hospital Demo
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
