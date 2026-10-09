import { getSupabaseClient } from '../../lib/supabase';
import { DbFollowupItem } from '../../types/database';
import { FollowupItem } from '../../types';
import { mapFollowupItem } from '../../adapters/supabaseMappers';

export async function fetchFollowupItems(patientId: string): Promise<FollowupItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('followup_item')
      .select('*')
      .eq('patient_id', patientId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching followup items:', error);
      return [];
    }

    return (data as DbFollowupItem[]).map(mapFollowupItem);
  } catch (err) {
    console.error('Exception fetching followup items:', err);
    return [];
  }
}

export async function fetchFollowupItemById(itemId: string): Promise<FollowupItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('followup_item')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error || !data) return null;
    return mapFollowupItem(data as DbFollowupItem);
  } catch (err) {
    console.error('Exception fetching followup item by id:', err);
    return null;
  }
}

/**
 * Mark a follow-up item as completed using the dedicated RPC
 * patient_mark_followup_done(p_item_id, p_completed_by)
 */
export async function patientMarkFollowupDone(
  itemId: string,
  completedBy: string
): Promise<{ success: boolean; item?: FollowupItem; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database client not connected' };

  try {
    // 1. Try dedicated RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('patient_mark_followup_done', {
      p_item_id: itemId,
      p_completed_by: completedBy,
    });

    if (!rpcErr) {
      const updated = rpcData ? mapFollowupItem(rpcData as DbFollowupItem) : undefined;
      return { success: true, item: updated };
    }

    console.warn('[Supabase patient_mark_followup_done RPC not available, falling back to direct table update]:', rpcErr.message);

    // 2. Direct table fallback if RPC is not registered in current environment
    const now = new Date().toISOString();
    const { data: existing, error: findErr } = await supabase
      .from('followup_item')
      .select('*')
      .eq('id', itemId)
      .single();

    if (findErr || !existing) {
      console.error('[Supabase followup_item find error]:', {
        message: findErr?.message,
        details: findErr?.details,
        code: findErr?.code,
        itemId,
      });
      return { success: false, error: 'Item not found' };
    }

    const nextStatus = existing.effective_status === 'completed' ? 'pending' : 'completed';
    const completedAt = nextStatus === 'completed' ? now : null;
    const actor = nextStatus === 'completed' ? completedBy : null;

    const { data, error: updateErr } = await supabase
      .from('followup_item')
      .update({
        effective_status: nextStatus,
        completed_at: completedAt,
        completed_by: actor,
        updated_at: now,
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (updateErr || !data) {
      console.error('[Supabase followup_item UPDATE error]:', {
        message: updateErr?.message,
        details: updateErr?.details,
        code: updateErr?.code,
        itemId,
        nextStatus,
      });
      return { success: false, error: updateErr?.message || 'Failed to update item' };
    }

    return { success: true, item: mapFollowupItem(data as DbFollowupItem) };
  } catch (err: unknown) {
    console.error('[Supabase followup_item mark exception]:', err);
    const msg = err instanceof Error ? err.message : 'Unknown completion error';
    return { success: false, error: msg };
  }
}

/**
 * Core obligation completion RPC mark_item_done(p_obligation_id, p_closure_evidence)
 */
export async function markObligationDone(
  obligationId: string,
  closureEvidence?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.rpc('mark_item_done', {
      p_obligation_id: obligationId,
      p_closure_evidence: closureEvidence || 'Completed via CarePlus Patient Portal',
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Synchronize a follow-up item from an approved clinical item using backend RPC
 */
export async function syncFollowupFromApprovedItem(approvedItemId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.rpc('sync_followup_from_approved_item', {
      p_approved_item_id: approvedItemId,
    });
    return !error;
  } catch {
    return false;
  }
}
