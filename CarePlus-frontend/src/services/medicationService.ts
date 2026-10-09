import { supabase } from '../lib/supabase';
import type { Medication } from '../types';

export async function getPatientMedications(patientId: string) {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  // Use Supabase directly for medications
  const { data, error } = await supabase
    .from('patient_medication')
    .select('*')
    .eq('patient_id', patientId)
    .order('drug_name', { ascending: true });

  if (error) throw error;
  return data as Medication[];
}