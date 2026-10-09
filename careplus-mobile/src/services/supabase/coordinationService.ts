import { getSupabaseClient } from '../../lib/supabase';
import { DbCoordinationCard, DbCoordinationCardStatus, DbCoordinationCardType } from '../../types/database';
import { CoordinationCard, CoordinationCardStatus } from '../../types';
import { mapCoordinationCard } from '../../adapters/supabaseMappers';

export async function fetchCoordinationCards(patientId: string): Promise<CoordinationCard[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('coordination_card')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase coordination_card SELECT error]:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        patientId,
      });
      return [];
    }

    return (data as DbCoordinationCard[]).map(mapCoordinationCard);
  } catch (err) {
    console.error('[Supabase coordination_card SELECT exception]:', err);
    return [];
  }
}

export async function createCoordinationCard(
  card: Omit<CoordinationCard, 'id' | 'createdAt' | 'status'> & { status?: CoordinationCardStatus }
): Promise<CoordinationCard | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[Supabase createCoordinationCard]: Supabase client not initialized');
    return null;
  }

  try {
    const payload: Partial<DbCoordinationCard> = {
      patient_id: card.patientId,
      card_type: card.type as DbCoordinationCardType,
      raised_by: card.raisedBy,
      raised_by_name: card.raisedByName,
      description: card.description,
      status: (card.status || 'needs-review') as DbCoordinationCardStatus,
      care_team_notes: card.careTeamNotes || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('coordination_card')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Supabase coordination_card INSERT error]:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        payload,
      });
      return null;
    }

    return mapCoordinationCard(data as DbCoordinationCard);
  } catch (err) {
    console.error('[Supabase coordination_card INSERT exception]:', err);
    return null;
  }
}

export async function updateCoordinationCardStatus(
  id: string,
  status: CoordinationCardStatus,
  careTeamNotes?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const payload: Partial<DbCoordinationCard> = {
      status: status as DbCoordinationCardStatus,
      care_team_notes: careTeamNotes || undefined,
      resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
    };

    const { error } = await supabase
      .from('coordination_card')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[Supabase coordination_card UPDATE error]:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        id,
        payload,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Supabase coordination_card UPDATE exception]:', err);
    return false;
  }
}
