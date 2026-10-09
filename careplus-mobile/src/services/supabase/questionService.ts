import { getSupabaseClient } from '../../lib/supabase';
import { DbPatientQuestion, DbPatientQuestionRoute } from '../../types/database';

export async function logPatientQuestion(
  patientId: string,
  question: string,
  route: DbPatientQuestionRoute,
  answer?: string,
  citedItemIds?: string[]
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const payload: Partial<DbPatientQuestion> = {
      patient_id: patientId,
      question,
      route,
      answer: answer || null,
      cited_item_ids: citedItemIds || null,
      created_at: new Date().toISOString(),
      answered_at: answer ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('patient_question')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error logging patient question:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('Exception logging patient question:', err);
    return null;
  }
}
