import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import type { Medication } from '../types';

export async function getPatientMedications(patientId: string) {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  // Try backend API first, fall back to Supabase
  const result = await apiFetch<{ data: Medication[] }>(`/episode/${patientId}`);

  if (result.error) {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('drug', { ascending: true });

    if (error) throw error;
    return data as Medication[];
  }

  return result.data || [];
}