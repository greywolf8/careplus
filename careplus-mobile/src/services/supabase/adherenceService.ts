import { getSupabaseClient } from '../../lib/supabase';
import { DbAdherenceLog } from '../../types/database';
import { AdherenceLog } from '../../types';
import { mapAdherenceLog } from '../../adapters/supabaseMappers';

export async function fetchAdherenceLogs(
  patientId: string,
  logDate: string
): Promise<AdherenceLog[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // Join with patient_medication to ensure scoped to active patient
    const { data: medData } = await supabase
      .from('patient_medication')
      .select('id')
      .eq('patient_id', patientId);

    if (!medData || !medData.length) return [];
    const medIds = medData.map((m) => m.id);

    const { data, error } = await supabase
      .from('adherence_log')
      .select('*')
      .in('medication_id', medIds)
      .eq('log_date', logDate);

    if (error) {
      console.error('Error fetching adherence logs:', error);
      return [];
    }

    return (data as DbAdherenceLog[]).map(mapAdherenceLog);
  } catch (err) {
    console.error('Exception fetching adherence logs:', err);
    return [];
  }
}

export async function recordMedicationAdherence(
  medicationId: string,
  status: 'taken' | 'not_taken',
  loggedBy: string,
  logDate: string = new Date().toISOString().split('T')[0]
): Promise<{ success: boolean; log?: AdherenceLog; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const payload: Partial<DbAdherenceLog> = {
      medication_id: medicationId,
      log_date: logDate,
      status,
      logged_by: loggedBy,
      logged_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('adherence_log')
      .upsert(payload, { onConflict: 'medication_id,log_date' })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Supabase adherence_log UPSERT error]:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        payload,
      });
      return { success: false, error: error?.message || 'Failed to save adherence' };
    }

    return { success: true, log: mapAdherenceLog(data as DbAdherenceLog) };
  } catch (err: unknown) {
    console.error('[Supabase adherence_log exception]:', err);
    const msg = err instanceof Error ? err.message : 'Adherence record error';
    return { success: false, error: msg };
  }
}
