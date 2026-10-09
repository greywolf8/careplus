import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import type { Patient, PatientAttention } from '../types';

export async function getDoctorPatients() {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  // Read assigned patients through the doctor_patients junction, joined to
  // the canonical `patient` table (shared with the mobile backend).
  const { data, error } = await supabase
    .from('doctor_patients')
    .select(`
      patient (
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
  return data?.map((d: any) => d.patient).filter(Boolean) as Patient[];
}

export async function getPatientAttentionList() {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) {
    console.error('[doctorService] Not authenticated');
    return [];
  }

  try {
    // Get assigned patient IDs first
    const { data: assignments, error: assignError } = await supabase
      .from('doctor_patients')
      .select('patient_id')
      .eq('doctor_id', profile.data.user.id)
      .eq('active', true);

    if (assignError) {
      console.error('[doctorService] Error fetching assignments:', assignError);
      return [];
    }

    const patientIds = assignments?.map(a => a.patient_id) || [];
    if (patientIds.length === 0) {
      console.log('[doctorService] No assigned patients');
      return [];
    }

    // Query the attention view for assigned patients
    const { data, error } = await supabase
      .from('v_patient_attention')
      .select('*')
      .in('patient_id', patientIds)
      .order('urgency_score', { ascending: false });

    if (error) {
      console.error('[doctorService] Error fetching attention list:', error);
      return [];
    }

    return data as PatientAttention[];
  } catch (error: any) {
    console.error('[doctorService] Failed to fetch patient attention list:', error);
    return [];
  }
}

export async function getPatientById(patientId: string) {
  const profile = await supabase.auth.getUser();
  if (!profile.data.user) throw new Error('Not authenticated');

  const { data: assignment, error: assignError } = await supabase
    .from('doctor_patients')
    .select('*')
    .eq('doctor_id', profile.data.user.id)
    .eq('patient_id', patientId)
    .eq('active', true)
    .single();

  if (assignError || !assignment) {
    throw new Error('Access denied: Not assigned to this patient');
  }

  // Use Supabase directly for patient details
  const { data, error } = await supabase
    .from('patient')
    .select('*')
    .eq('id', patientId)
    .single();

  if (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }

  return data as Patient;
}
export async function createPatient(
  patientData: {
    full_name: string;
    mrn?: string;
    date_of_birth?: string;
    sex?: 'male' | 'female' | 'other';
    language?: string;
    city?: string;
    care_circle?: string;
    discharge_date?: string;
    /** Patient login credentials (created in auth.users + patient_app_user) */
    email: string;
    password: string;
  },
  doctorId: string
): Promise<{ patientId: string; profile: any; appUserId?: string }> {
  const now = new Date().toISOString();
  const name = patientData.full_name?.trim();
  if (!name) throw new Error('Patient name is required');
  const email = patientData.email?.trim();
  const password = patientData.password || '';
  if (!email) throw new Error('Patient login email is required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  // 1. Ensure the acting doctor has a `profiles` row. doctor_patients.doctor_id
  //    FK-references profiles(id); accounts created before that table existed
  //    (or whose signup insert failed) are self-healed here. Do this first so
  //    we fail fast rather than leaving a half-created patient.
  const { data: { user } } = await supabase.auth.getUser();
  if (doctorId) {
    await supabase.from('profiles').upsert(
      {
        id: doctorId,
        full_name: user?.user_metadata?.full_name || user?.email || 'Doctor',
        role: 'doctor',
        preferred_language: 'en',
        updated_at: now,
      },
      { onConflict: 'id' }
    );
  }

  // 2. Create the patient's SUPABASE AUTH account (email + password).
  //    Uses a dedicated non-persisting client so it does NOT clobber the
  //    doctor's active session.
  const adminClient = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: signUpData, error: signUpError } = await adminClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, role: 'patient' },
    },
  });
  if (signUpError) {
    if (/already registered|already exists/i.test(signUpError.message)) {
      throw new Error('A patient with that email already has a login.');
    }
    throw new Error(signUpError.message || 'Failed to create patient login');
  }
  const authUserId = signUpData.user?.id;
  if (!authUserId) throw new Error('Failed to create patient login');

  // 3. Insert into the canonical `patient` table (shared with the mobile app)
  const { data: patient, error: patientError } = await supabase
    .from('patient')
    .insert({
      name,
      full_name: name,
      mrn: patientData.mrn || `MRN-${Date.now()}`,
      date_of_birth: patientData.date_of_birth || '1970-01-01',
      sex: patientData.sex || null,
      language: patientData.language || 'en',
      preferred_language: patientData.language || 'en',
      city: patientData.city || null,
      care_circle: patientData.care_circle || 'Self',
      discharge_date: patientData.discharge_date || null,
      auth_user_id: authUserId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (patientError) throw patientError;

  // 4. Assign to the current doctor via the doctor_patients junction
  const { error: assignmentError } = await supabase
    .from('doctor_patients')
    .insert({
      doctor_id: doctorId,
      patient_id: patient.id,
      active: true,
    });

  if (assignmentError) throw assignmentError;

  // 5. Create the patient_app_user link (this is the login credential
  //    structure defined by the schema: auth_user_id + email + role +
  //    patient_id + preferred_language), then default tab permissions.
  const { data: appUser, error: appUserError } = await supabase
    .from('patient_app_user')
    .insert({
      auth_user_id: authUserId,
      email,
      name,
      role: 'patient',
      preferred_language: patientData.language || 'en',
      patient_id: patient.id,
    })
    .select()
    .single();

  if (appUserError) throw appUserError;

  // Default: patients can see all tabs and mark items done.
  await supabase.from('patient_tab_permissions').insert({
    user_id: appUser.id,
    can_see_today: true,
    can_see_plan: true,
    can_see_medicines: true,
    can_see_ask: true,
    can_see_more: true,
    can_see_warning_signs: true,
    can_see_tests: true,
    can_see_find_care: true,
    can_see_reminders: true,
    can_mark_done: true,
  });

  return { patientId: patient.id, profile: patient, appUserId: appUser.id };
}
