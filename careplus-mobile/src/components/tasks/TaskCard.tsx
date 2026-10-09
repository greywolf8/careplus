import React, { useState, useEffect } from 'react';
import { FollowupItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { dataService } from '../../services/dataService';
import { speechService } from '../../services/speechService';
import { t } from '../../i18n/translations';
import {
  Volume2,
  VolumeX,
  CheckCircle,
  Circle,
  FileText,
  MapPin,
  Clock,
  AlertCircle,
  Check,
  Calendar,
} from 'lucide-react';

interface TaskCardProps {
  item: FollowupItem;
  onOpenDetails: (item: FollowupItem) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ item, onOpenDetails }) => {
  const { language, patientContext, refreshData, theme } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [translation, setTranslation] = useState<{ title: string; instruction: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>(item.effective_status);

  useEffect(() => {
    setCurrentStatus(item.effective_status);
  }, [item.effective_status]);

  useEffect(() => {
    let isMounted = true;
    if (language !== 'en') {
      dataService.getItemTranslation(item.id, language).then((res) => {
        if (isMounted) setTranslation(res);
      });
    } else {
      setTranslation(null);
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, language]);

  const hasVerifiedTranslation = !!translation && language !== 'en';
  const displayTitle = hasVerifiedTranslation ? translation!.title : item.title;
  const displayInstruction = hasVerifiedTranslation ? translation!.instruction : item.original_text;

  const isCompleted = currentStatus === 'completed';
  const isOverdue = currentStatus === 'overdue';
  const isLight = theme === 'light';

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!patientContext.canMarkDone || isSubmitting) return;

    // 1. INSTANT optimistic visual state change
    const prevStatus = currentStatus;
    const nextStatus = prevStatus === 'completed' ? 'pending' : 'completed';
    setCurrentStatus(nextStatus);
    setIsSubmitting(true);

    notifySuccess(
      nextStatus === 'completed' ? 'Marked task as completed.' : 'Marked task as pending.',
      'Care Plan Task'
    );

    try {
      const res = await dataService.markItemDone(item.id, patientContext);
      setIsSubmitting(false);
      if (res.success) {
        refreshData();
      } else {
        // Revert on error
        setCurrentStatus(prevStatus);
        notifyError(res.error || 'Failed to update task status.', 'Task Update Failed');
      }
    } catch (err) {
      setIsSubmitting(false);
      setCurrentStatus(prevStatus);
      notifyError('Failed to update task status.', 'Task Update Failed');
    }
  };

  const handleListen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      speechService.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speechService.speak(`${displayTitle}. ${displayInstruction}`, language,
        () => setIsSpeaking(false), () => setIsSpeaking(false));
    }
  };

  const handleToggleOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOriginal((prev) => !prev);
  };

  /* ── Card background / border based on status + theme ── */
  const cardStyle: React.CSSProperties = isLight
    ? isCompleted
      ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8', boxShadow: 'none', opacity: 0.85 }
      : isOverdue
      ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', boxShadow: '0 1px 4px rgba(197,138,0,0.10)' }
      : { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', boxShadow: '0 1px 4px rgba(24,50,74,0.07)' }
    : isCompleted
    ? { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,1)' }
    : isOverdue
    ? { background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(120,53,15,0.6)' }
    : { background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(20,184,166,0.2)' };

  /* ── Status chip ── */
  const renderStatusChip = () => {
    switch (currentStatus) {
      case 'completed':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={isLight
              ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
              : { backgroundColor: 'rgba(6,78,59,0.7)', border: '1px solid rgba(4,120,87,0.6)', color: '#6ee7b7' }}
          >
            <Check className="w-3 h-3" />
            <span>{t(language, 'marked_done')}</span>
          </span>
        );
      case 'overdue':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={isLight
              ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
              : { backgroundColor: 'rgba(120,53,15,0.8)', border: '1px solid rgba(146,64,14,0.7)', color: '#fcd34d' }}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Overdue</span>
          </span>
        );
      case 'needs_review':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={isLight
              ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA', color: '#2B5F8A' }
              : { backgroundColor: 'rgba(30,58,138,0.7)', border: '1px solid rgba(30,64,175,0.6)', color: '#93c5fd' }}
          >
            <Clock className="w-3 h-3" />
            <span>In Review</span>
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={isLight
              ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
              : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }}
          >
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onOpenDetails(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenDetails(item)}
      className="relative w-full rounded-2xl p-4 transition-all text-left cursor-pointer active:scale-[0.99]"
      style={cardStyle}
    >
      {/* Date + Category + Status row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          className="flex items-center gap-1.5 text-xs font-medium truncate"
          style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}
        >
          {item.category === 'appointment' ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={isLight
                ? { backgroundColor: '#E8F3FC', color: '#1E4D78', border: '1px solid #B8D4EA' }
                : { backgroundColor: 'rgba(30,58,138,0.6)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)' }}
            >
              <Calendar className="w-3 h-3" />
              <span>Appointment</span>
            </span>
          ) : null}
          <span>{item.due_date}</span>
          {item.due_time && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold" style={isLight ? { color: '#18324A' } : { color: '#e2e8f0' }}>{item.due_time}</span>
            </>
          )}
        </div>
        <div>{renderStatusChip()}</div>
      </div>

      {/* Title */}
      <h3
        className="text-sm font-semibold leading-snug tracking-tight mb-1.5"
        style={isLight
          ? { color: isCompleted ? '#7A9AAD' : '#18324A', textDecoration: isCompleted ? 'line-through' : 'none' }
          : { color: isCompleted ? '#64748b' : '#f1f5f9', textDecoration: isCompleted ? 'line-through' : 'none' }}
      >
        {displayTitle}
      </h3>

      {/* Unverified translation warning */}
      {!hasVerifiedTranslation && language !== 'en' && (
        <div
          className="mb-2 p-1.5 rounded-lg text-[11px]"
          style={isLight
            ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
            : { backgroundColor: 'rgba(120,53,15,0.4)', border: '1px solid rgba(120,53,15,0.4)', color: '#fcd34d' }}
        >
          {t(language, 'please_confirm_team')}
        </div>
      )}

      {/* Verbatim original text toggle */}
      {showOriginal && (
        <div
          className="mb-3 p-2.5 rounded-xl text-xs font-mono leading-relaxed"
          style={isLight
            ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8', color: '#18324A' }
            : { backgroundColor: 'rgba(2,8,23,1)', border: '1px solid rgba(30,41,59,1)', color: '#cbd5e1' }}
        >
          <div className="text-[10px] uppercase font-bold mb-1" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
            Verbatim Medical Text
          </div>
          {item.original_text}
        </div>
      )}

      {/* Provider suggestion */}
      {item.provider_suggestion && (
        <div
          className="flex items-center gap-1.5 text-xs mb-3 px-2.5 py-1.5 rounded-xl"
          style={isLight
            ? { backgroundColor: 'rgba(0,175,163,0.08)', border: '1px solid #A8D9D5', color: '#007A73' }
            : { backgroundColor: 'rgba(19,78,74,0.4)', border: '1px solid rgba(20,184,166,0.2)', color: '#5eead4' }}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{item.provider_suggestion.name}</span>
          {item.provider_suggestion.location && (
            <span className="shrink-0 text-[11px]" style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>
              ({item.provider_suggestion.location})
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div
        className="flex items-center justify-between pt-2 gap-2"
        style={{ borderTop: isLight ? '1px solid #C5DCE8' : '1px solid rgba(30,41,59,0.8)' }}
      >
        <div className="flex items-center gap-1.5">
          {/* Listen */}
          <button
            type="button"
            onClick={handleListen}
            aria-label={isSpeaking ? t(language, 'stop_listening') : t(language, 'listen')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            style={isSpeaking
              ? { backgroundColor: '#00AFA3', color: '#ffffff' }
              : isLight
              ? { backgroundColor: '#D4EEF7', border: '1px solid #C5DCE8', color: '#007A73' }
              : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#5eead4' }}
          >
            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isSpeaking ? t(language, 'stop_listening') : t(language, 'listen')}</span>
          </button>

          {/* Original text toggle */}
          <button
            type="button"
            onClick={handleToggleOriginal}
            aria-label="View original verbatim prescription text"
            className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition active:scale-95 cursor-pointer"
            style={isLight
              ? { backgroundColor: '#D4EEF7', border: '1px solid #C5DCE8', color: '#587084' }
              : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t(language, 'original')}</span>
          </button>
        </div>

        {/* Mark done */}
        {patientContext.canMarkDone && (
          <button
            type="button"
            onClick={handleToggleDone}
            disabled={isSubmitting}
            aria-label={isCompleted ? 'Mark as incomplete' : t(language, 'mark_done')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            style={isCompleted
              ? isLight
                ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
                : { backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.8)', color: '#6ee7b7' }
              : { backgroundColor: '#00AFA3', color: '#ffffff', boxShadow: '0 1px 4px rgba(0,175,163,0.25)' }}
          >
            {isCompleted ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>{t(language, 'marked_done')}</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4" />
                <span>{t(language, 'mark_done')}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Completion attribution */}
      {isCompleted && item.completed_by && (
        <div className="mt-2 text-[10px] font-medium" style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>
          {t(language, 'logged_by', { name: item.completed_by })}
        </div>
      )}
    </div>
  );
};
