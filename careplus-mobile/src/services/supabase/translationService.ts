import { getSupabaseClient } from '../../lib/supabase';
import { DbFollowupItemTranslation, DbTranslation } from '../../types/database';
import { ItemTranslation, Language } from '../../types';
import { mapFollowupItemTranslation } from '../../adapters/supabaseMappers';

export async function fetchFollowupItemTranslation(
  itemId: string,
  lang: Language
): Promise<ItemTranslation | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('followup_item_translation')
      .select('*')
      .eq('item_id', itemId)
      .eq('language', lang)
      .single();

    if (error || !data) return null;
    return mapFollowupItemTranslation(data as DbFollowupItemTranslation);
  } catch (err) {
    console.error('Exception fetching followup item translation:', err);
    return null;
  }
}

export async function fetchCoreClinicalTranslation(
  sourceItemId: string,
  targetLang: Language
): Promise<DbTranslation | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('translation')
      .select('*')
      .eq('source_item_id', sourceItemId)
      .eq('target_language', targetLang)
      .single();

    if (error || !data) return null;
    return data as DbTranslation;
  } catch (err) {
    console.error('Exception fetching core translation:', err);
    return null;
  }
}
