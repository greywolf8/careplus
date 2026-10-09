import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_AI_SERVER_URL as string;

if (!API_BASE_URL) {
  throw new Error('VITE_AI_SERVER_URL is not defined');
}

interface ApiResponse<T = any> {
  data: T;
  error?: string;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
    ...options,
  });

  // Read the body exactly once (reading twice throws "body already used").
  const raw = await response.json().catch(() => ({}));

  const result: ApiResponse<T> = { data: raw as T };
  if (!response.ok) {
    const detail = (raw as any)?.detail;
    result.error = typeof detail === 'string' ? detail : (detail?.message) || response.statusText;
  }

  return result;
}

export async function getHealthCheck() {
  return apiFetch('/health');
}

export async function extractDischargeSummary(rawText: string, patientId: string, dischargeType: string = 'general_medical') {
  return apiFetch('/extract', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText, patient_id: patientId, discharge_type: dischargeType }),
  });
}

export async function approveObligation(extractedId: string, rmpId: string, mciReg: string, finalText: string) {
  return apiFetch('/obligation/approve', {
    method: 'POST',
    body: JSON.stringify({ extracted_id: extractedId, rmp_id: rmpId, mci_reg: mciReg, final_text: finalText }),
  });
}

export async function closeObligation(obligationId: string, evidence: string, rmpId: string) {
  return apiFetch('/obligation/close', {
    method: 'POST',
    body: JSON.stringify({ obligation_id: obligationId, evidence, rmp_id: rmpId }),
  });
}

export async function getObligationGraph(patientId: string) {
  return apiFetch(`/obligation/graph/${patientId}`);
}

export async function getEpisode(patientId: string) {
  return apiFetch(`/episode/${patientId}`);
}

export async function translateItem(itemId: string, itemType: string, targetLanguage: string) {
  return apiFetch('/translate', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, item_type: itemType, target_language: targetLanguage }),
  });
}

export async function verifyTranslation(translationId: string, rmpId: string, decision: 'approve' | 'reject', reason?: string) {
  return apiFetch('/verify/translation', {
    method: 'POST',
    body: JSON.stringify({ translation_id: translationId, rmp_id: rmpId, decision, reason }),
  });
}

export async function classifyQuestion(question: string, patientId: string) {
  return apiFetch('/question/classify', {
    method: 'POST',
    body: JSON.stringify({ question, patient_id: patientId }),
  });
}

export async function answerPlanQuestion(question: string, patientId: string) {
  return apiFetch('/question/answer/plan', {
    method: 'POST',
    body: JSON.stringify({ question, patient_id: patientId }),
  });
}

export async function answerDoctorQuestion(question: string, patientId: string) {
  return apiFetch('/question/answer/doctor', {
    method: 'POST',
    body: JSON.stringify({ question, patient_id: patientId }),
  });
}

export async function draftTask(doctorDescription: string, patientId: string, dischargeDate: string) {
  return apiFetch('/task/draft', {
    method: 'POST',
    body: JSON.stringify({ doctor_description: doctorDescription, patient_id: patientId, discharge_date: dischargeDate }),
  });
}

export async function matchProviders(itemType: string, latitude: number, longitude: number, radiusKm: number) {
  return apiFetch('/providers/match', {
    method: 'POST',
    body: JSON.stringify({ item_type: itemType, latitude, longitude, radius_km: radiusKm }),
  });
}

// ---- Web doctor portal flow ----
export async function webExtractDischarge(
  patientId: string,
  rawText: string,
  dischargeDate: string,
  language: string = 'en'
) {
  return apiFetch('/web/extract', {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      raw_text: rawText,
      discharge_date: dischargeDate,
      language,
    }),
  });
}

export async function webPublishDischarge(payload: {
  patient_id: string;
  discharge_date: string;
  raw_text: string;
  language?: string;
  items: Array<{
    item_type: string;
    content: string;
    quote?: string;
    due_date?: string | null;
    title?: string | null;
    priority?: string;
    source_span?: any;
    metadata?: any;
    medication_details?: {
      name?: string | null;
      dose?: string | null;
      frequency?: string | null;
      duration?: string | null;
    } | null;
  }>;
}) {
  return apiFetch('/web/publish', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function webGetDischargeSummary(patientId: string) {
  return apiFetch<{
    count: number;
    summaries: Array<{
      id: string;
      raw_content: string;
      language: string;
      discharge_date: string | null;
      created_at: string;
    }>;
  }>(`/web/patients/${patientId}/discharge-summary`);
}

export async function webAddTask(payload: {
  patient_id: string;
  description: string;
  item_type?: string;
  due_date?: string | null;
  title?: string | null;
}) {
  return apiFetch('/web/add-task', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function webGetMyAttention() {
  return apiFetch<{ patients: any[] }>('/web/my-attention');
}

export async function webGetMyFlags() {
  return apiFetch<{ flags: any[] }>('/web/my-flags');
}

export async function webGetSchedule(days = 7) {
  return apiFetch<{
    today: Array<{
      id: string;
      patient_id: string;
      patient_name: string;
      title: string | null;
      due_date: string | null;
      due_time: string | null;
      provider: string | null;
      status: string | null;
      is_completed: boolean;
    }>;
    upcoming: Array<{
      id: string;
      patient_id: string;
      patient_name: string;
      title: string | null;
      due_date: string | null;
      due_time: string | null;
      provider: string | null;
      status: string | null;
      is_completed: boolean;
    }>;
    today_date: string;
  }>(`/web/schedule?days=${days}`);
}

export async function webAgentChat(payload: {
  patient_id: string | null;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return apiFetch<{
    answer: string;
    patient_id: string | null;
    patient_name: string | null;
    auto_resolved: boolean;
    sources: string[];
    actions?: Array<{ tool: string; args?: any; ok: boolean; result: string }>;
  }>('/web/agent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}