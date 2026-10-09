import { getSupabaseClient } from '../../lib/supabase';
import { DbReviewFlag } from '../../types/database';
import { CoordinationCard, CoordinationCardStatus } from '../../types';

/**
 * Review Flag Service
 * Mobile app now uses review_flags table (unified with web frontend)
 * instead of coordination_card table.
 */

export async function fetchReviewFlags(patientId: string): Promise<CoordinationCard[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('review_flags')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase review_flags SELECT error]:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        patientId,
      });
      return [];
    }

    // Map review_flags to CoordinationCard format for backward compatibility
    return (data as DbReviewFlag[]).map(mapReviewFlagToCoordinationCard);
  } catch (err) {
    console.error('[Supabase review_flags SELECT exception]:', err);
    return [];
  }
}

export async function createReviewFlag(
  card: Omit<CoordinationCard, 'id' | 'createdAt' | 'status'> & { status?: CoordinationCardStatus }
): Promise<CoordinationCard | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[Supabase createReviewFlag]: Supabase client not initialized');
    return null;
  }

  try {
    // Map card_type to severity
    const severityMap: Record<string, string> = {
      'symptom-report': 'high',
      'medication-not-taken': 'high',
      'medication-delay': 'medium',
      'test-delay': 'medium',
      'appointment-question': 'low',
      'unclear-instruction': 'medium',
      'general-review': 'medium',
    };

    const payload: Partial<DbReviewFlag> = {
      patient_id: card.patientId,
      card_type: card.type,
      raised_by_name: card.raisedByName,
      reason: card.description,
      severity: severityMap[card.type] || 'medium',
      resolved: card.status === 'resolved',
      care_team_notes: card.careTeamNotes || null,
      created_at: new Date().toISOString(),
    };

    // Set resolved_at if status is resolved
    if (card.status === 'resolved') {
      payload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('review_flags')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Supabase review_flags INSERT error]:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        payload,
      });
      return null;
    }

    return mapReviewFlagToCoordinationCard(data as DbReviewFlag);
  } catch (err) {
    console.error('[Supabase review_flags INSERT exception]:', err);
    return null;
  }
}

export async function updateReviewFlagStatus(
  id: string,
  status: CoordinationCardStatus,
  careTeamNotes?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const payload: Partial<DbReviewFlag> = {
      care_team_notes: careTeamNotes || undefined,
    };

    if (status === 'resolved') {
      payload.resolved = true;
      payload.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('review_flags')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[Supabase review_flags UPDATE error]:', {
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
    console.error('[Supabase review_flags UPDATE exception]:', err);
    return false;
  }
}

/**
 * Map review_flags database row to CoordinationCard format
 * This maintains backward compatibility with existing mobile app code
 */
function mapReviewFlagToCoordinationCard(row: DbReviewFlag): CoordinationCard {
  // Convert resolved boolean to status string
  const status: CoordinationCardStatus = row.resolved ? 'resolved' : 'needs-review';

  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.card_type || 'general-review',
    raisedBy: 'patient', // Default to patient, could be enhanced
    raisedByName: row.raised_by_name || 'Patient',
    description: row.reason,
    status: status,
    careTeamNotes: row.care_team_notes || undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || undefined,
  };
}
