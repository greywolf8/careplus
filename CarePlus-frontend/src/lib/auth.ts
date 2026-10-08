import { supabase } from './supabase';
import type { Profile } from '../types';

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getCurrentProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  if (!profile) throw new Error('Profile not found');

  return profile;
}

export async function assertDoctorAccess(patientId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile.role !== 'doctor') {
    throw new Error('Access denied: Not a doctor');
  }

  const { data: assignment, error } = await supabase
    .from('doctor_patients')
    .select('*')
    .eq('doctor_id', profile.id)
    .eq('patient_id', patientId)
    .eq('active', true)
    .single();

  if (error || !assignment) {
    throw new Error('Access denied: Not assigned to this patient');
  }
}

export async function assertPatientOwner(patientId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile.role !== 'patient') {
    throw new Error('Access denied: Not a patient');
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('id', profile.id)
    .single();

  if (error || !patient) {
    throw new Error('Access denied: Not your patient record');
  }
}

export async function isDoctorOf(patientId: string): Promise<boolean> {
  try {
    await assertDoctorAccess(patientId);
    return true;
  } catch {
    return false;
  }
}

export async function isPatientOwner(patientId: string): Promise<boolean> {
  try {
    await assertPatientOwner(patientId);
    return true;
  } catch {
    return false;
  }
}
