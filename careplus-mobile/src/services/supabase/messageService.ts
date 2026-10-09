import { getSupabaseClient } from '../../lib/supabase';
import { DbPatientMessage } from '../../types/database';
import { PatientQuestionMessage } from '../../types';
import { mapPatientMessage } from '../../adapters/supabaseMappers';

export async function fetchPatientMessages(patientId: string): Promise<PatientQuestionMessage[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('patient_message')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching patient messages:', error);
      return [];
    }

    return (data as DbPatientMessage[]).map(mapPatientMessage);
  } catch (err) {
    console.error('Exception fetching patient messages:', err);
    return [];
  }
}

export async function savePatientMessage(
  msg: Omit<PatientQuestionMessage, 'id' | 'created_at'>
): Promise<PatientQuestionMessage | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const payload: Partial<DbPatientMessage> = {
      patient_id: msg.patient_id,
      sender: msg.sender,
      sender_name: msg.sender_name,
      body: msg.text,
      message_type: msg.type,
      cited_item_ids: msg.cited_item_ids || null,
      escalation_reason: msg.escalation_reason || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('patient_message')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error saving patient message:', error);
      return null;
    }

    return mapPatientMessage(data as DbPatientMessage);
  } catch (err) {
    console.error('Exception saving patient message:', err);
    return null;
  }
}
