import React, { useState } from 'react';
import { CoordinationCardType, PatientContext } from '../../types';
import { dataService } from '../../services/dataService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { X, Send, AlertCircle } from 'lucide-react';

interface CreateCoordinationModalProps {
  patientContext: PatientContext;
  onClose: () => void;
  onCreated: () => void;
  initialType?: CoordinationCardType;
  initialDescription?: string;
}

export const CreateCoordinationModal: React.FC<CreateCoordinationModalProps> = ({
  patientContext,
  onClose,
  onCreated,
  initialType = 'general-review',
  initialDescription = '',
}) => {
  const [type, setType] = useState<CoordinationCardType>(initialType);
  const [description, setDescription] = useState(initialDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notifySuccess, notifyError } = useNotification();
  const { theme } = useAuth();
  const isLight = theme === 'light';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const actorName =
      patientContext.role === 'caregiver'
        ? `${patientContext.relationship || 'Caregiver'} (${patientContext.userId === 'usr_caregiver_ramesh' ? 'Ramesh Kumar' : 'Caregiver'})`
        : `${patientContext.patientName} (Patient)`;

    try {
      await dataService.addCoordinationCard({
        patientId: patientContext.patientId,
        type,
        raisedBy: patientContext.role,
        raisedByName: actorName,
        description: description.trim(),
      });
      notifySuccess('Coordination request logged for care team review.', 'Issue Submitted');
      setIsSubmitting(false);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit issue';
      notifyError(msg, 'Submission Error');
      setIsSubmitting(false);
    }
  };

  const types: { value: CoordinationCardType; label: string }[] = [
    { value: 'medication-delay', label: 'Medicine Delivery / Stock Issue' },
    { value: 'appointment-question', label: 'Doctor Appointment Question' },
    { value: 'test-delay', label: 'Diagnostic Lab Test Issue' },
    { value: 'symptom-report', label: 'Symptom Observation Report' },
    { value: 'unclear-instruction', label: 'Unclear Discharge Instruction' },
    { value: 'general-review', label: 'General Care Team Review' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-3xl p-5 shadow-2xl border animate-in zoom-in-95 duration-150"
        style={
          isLight
            ? { backgroundColor: '#F2F7FC', borderColor: '#C5DCE8', color: '#18324A' }
            : { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }
        }
      >
        <div
          className="flex items-center justify-between pb-3 border-b"
          style={isLight ? { borderColor: '#DCEBF3' } : { borderColor: '#1e293b' }}
        >
          <div>
            <h3 className="text-sm font-bold tracking-tight" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
              Request Care Team Review
            </h3>
            <p className="text-[11px]" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
              Submit a coordination issue to hospital team
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl transition cursor-pointer"
            style={isLight ? { backgroundColor: '#E1F0F7', color: '#587084' } : { backgroundColor: '#1e293b', color: '#94a3b8' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}
            >
              Issue Category
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CoordinationCardType)}
              className="w-full min-h-[44px] px-3 rounded-xl border text-xs focus:outline-none"
              style={
                isLight
                  ? { backgroundColor: '#ffffff', borderColor: '#C5DCE8', color: '#18324A' }
                  : { backgroundColor: '#020817', borderColor: '#1e293b', color: '#f8fafc' }
              }
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}
            >
              Issue Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Medicine has not arrived yet, or patient has a query about walking..."
              className="w-full p-3 rounded-xl border text-xs focus:outline-none leading-relaxed"
              style={
                isLight
                  ? { backgroundColor: '#ffffff', borderColor: '#C5DCE8', color: '#18324A' }
                  : { backgroundColor: '#020817', borderColor: '#1e293b', color: '#f8fafc' }
              }
              required
            />
          </div>

          <div
            className="p-3 rounded-xl border text-[11px] flex items-start gap-2"
            style={
              isLight
                ? { backgroundColor: '#FFF5D9', borderColor: '#F5D57A', color: '#7A4F00' }
                : { backgroundColor: 'rgba(120,53,15,0.4)', borderColor: 'rgba(146,64,14,0.6)', color: '#fde68a' }
            }
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={isLight ? { color: '#C58A00' } : { color: '#fbbf24' }} />
            <p className="leading-snug">
              This request will be sent to the cardiology coordinator queue. For immediate chest pain or breathlessness, call 112 directly.
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-2 pt-2 border-t"
            style={isLight ? { borderColor: '#DCEBF3' } : { borderColor: '#1e293b' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl text-xs font-semibold transition cursor-pointer"
              style={
                isLight
                  ? { backgroundColor: '#E1F0F7', color: '#587084' }
                  : { backgroundColor: '#1e293b', color: '#94a3b8' }
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || isSubmitting}
              className="min-h-[44px] rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition active:scale-98 cursor-pointer disabled:opacity-50"
              style={
                isLight
                  ? { backgroundColor: '#00AFA3' }
                  : { backgroundColor: '#0f766e' }
              }
            >
              <Send className="w-4 h-4" />
              <span>Submit Issue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
