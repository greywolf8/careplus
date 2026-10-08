import { supabase } from '../lib/supabase';
import { assertDoctorAccess } from '../lib/auth';
import type { ReviewFlag } from '../types';

export async function getPatientFlags(patientId: string) {
  await assertDoctorAccess(patientId);

  const { data, error } = await supabase
    .from('review_flags')
    .select('*')
    .eq('patient_id', patientId)
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ReviewFlag[];
}

export async function getUnresolvedFlags() {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  try {
    const { data, error } = await supabase
      .from('review_flags')
      .select(`
        *,
        patients (
          id,
          full_name,
          mrn
        )
      `)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[flagService] Failed to fetch unresolved flags:', error);
    return [];
  }
}

export async function resolveFlag(flagId: string) {
  const { data, error } = await supabase.rpc('resolve_flag', {
    flag_id: flagId
  });

  if (error) throw error;
  return data;
}
