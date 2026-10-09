import { getSupabaseClient } from '../../lib/supabase';
import { DbTestResult } from '../../types/database';
import { TestResult } from '../../types';
import { mapTestResult } from '../../adapters/supabaseMappers';

/**
 * Fetches patient diagnostic test results.
 * Strictly enforces is_released = true per medical confidentiality and RLS policies.
 */
export async function fetchReleasedTestResults(patientId: string): Promise<TestResult[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('test_result')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_released', true)
      .order('result_date', { ascending: false });

    if (error) {
      console.error('Error fetching test results:', error);
      return [];
    }

    return (data as DbTestResult[]).map(mapTestResult);
  } catch (err) {
    console.error('Exception fetching released test results:', err);
    return [];
  }
}
