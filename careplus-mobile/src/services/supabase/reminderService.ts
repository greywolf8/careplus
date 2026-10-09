import { getSupabaseClient } from '../../lib/supabase';
import { DbReminder } from '../../types/database';
import { Reminder } from '../../types';
import { mapReminder } from '../../adapters/supabaseMappers';

export async function fetchPatientReminders(patientId: string): Promise<Reminder[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('reminder')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching reminders:', error);
      return [];
    }

    return (data as DbReminder[]).map(mapReminder);
  } catch (err) {
    console.error('Exception fetching reminders:', err);
    return [];
  }
}
