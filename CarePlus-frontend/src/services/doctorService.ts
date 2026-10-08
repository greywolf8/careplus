import { supabase } from '../lib/supabase';
import { assertDoctorAccess } from '../lib/auth';
import type { Patient, PatientAttention } from '../types';

export async function getDoctorPatients() {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('doctor_patients')
    .select(`
      patient_id,
      patients (
        id,
        mrn,
        full_name,
        date_of_birth,
        sex,
        language,
        city,
        discharge_date,
        care_circle
      )
    `)
    .eq('doctor_id', profile.data.user.id)
    .eq('active', true);

  if (error) throw error;
  return data?.map((d: any) => d.patients).filter(Boolean) as Patient[];
}

export async function getPatientAttentionList() {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  try {
    const { data, error } = await supabase
      .from('v_patient_attention')
      .select('*')
      .order('urgency_score', { ascending: false });

    if (error) throw error;
    return data as PatientAttention[];
  } catch (error: any) {
    console.error('[doctorService] Failed to fetch patient attention list:', error);
    // Return empty array if view doesn't exist or permission denied
    return [];
  }
}

export async function getPatientById(patientId: string) {
  await assertDoctorAccess(patientId);

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();

  if (error) throw error;
  return data as Patient;
}
