import { getSupabaseClient } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeCallback = (payload: { table: string; eventType: string; new: unknown; old: unknown }) => void;

export function subscribeToPatientRealtime(
  patientId: string,
  onUpdate: RealtimeCallback
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !patientId) {
    return () => {};
  }

  const channelName = `careplus_patient_${patientId}_${Date.now()}`;
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'followup_item', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'followup_item', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patient_medication', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'patient_medication', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'adherence_log' },
      (payload) => onUpdate({ table: 'adherence_log', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patient_message', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'patient_message', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'coordination_card', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'coordination_card', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'test_result', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'test_result', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminder', filter: `patient_id=eq.${patientId}` },
      (payload) => onUpdate({ table: 'reminder', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
