import { getSupabaseClient } from '../../lib/supabase';
import { DbPatientTabPermissions } from '../../types/database';
import { TabPermissions } from '../../types';
import { mapTabPermissions } from '../../adapters/supabaseMappers';

export async function getTabPermissionsForUser(userId: string): Promise<TabPermissions> {
  const supabase = getSupabaseClient();
  if (!supabase) return mapTabPermissions(null);

  try {
    const { data, error } = await supabase
      .from('patient_tab_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return mapTabPermissions(null);
    return mapTabPermissions(data as DbPatientTabPermissions);
  } catch (err) {
    console.error('Failed to get tab permissions:', err);
    return mapTabPermissions(null);
  }
}

export async function updateCaregiverMarkDonePermission(
  caregiverUserId: string,
  allowed: boolean
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error: permErr } = await supabase
      .from('patient_tab_permissions')
      .upsert({
        user_id: caregiverUserId,
        can_mark_done: allowed,
        updated_at: new Date().toISOString(),
      });

    const { error: linkErr } = await supabase
      .from('patient_caregiver_link')
      .update({ can_mark_done: allowed })
      .eq('caregiver_user_id', caregiverUserId);

    return !permErr && !linkErr;
  } catch (err) {
    console.error('Failed to update caregiver permissions:', err);
    return false;
  }
}
