import React from 'react';
import { CoordinationCard as CoordinationCardModel, CoordinationCardStatus } from '../../types';
import { Clock, CheckCircle2, AlertCircle, MessageSquareQuote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CoordinationCardProps {
  card: CoordinationCardModel;
  onUpdateStatus?: (status: CoordinationCardStatus) => void;
  isCaregiver?: boolean;
}

export const CoordinationCard: React.FC<CoordinationCardProps> = ({ card, onUpdateStatus, isCaregiver }) => {
  const { theme } = useAuth();
  const isLight = theme === 'light';

  /* ── Type badge styles ── */
  const getTypeBadge = (type: CoordinationCardModel['type']) => {
    if (isLight) {
      switch (type) {
        case 'medication-delay':
          return { label: 'Medication Delay',         style: { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#7A4F00' } };
        case 'appointment-question':
          return { label: 'Appointment Inquiry',      style: { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA', color: '#1E4D78' } };
        case 'test-delay':
          return { label: 'Diagnostic Test Delay',    style: { backgroundColor: '#F3EEFF', border: '1px solid #D4B8F0', color: '#5B21B6' } };
        case 'symptom-report':
          return { label: 'Symptom Clinical Report',  style: { backgroundColor: '#FDE8E8', border: '1px solid #F5B8B8', color: '#9B1C1C' } };
        case 'unclear-instruction':
          return { label: 'Instruction Clarification',style: { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' } };
        default:
          return { label: 'Care Team Review',          style: { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' } };
      }
    } else {
      switch (type) {
        case 'medication-delay':      return { label: 'Medication Delay',          style: { backgroundColor: 'rgba(120,53,15,0.7)', border: '1px solid rgba(146,64,14,0.8)', color: '#fbbf24' } };
        case 'appointment-question':  return { label: 'Appointment Inquiry',       style: { backgroundColor: 'rgba(30,58,138,0.7)', border: '1px solid rgba(30,64,175,0.8)', color: '#60a5fa' } };
        case 'test-delay':            return { label: 'Diagnostic Test Delay',     style: { backgroundColor: 'rgba(88,28,135,0.7)', border: '1px solid rgba(109,40,217,0.8)', color: '#c084fc' } };
        case 'symptom-report':        return { label: 'Symptom Clinical Report',   style: { backgroundColor: 'rgba(136,19,55,0.7)', border: '1px solid rgba(159,18,57,0.8)', color: '#fb7185' } };
        case 'unclear-instruction':   return { label: 'Instruction Clarification', style: { backgroundColor: 'rgba(19,78,74,0.7)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' } };
        default:                      return { label: 'Care Team Review',           style: { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' } };
      }
    }
  };

  /* ── Status badge ── */
  const renderStatus = () => {
    switch (card.status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={isLight
              ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
              : { backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.8)', color: '#6ee7b7' }}>
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolved</span>
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={isLight
              ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA', color: '#2B5F8A' }
              : { backgroundColor: 'rgba(30,58,138,0.8)', border: '1px solid rgba(37,99,235,0.7)', color: '#93c5fd' }}>
            <Clock className="w-3 h-3" />
            <span>Acknowledged</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={isLight
              ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
              : { backgroundColor: 'rgba(120,53,15,0.8)', border: '1px solid rgba(146,64,14,0.8)', color: '#fbbf24' }}>
            <AlertCircle className="w-3 h-3" />
            <span>Needs Review</span>
          </span>
        );
    }
  };

  const typeInfo = getTypeBadge(card.type);

  const formattedDate = new Date(card.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const cardStyle: React.CSSProperties = isLight
    ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', boxShadow: '0 1px 4px rgba(24,50,74,0.07)' }
    : { backgroundColor: '#0f172a', border: '1px solid rgba(20,184,166,0.2)' };

  const divider: React.CSSProperties = { borderColor: isLight ? '#C5DCE8' : 'rgba(30,41,59,0.8)' };

  return (
    <div className="rounded-2xl p-4 shadow-sm transition-all" style={cardStyle}>

      {/* Header: type badge + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={typeInfo.style}
        >
          {typeInfo.label}
        </span>
        {renderStatus()}
      </div>

      {/* Quote / Description */}
      <div className="flex items-start gap-2.5 my-2.5 text-xs">
        <MessageSquareQuote
          className="w-4 h-4 shrink-0 mt-0.5"
          style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}
        />
        <p className="leading-relaxed font-medium" style={isLight ? { color: '#18324A' } : { color: '#e2e8f0' }}>
          "{card.description}"
        </p>
      </div>

      {/* Metadata row */}
      <div
        className="pt-2.5 border-t flex items-center justify-between text-[11px]"
        style={{ ...divider, borderTopWidth: '1px', borderTopStyle: 'solid' }}
      >
        <div style={isLight ? { color: '#587084' } : { color: '#64748b' }}>
          Raised by:{' '}
          <strong style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}>{card.raisedByName}</strong>
        </div>
        <span className="font-mono" style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>
          {formattedDate}
        </span>
      </div>

      {/* Care team response block */}
      {card.careTeamNotes && (
        <div
          className="mt-3 p-2.5 rounded-xl text-[11px]"
          style={isLight
            ? { backgroundColor: 'rgba(0,175,163,0.08)', border: '1px solid #A8D9D5' }
            : { backgroundColor: 'rgba(2,8,23,1)', border: '1px solid rgba(30,41,59,1)' }}
        >
          <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5"
            style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
            Care Team Response
          </div>
          <p className="leading-relaxed" style={isLight ? { color: '#18324A' } : { color: '#5eead4' }}>
            {card.careTeamNotes}
          </p>
        </div>
      )}

      {/* Caregiver action buttons */}
      {isCaregiver && onUpdateStatus && card.status !== 'resolved' && (
        <div
          className="mt-3 pt-2 border-t flex justify-end gap-2"
          style={{ borderColor: isLight ? '#C5DCE8' : 'rgba(30,41,59,0.8)' }}
        >
          {card.status === 'needs-review' && (
            <button
              onClick={() => onUpdateStatus('acknowledged')}
              className="px-2.5 py-1 rounded-lg text-xs transition"
              style={isLight
                ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
                : { backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }}
            >
              Simulate Team Acknowledge
            </button>
          )}
          <button
            onClick={() => onUpdateStatus('resolved')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition"
            style={{ backgroundColor: '#00AFA3' }}
          >
            Mark Resolved
          </button>
        </div>
      )}
    </div>
  );
};
