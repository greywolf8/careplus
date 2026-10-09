import { getSupabaseClient } from '../../lib/supabase';
import { DbWarningSign } from '../../types/database';
import { WarningSign } from '../../types';
import { mapWarningSign } from '../../adapters/supabaseMappers';

export async function fetchWarningSigns(patientId: string): Promise<WarningSign[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('warning_sign')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching warning signs:', error);
      return [];
    }

    return (data as DbWarningSign[]).map(mapWarningSign);
  } catch (err) {
    console.error('Exception fetching warning signs:', err);
    return [];
  }
}
