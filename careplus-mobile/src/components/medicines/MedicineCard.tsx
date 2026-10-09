import React, { useState, useEffect } from 'react';
import { Medication, AdherenceLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { dataService } from '../../services/dataService';
import { t } from '../../i18n/translations';
import { NotTakenConfirmModal } from './NotTakenConfirmModal';
import { Check, X, Pill, Clock, AlertCircle, Utensils, ShieldCheck } from 'lucide-react';

interface MedicineCardProps {
  medication: Medication;
  adherenceLog?: AdherenceLog;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({ medication, adherenceLog }) => {
  const { language, patientContext, refreshData, theme } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFullInstruction, setShowFullInstruction] = useState(false);

  const [localAdherenceStatus, setLocalAdherenceStatus] = useState<'taken' | 'not_taken' | undefined>(adherenceLog?.status);

  useEffect(() => {
    setLocalAdherenceStatus(adherenceLog?.status);
  }, [adherenceLog?.status]);

  const missingFallback = 'Needs Review';
  const isTaken = localAdherenceStatus === 'taken';
  const isNotTaken = localAdherenceStatus === 'not_taken';
  const isLight = theme === 'light';

  const handleTake = async () => {
    // Instant 0ms visual state change
    const prev = localAdherenceStatus;
    setLocalAdherenceStatus('taken');
    notifySuccess(`Recorded dose of ${medication.drug_name} as Taken.`, 'Medication Adherence');

    const res = await dataService.recordAdherence(medication.id, 'taken', patientContext);
    if (res.success) {
      refreshData();
    } else {
      setLocalAdherenceStatus(prev);
      notifyError(res.error || 'Failed to save medication adherence log.', 'Save Failed');
    }
  };

  const handleConfirmNotTaken = async () => {
    setShowConfirmModal(false);
    // Instant 0ms visual state change
    const prev = localAdherenceStatus;
    setLocalAdherenceStatus('not_taken');
    notifySuccess(`Recorded dose of ${medication.drug_name} as Not Taken.`, 'Medication Adherence');

    const res = await dataService.recordAdherence(medication.id, 'not_taken', patientContext);
    if (res.success) {
      refreshData();

      // Create a coordination card alert in the DB so the care team is notified
      try {
        await dataService.addCoordinationCard({
          patientId: patientContext.patientId,
          type: 'medication-not-taken',
          raisedBy: patientContext.role === 'caregiver' ? 'caregiver' : 'patient',
          raisedByName: patientContext.patientName || 'Patient',
          description: `${patientContext.patientName || 'Patient'} marked "${medication.drug_name}" (${medication.dose || 'dose N/A'}) as NOT TAKEN on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
          careTeamNotes: undefined,
        });
      } catch (err) {
        console.error('Failed to create coordination card for not-taken medication:', err);
      }
    } else {
      setLocalAdherenceStatus(prev);
      notifyError(res.error || 'Failed to save medication adherence log.', 'Save Failed');
    }
  };

  const getFoodRelationship = () => {
    const text = `${medication.how_often} ${medication.original_instruction}`.toLowerCase();
    if (text.includes('after food') || text.includes('after meals')) return 'After food';
    if (text.includes('before food') || text.includes('before meals')) return 'Before food';
    if (text.includes('with meals') || text.includes('with breakfast') || text.includes('with food')) return 'With meals';
    if (text.includes('at bedtime') || text.includes('hs')) return 'At bedtime';
    return missingFallback;
  };

  const foodRelationship = getFoodRelationship();

  /* ── Theme-aware style helpers ── */
  const cardStyle: React.CSSProperties = isLight
    ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', boxShadow: '0 1px 4px rgba(24,50,74,0.07)' }
    : { backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(20,184,166,0.2)' };

  const subCellStyle: React.CSSProperties = isLight
    ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8' }
    : { backgroundColor: 'rgba(2,8,23,0.6)', border: '1px solid rgba(30,41,59,0.8)' };

  const labelStyle: React.CSSProperties = isLight ? { color: '#7A9AAD' } : { color: '#64748b' };
  const valueStyle: React.CSSProperties = isLight ? { color: '#18324A' } : { color: '#e2e8f0' };
  const headingStyle: React.CSSProperties = isLight ? { color: '#18324A' } : { color: '#ffffff' };
  const dividerStyle: React.CSSProperties = { borderColor: isLight ? '#C5DCE8' : 'rgba(30,41,59,0.8)' };

  return (
    <>
      <div className="w-full rounded-2xl p-4 shadow-sm transition-all" style={cardStyle}>

        {/* Header: Drug name + status badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={isLight
                ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #A8D9D5', color: '#007A73' }
                : { backgroundColor: 'rgba(19,78,74,0.5)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}
            >
              <Pill className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold tracking-tight leading-snug" style={headingStyle}>
              {medication.drug_name || missingFallback}
            </h3>
          </div>

          {adherenceLog ? (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={isTaken
                ? isLight
                  ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
                  : { backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.7)', color: '#6ee7b7' }
                : isLight
                  ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
                  : { backgroundColor: 'rgba(120,53,15,0.8)', border: '1px solid rgba(146,64,14,0.6)', color: '#fcd34d' }}
            >
              {isTaken ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              <span>{isTaken ? t(language, 'taken') : t(language, 'not_taken')}</span>
            </span>
          ) : (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={isLight
                ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
                : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }}
            >
              <Clock className="w-3 h-3" />
              <span>Scheduled Today</span>
            </span>
          )}
        </div>

        {/* Dose / Frequency / Food / Duration grid */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          {[
            { labelKey: 'dose', value: medication.dose },
            { labelKey: 'how_often', value: medication.how_often },
            { labelKey: null, value: foodRelationship, isFood: true },
            { labelKey: 'for_how_long', value: medication.for_how_long },
          ].map((cell, i) => (
            <div key={i} className="p-2 rounded-xl" style={subCellStyle}>
              <span className="text-[10px] uppercase tracking-wider block font-semibold flex items-center gap-1" style={labelStyle}>
                {cell.isFood && <Utensils className="w-3 h-3" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />}
                <span>{cell.isFood ? 'Food Relation' : t(language, cell.labelKey!)}</span>
              </span>
              <span
                className="font-semibold mt-0.5 block truncate"
                style={cell.value === missingFallback
                  ? isLight ? { color: '#C58A00' } : { color: '#fcd34d' }
                  : valueStyle}
              >
                {cell.value || missingFallback}
              </span>
            </div>
          ))}
        </div>

        {/* Verbatim instruction */}
        <div className="p-2.5 rounded-xl text-xs mb-3" style={subCellStyle}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
              {t(language, 'verbatim_instruction')}
            </span>
            <button
              onClick={() => setShowFullInstruction(!showFullInstruction)}
              className="text-[10px] underline"
              style={isLight ? { color: '#007A73' } : { color: '#00AFA3' }}
            >
              {showFullInstruction ? 'Collapse' : 'View Instructions'}
            </button>
          </div>
          <p className="font-mono leading-relaxed text-[11px]" style={valueStyle}>
            {showFullInstruction
              ? medication.original_instruction || missingFallback
              : (medication.original_instruction || missingFallback).slice(0, 75) +
                ((medication.original_instruction || '').length > 75 ? '...' : '')}
          </p>
        </div>

        {/* Guardrail notice */}
        <div className="text-[10px] mb-3 px-1 flex items-center gap-1 italic" style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>
          <ShieldCheck className="w-3 h-3 shrink-0" style={isLight ? { color: '#007A73' } : { color: '#14b8a6' }} />
          <span>Dosing is locked to hospital discharge. Dosage adjustments require doctor review.</span>
        </div>

        {/* Logged-by attribution */}
        {adherenceLog && (
          <div className="text-[11px] mb-3 px-1 font-medium" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
            {t(language, 'logged_by', { name: adherenceLog.logged_by })}
          </div>
        )}

        {/* Taken / Not Taken buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={dividerStyle}>
          <button
            onClick={handleTake}
            className="min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
            style={isTaken
              ? isLight
                ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
                : { backgroundColor: 'rgba(6,78,59,0.9)', border: '1px solid rgba(4,120,87,0.8)', color: '#6ee7b7' }
              : { backgroundColor: '#00AFA3', color: '#ffffff', boxShadow: '0 1px 4px rgba(0,175,163,0.3)' }}
          >
            <Check className="w-4 h-4" />
            <span>Mark as Taken</span>
          </button>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
            style={isNotTaken
              ? isLight
                ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
                : { backgroundColor: 'rgba(120,53,15,0.9)', border: '1px solid rgba(146,64,14,0.8)', color: '#fcd34d' }
              : isLight
              ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
              : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }}
          >
            <X className="w-4 h-4" />
            <span>{t(language, 'not_taken')}</span>
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <NotTakenConfirmModal
          drugName={medication.drug_name}
          onConfirm={handleConfirmNotTaken}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </>
  );
};
