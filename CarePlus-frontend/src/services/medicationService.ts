import { supabase } from '../lib/supabase';
import { assertDoctorAccess } from '../lib/auth';
import type { Medication } from '../types';

export async function getPatientMedications(patientId: string) {
  await assertDoctorAccess(patientId);

  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('drug', { ascending: true });

  if (error) throw error;
  return data as Medication[];
}
