import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Users, Check, ChevronDown } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { currentUser, patientContext, switchPersona } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isCaregiver = currentUser.role === 'caregiver';
  const patientInitials = (patientContext.patientName || 'Patient')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch User Persona"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-950/70 border border-teal-800/60 text-xs text-teal-200 hover:text-white transition cursor-pointer"
      >
        {isCaregiver ? (
          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        )}
        <span className="font-medium max-w-[80px] truncate">{currentUser.name.split(' ')[0]}</span>
        <ChevronDown className="w-3 h-3 text-teal-400/80" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700/80 p-2 shadow-2xl z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Switch Persona
            </div>

            <button
              onClick={() => {
                switchPersona('patient');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                !isCaregiver
                  ? 'bg-teal-950/80 text-teal-200 border border-teal-800/50'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-800/50 flex items-center justify-center text-teal-300 text-xs font-bold">
                  {patientInitials}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{patientContext.patientName}</div>
                  <div className="text-[11px] text-teal-400">Patient (Self)</div>
                </div>
              </div>
              {!isCaregiver && (
                <Check className="w-4 h-4 text-teal-400" />
              )}
            </button>

            <button
              onClick={() => {
                switchPersona('caregiver');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left mt-1 transition cursor-pointer ${
                isCaregiver
                  ? 'bg-amber-950/80 text-amber-200 border border-amber-800/50'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-800/50 flex items-center justify-center text-amber-300 text-xs font-bold">
                  CG
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Caregiver Delegate</div>
                  <div className="text-[11px] text-amber-400">Family Member Mode</div>
                </div>
              </div>
              {isCaregiver && (
                <Check className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
