import { getSupabaseClient } from '../../lib/supabase';
import { DbCareProvider } from '../../types/database';
import { Provider } from '../../types';
import { mapCareProvider } from '../../adapters/supabaseMappers';

export async function fetchActiveCareProviders(): Promise<Provider[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('care_provider')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching care providers:', error);
      return [];
    }

    return (data as DbCareProvider[]).map(mapCareProvider);
  } catch (err) {
    console.error('Exception fetching care providers:', err);
    return [];
  }
}

export async function searchNearbyCareProviders(
  category?: string,
  query?: string,
  lat?: number,
  lng?: number
): Promise<Provider[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // 1. Try RPC nearby_providers if coordinates provided
    if (lat && lng) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('nearby_providers', {
        p_lat: lat,
        p_lng: lng,
        p_kind: category && category !== 'all' ? category : null,
        p_radius_km: 15,
      });

      if (!rpcErr && rpcData) {
        return (rpcData as DbCareProvider[]).map(mapCareProvider);
      }
    }

    // 2. Standard table query
    let q = supabase
      .from('care_provider')
      .select('*')
      .eq('is_active', true);

    if (category && category !== 'all') {
      q = q.eq('kind', category);
    }

    if (query) {
      q = q.or(`name.ilike.%${query}%,address.ilike.%${query}%`);
    }

    const { data, error } = await q.order('name', { ascending: true });
    if (error || !data) return [];

    return (data as DbCareProvider[]).map(mapCareProvider);
  } catch (err) {
    console.error('Exception searching care providers:', err);
    return [];
  }
}
