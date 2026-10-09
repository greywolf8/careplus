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
  if (!profile.data.user) {
    console.error('[flagService] Not authenticated');
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
      console.error('[flagService] Error fetching assignments:', assignError);
      return [];
    }

    const patientIds = assignments?.map(a => a.patient_id) || [];
    if (patientIds.length === 0) {
      console.log('[flagService] No assigned patients');
      return [];
    }

    // Query flags for assigned patients
    const { data, error } = await supabase
      .from('review_flags')
      .select('*, patient ( id, full_name, mrn )')
      .in('patient_id', patientIds)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[flagService] Error fetching flags:', error);
      return [];
    }

    return data || [];
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

export async function markFlagResolved(flagId: string, careTeamNotes?: string) {
  const { data, error } = await supabase
    .from('review_flags')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      care_team_notes: careTeamNotes || null,
    })
    .eq('id', flagId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
