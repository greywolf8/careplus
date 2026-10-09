import { supabase } from '../lib/supabase';
import type { FollowupItem, ItemEffective } from '../types';

export async function getPatientItems(patientId: string) {
  // Use Supabase directly for items
  const { data, error } = await supabase
    .from('v_items_effective')
    .select('*')
    .eq('patient_id', patientId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching patient items:', error);
    throw error;
  }

  return data as ItemEffective[];
}

export async function approveItem(itemId: string) {
  // Use Supabase RPC directly
  const { data, error } = await supabase.rpc('approve_item', { item_id: itemId });
  if (error) throw error;
  return data;
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