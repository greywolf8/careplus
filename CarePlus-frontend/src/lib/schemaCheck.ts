import { supabase } from './supabase';

// Utility to check Supabase schema - run this in browser console
export async function checkSchema() {
  console.log('[Schema Check] Starting schema inspection...');
  
  // Check profiles table structure
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Profiles table:', { 
    data: profilesData, 
    error: profilesError 
  });
  
  // Check patients table structure
  const { data: patientsData, error: patientsError } = await supabase
    .from('patients')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Patients table:', { 
    data: patientsData, 
    error: patientsError 
  });
  
  // Check doctor_patients table structure
  const { data: doctorPatientsData, error: doctorPatientsError } = await supabase
    .from('doctor_patients')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Doctor patients table:', { 
    data: doctorPatientsData, 
    error: doctorPatientsError 
  });
  
  // Check followup_items table structure
  const { data: itemsData, error: itemsError } = await supabase
    .from('followup_items')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Followup items table:', { 
    data: itemsData, 
    error: itemsError 
  });
  
  // Check review_flags table structure
  const { data: flagsData, error: flagsError } = await supabase
    .from('review_flags')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Review flags table:', { 
    data: flagsData, 
    error: flagsError 
  });
  
  // Check patient_questions table structure
  const { data: questionsData, error: questionsError } = await supabase
    .from('patient_questions')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Patient questions table:', { 
    data: questionsData, 
    error: questionsError 
  });
  
  // Check medications table structure
  const { data: medsData, error: medsError } = await supabase
    .from('medications')
    .select('*')
    .limit(1);
  
  console.log('[Schema Check] Medications table:', { 
    data: medsData, 
    error: medsError 
  });
  
  // Check current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[Schema Check] Current user:', user);
  
  return {
    profiles: { data: profilesData, error: profilesError },
    patients: { data: patientsData, error: patientsError },
    doctor_patients: { data: doctorPatientsData, error: doctorPatientsError },
    followup_items: { data: itemsData, error: itemsError },
    review_flags: { data: flagsData, error: flagsError },
    patient_questions: { data: questionsData, error: questionsError },
    medications: { data: medsData, error: medsError },
    currentUser: user
  };
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).checkSchema = checkSchema;
  console.log('[Schema Check] Run checkSchema() in browser console to inspect Supabase schema');
}
