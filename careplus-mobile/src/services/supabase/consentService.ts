import { getSupabaseClient } from '../../lib/supabase';
import { DbConsent } from '../../types/database';

export async function fetchPatientConsent(patientId: string): Promise<DbConsent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('consent')
      .select('*')
      .eq('patient_id', patientId)
      .is('revoked_at', null);

    if (error) {
      console.error('Error fetching patient consent:', error);
      return [];
    }

    return data as DbConsent[];
  } catch (err) {
    console.error('Exception fetching patient consent:', err);
    return [];
  }
}

export async function revokePatientConsent(consentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    // 1. Try dedicated RPC
    const { error: rpcErr } = await supabase.rpc('revoke_consent', {
      p_consent_id: consentId,
    });

    if (!rpcErr) {
      return { success: true };
    }

    // 2. Direct table fallback
    const { error: updateErr } = await supabase
      .from('consent')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', consentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Consent revocation error';
    return { success: false, error: msg };
  }
}
