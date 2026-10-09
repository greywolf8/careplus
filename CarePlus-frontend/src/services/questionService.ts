import { supabase } from '../lib/supabase';
import type { PatientQuestion } from '../types';

export async function getPatientQuestions(patientId: string) {
  const { data, error } = await supabase
    .from('patient_questions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as PatientQuestion[];
}

export async function answerQuestion(questionId: string, answerText: string, answerLanguage: string) {
  const { data, error } = await supabase
    .from('patient_questions')
    .update({
      answer_text: answerText,
      answer_language: answerLanguage,
      status: 'answered',
      answered_at: new Date().toISOString()
    })
    .eq('id', questionId)
    .select()
    .single();

  if (error) throw error;
  return data as PatientQuestion;
}