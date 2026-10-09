import { getSupabaseClient } from '../../lib/supabase';
import { DbCaregiverAccessRequest } from '../../types/database';
import { AccessRequest } from '../../types';
import { mapCaregiverAccessRequest } from '../../adapters/supabaseMappers';

export async function fetchCaregiverAccessRequests(patientId: string): Promise<AccessRequest[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('caregiver_access_request')
      .select('*')
      .eq('patient_id', patientId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching caregiver access requests:', error);
      return [];
    }

    return (data as DbCaregiverAccessRequest[]).map(mapCaregiverAccessRequest);
  } catch (err) {
    console.error('Exception fetching caregiver access requests:', err);
    return [];
  }
}

/**
 * Decide on a caregiver access request using backend RPC
 * decide_access_request(p_request_id, p_allowed, p_reason)
 */
export async function decideCaregiverAccessRequest(
  requestId: string,
  allowed: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    // 1. Try dedicated RPC
    const { error: rpcErr } = await supabase.rpc('decide_access_request', {
      p_request_id: requestId,
      p_allowed: allowed,
      p_reason: reason || (allowed ? 'Approved by patient' : 'Denied by patient'),
    });

    if (!rpcErr) {
      return { success: true };
    }

    // 2. Direct table fallback if RPC not present in environment
    const status = allowed ? 'approved' : 'denied';
    const { error: updateErr } = await supabase
      .from('caregiver_access_request')
      .update({
        status,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deciding access request';
    return { success: false, error: msg };
  }
}
