import React, { useState, useEffect } from 'react';
import { FollowupItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { dataService } from '../../services/dataService';
import { speechService } from '../../services/speechService';
import { t } from '../../i18n/translations';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  FileText,
  UserCheck,
  Check,
  Phone,
} from 'lucide-react';

interface TaskDetailSheetProps {
  itemId: string | null;
  onClose: () => void;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({ itemId, onClose }) => {
  const { language, patientContext, refreshData, theme } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [item, setItem] = useState<FollowupItem | null>(null);
  const [translation, setTranslation] = useState<{ title: string; instruction: string } | null>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    let isMounted = true;
    if (itemId) {
      dataService.getItemById(itemId).then((res) => {
        if (isMounted) setItem(res);
      });
      if (language !== 'en') {
        dataService.getItemTranslation(itemId, language).then((res) => {
          if (isMounted) setTranslation(res);
        });
      } else {
        setTranslation(null);
      }
    }
    return () => {
      isMounted = false;
    };
  }, [itemId, language]);

  if (!itemId || !item) return null;

  const hasVerifiedTranslation = !!translation && language !== 'en';
  const displayTitle = hasVerifiedTranslation ? translation.title : item.title;
  const displayInstruction = hasVerifiedTranslation
    ? translation.instruction
    : item.original_text;

  const isCompleted = item.effective_status === 'completed';

  const handleToggleDone = async () => {
    if (!patientContext.canMarkDone) return;
    const nextStatus = isCompleted ? 'pending' : 'completed';
    
    // 1. Instant optimistic update
    setItem((prev) => prev ? { ...prev, effective_status: nextStatus } : prev);
    notifySuccess(
      nextStatus === 'completed' ? 'Marked task as completed.' : 'Marked task as pending.',
      'Care Plan Task'
    );

    try {
      const res = await dataService.markItemDone(item.id, patientContext);
      if (res.success) {
        if (res.item) setItem(res.item);
        refreshData();
      } else {
        // Revert on error
        setItem((prev) => prev ? { ...prev, effective_status: isCompleted ? 'completed' : 'pending' } : prev);
        notifyError(res.error || 'Failed to update task status.', 'Task Update Failed');
      }
    } catch (err) {
      setItem((prev) => prev ? { ...prev, effective_status: isCompleted ? 'completed' : 'pending' } : prev);
      notifyError('Failed to update task status.', 'Task Update Failed');
    }
  };

  const handleSpeak = () => {
    speechService.speak(`${displayTitle}. ${displayInstruction}`, language);
  };

  const sourceLabel =
    item.source === 'doctor_added' && item.added_by
      ? t(language, 'added_by', { author: item.added_by })
      : t(language, 'from_discharge_summary');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop tap to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Modal Container */}
      <div
        className="relative w-full max-w-lg border-t rounded-t-3xl p-5 shadow-2xl max-h-[85dvh] overflow-y-auto no-scrollbar pb-safe animate-in slide-in-from-bottom duration-200 z-10"
        style={
          isLight
            ? { backgroundColor: '#F2F7FC', borderColor: '#C5DCE8', color: '#18324A' }
            : { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }
        }
      >
        {/* Mobile Drag Handle */}
        <div
          className="w-12 h-1.5 rounded-full mx-auto mb-4"
          style={isLight ? { backgroundColor: '#C5DCE8' } : { backgroundColor: '#334155' }}
        />

        {/* Top Header */}
        <div
          className="flex items-start justify-between gap-3 pb-3 border-b"
          style={isLight ? { borderColor: '#DCEBF3' } : { borderColor: '#1e293b' }}
        >
          <div className="min-w-0">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}
            >
              {sourceLabel}
            </span>
            <h2
              className="text-base font-bold mt-0.5 leading-snug"
              style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}
            >
              {displayTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer"
            style={isLight ? { backgroundColor: '#E1F0F7', color: '#587084' } : { backgroundColor: '#1e293b', color: '#94a3b8' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Date Chips */}
        <div className="flex flex-wrap items-center gap-2 my-4">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border"
            style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8', color: '#18324A' } : { backgroundColor: '#1e293b', borderColor: '#334155', color: '#cbd5e1' }}
          >
            <Calendar className="w-3.5 h-3.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
            <span>{item.due_date}</span>
            {item.due_time && <span>· {item.due_time}</span>}
          </div>

          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border"
            style={
              isCompleted
                ? isLight
                  ? { backgroundColor: '#E4F6F1', borderColor: '#A8DFC9', color: '#1A7A50' }
                  : { backgroundColor: 'rgba(6,78,59,0.8)', borderColor: 'rgba(4,120,87,0.7)', color: '#6ee7b7' }
                : item.effective_status === 'overdue'
                ? isLight
                  ? { backgroundColor: '#FFF5D9', borderColor: '#F5D57A', color: '#C58A00' }
                  : { backgroundColor: 'rgba(120,53,15,0.8)', borderColor: 'rgba(146,64,14,0.6)', color: '#fcd34d' }
                : isLight
                ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8', color: '#587084' }
                : { backgroundColor: '#1e293b', borderColor: '#334155', color: '#94a3b8' }
            }
          >
            {isCompleted ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span className="capitalize">{item.effective_status}</span>
          </div>
        </div>

        {/* Original Verbatim Instruction Section */}
        <div
          className="my-4 p-3.5 rounded-2xl border"
          style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: '#020817', borderColor: '#1e293b' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}>
              <FileText className="w-3.5 h-3.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
              <span>Verbatim Instruction</span>
            </div>
            <button
              onClick={handleSpeak}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition cursor-pointer"
              style={isLight ? { backgroundColor: '#D4EEF7', color: '#007A73' } : { backgroundColor: '#1e293b', color: '#2dd4bf' }}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t(language, 'listen')}</span>
            </button>
          </div>
          <p
            className="text-xs font-mono leading-relaxed p-2.5 rounded-xl border"
            style={isLight ? { backgroundColor: '#F0F8FD', borderColor: '#C5DCE8', color: '#18324A' } : { backgroundColor: 'rgba(15,23,42,0.6)', borderColor: '#1e293b', color: '#cbd5e1' }}
          >
            {item.original_text}
          </p>
        </div>

        {/* Translation fallback notice */}
        {!hasVerifiedTranslation && language !== 'en' && (
          <div
            className="mb-4 p-2.5 rounded-xl border text-xs flex items-center gap-2"
            style={isLight ? { backgroundColor: '#FFF5D9', borderColor: '#F5D57A', color: '#C58A00' } : { backgroundColor: 'rgba(120,53,15,0.4)', borderColor: 'rgba(120,53,15,0.4)', color: '#fcd34d' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t(language, 'please_confirm_team')}</span>
          </div>
        )}

        {/* Provider Suggestion */}
        {item.provider_suggestion && (
          <div
            className="my-4 p-3.5 rounded-2xl border"
            style={isLight ? { backgroundColor: '#EAF4FA', borderColor: '#C5DCE8' } : { backgroundColor: 'rgba(19,78,74,0.4)', borderColor: 'rgba(20,184,166,0.3)' }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
              style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}
            >
              {t(language, 'provider_suggestion_label')}
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
              <div className="text-xs">
                <div className="font-semibold" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                  {item.provider_suggestion.name}
                </div>
                {item.provider_suggestion.location && (
                  <div className="mt-0.5" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                    {item.provider_suggestion.location}
                  </div>
                )}
                {item.provider_suggestion.phone && (
                  <a
                    href={`tel:${item.provider_suggestion.phone}`}
                    className="inline-flex items-center gap-1 hover:underline mt-1 font-medium"
                    style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}
                  >
                    <Phone className="w-3 h-3" />
                    <span>{item.provider_suggestion.phone}</span>
                  </a>
                )}
              </div>
            </div>
            <div className="mt-2 text-[10px] italic" style={isLight ? { color: '#7A9AAD' } : { color: 'rgba(94,234,212,0.8)' }}>
              {t(language, 'suggestion_disclaimer')}
            </div>
          </div>
        )}

        {/* Logged by Info if completed */}
        {isCompleted && item.completed_by && (
          <div
            className="flex items-center gap-2 text-xs mb-4 p-2.5 rounded-xl border font-medium"
            style={isLight ? { backgroundColor: '#E4F6F1', borderColor: '#A8DFC9', color: '#1A7A50' } : { backgroundColor: 'rgba(6,78,59,0.3)', borderColor: 'rgba(4,120,87,0.4)', color: '#6ee7b7' }}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>{t(language, 'logged_by', { name: item.completed_by })}</span>
          </div>
        )}

        {/* Action Button */}
        {patientContext.canMarkDone && (
          <div className="pt-2">
            <button
              onClick={handleToggleDone}
              className="w-full min-h-[48px] rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-98 cursor-pointer"
              style={
                isCompleted
                  ? isLight
                    ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
                    : { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1' }
                  : isLight
                  ? { backgroundColor: '#00AFA3', color: '#ffffff', boxShadow: '0 4px 12px rgba(0, 175, 163, 0.25)' }
                  : { backgroundColor: '#0f766e', color: '#ffffff' }
              }
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Mark as Incomplete</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>{t(language, 'mark_done')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
