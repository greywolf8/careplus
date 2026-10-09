import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n/translations';
import { AlertCircle } from 'lucide-react';

interface NotTakenConfirmModalProps {
  drugName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const NotTakenConfirmModal: React.FC<NotTakenConfirmModalProps> = ({
  drugName,
  onConfirm,
  onCancel,
}) => {
  const { language } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400 mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-center text-white">
          {t(language, 'not_taken_confirm_title')}
        </h3>

        <p className="text-xs text-center text-slate-400 mt-1.5 font-medium">
          {drugName}
        </p>

        <p className="text-xs text-center text-amber-300/90 mt-2 bg-amber-950/40 p-2.5 rounded-xl border border-amber-900/50">
          {t(language, 'not_taken_confirm_desc')}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            {t(language, 'cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition"
          >
            {t(language, 'confirm_save')}
          </button>
        </div>
      </div>
    </div>
  );
};
