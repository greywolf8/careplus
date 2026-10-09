import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import type { FollowupItem, ItemEffective } from '../types';

export async function getPatientItems(patientId: string) {
  const result = await apiFetch<{ data: ItemEffective[] }>(`/obligation/graph/${patientId}`);

  if (result.error) {
    const fallback = await supabase
      .from('v_items_effective')
      .select('*')
      .eq('patient_id', patientId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (fallback.error) throw fallback.error;
    return fallback.data as ItemEffective[];
  }

  return result.data.data;
}

export async function approveItem(itemId: string) {
  // Try backend API first, fall back to Supabase RPC
  const result = await apiFetch<{ data: any }>('/obligation/approve', {
    method: 'POST',
    body: JSON.stringify({ extracted_id: itemId, rmp_id: '', mci_reg: '', final_text: '' }),
  });

  if (result.error) {
    const { data, error } = await supabase.rpc('approve_item', { item_id: itemId });
    if (error) throw error;
    return data;
  }

  return result.data;
}

export async function rejectItem(itemId: string, reason?: string) {
  const { data, error } = await supabase.rpc('reject_item', { item_id: itemId, reason });
  if (error) throw error;
  return data;
}

export async function markItemDone(itemId: string) {
  const { data, error } = await supabase.rpc('mark_item_done', { item_id: itemId });
  if (error) throw error;
  return data;
}

export async function updateItem(itemId: string, updates: Partial<FollowupItem>) {
  const { data, error } = await supabase
    .from('followup_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as FollowupItem;
}