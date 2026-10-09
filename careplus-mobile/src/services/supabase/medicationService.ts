import { getSupabaseClient } from '../../lib/supabase';
import { DbPatientMedication } from '../../types/database';
import { Medication } from '../../types';
import { mapMedication } from '../../adapters/supabaseMappers';

export async function fetchPatientMedications(patientId: string): Promise<Medication[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('patient_medication')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching patient medications:', error);
      return [];
    }

    return (data as DbPatientMedication[]).map(mapMedication);
  } catch (err) {
    console.error('Exception fetching patient medications:', err);
    return [];
  }
}
