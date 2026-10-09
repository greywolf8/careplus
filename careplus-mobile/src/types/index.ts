import {
  DbPatient,
  DbRmp,
  DbDischargeSummary,
  DbExtractedItem,
  DbApprovedItem,
  DbObligation,
  DbConsent,
  DbTranslation,
  DbPatientQuestion,
  DbPatientAppUser,
  DbPatientTabPermissions,
  DbPatientCaregiverLink,
  DbFollowupItem,
  DbFollowupItemTranslation,
  DbPatientMedication,
  DbAdherenceLog,
  DbWarningSign,
  DbTestResult,
  DbCareProvider,
  DbPatientMessage,
  DbReminder,
  DbCaregiverAccessRequest,
  DbCoordinationCard,
} from './database';

export * from './database';

export type Language = 'en' | 'hi' | 'ta';

export type UserRole = 'patient' | 'caregiver';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  preferred_language: Language;
  email: string;
  auth_user_id?: string;
  patient_id?: string;
}

export interface PatientContext {
  userId: string;
  role: UserRole;
  patientId: string;
  patientName: string;
  relationship?: string;
  canMarkDone: boolean;
  hospital?: string;
  primaryDoctor?: string;
  dischargeDate?: string;
  dischargeDiagnosis?: string;
}

export interface TabPermissions {
  can_see_today: boolean;
  can_see_plan: boolean;
  can_see_medicines: boolean;
  can_see_ask: boolean;
  can_see_more: boolean;
  can_see_warning_signs: boolean;
  can_see_tests: boolean;
  can_see_find_care: boolean;
  can_see_reminders: boolean;
  can_mark_done: boolean;
}

export type ItemEffectiveStatus =
  | 'pending'
  | 'completed'
  | 'needs_review'
  | 'escalated'
  | 'overdue'
  | 'missed'
  | 'rejected'
  | 'cancelled';

export type ItemCategory = 'appointment' | 'test' | 'care' | 'general';
export type ItemSection = 'OVERDUE' | 'DUE TODAY' | 'NEXT UP' | 'DAILY CARE';

export interface FollowupItem {
  id: string;
  patient_id: string;
  obligation_id?: string | null;
  approved_item_id?: string | null;
  title: string;
  section: ItemSection;
  category: ItemCategory;
  due_date: string;
  due_time?: string;
  effective_status: ItemEffectiveStatus;
  original_text: string;
  source: 'discharge_summary' | 'doctor_added';
  added_by?: string;
  provider_suggestion?: {
    name: string;
    location?: string;
    type?: string;
    phone?: string;
  };
  completed_at?: string | null;
  completed_by?: string | null;
}

export interface ItemTranslation {
  item_id: string;
  language: Language;
  translated_title: string;
  translated_instruction: string;
  is_verified: boolean;
}

export interface Medication {
  id: string;
  patient_id: string;
  approved_item_id?: string | null;
  drug_name: string;
  dose: string;
  how_often: string;
  for_how_long: string;
  original_instruction: string;
}

export interface AdherenceLog {
  id: string;
  medication_id: string;
  date: string; // YYYY-MM-DD
  status: 'taken' | 'not_taken';
  logged_by: string;
  logged_at: string;
}

export interface WarningSign {
  id: string;
  patient_id: string;
  approved_item_id?: string | null;
  original_text: string; // BYTE-FOR-BYTE
  severity: 'critical' | 'urgent';
}

export interface TestResult {
  id: string;
  patient_id: string;
  test_name: string;
  date: string;
  is_released: boolean;
  released_at?: string;
  released_by?: string;
  result_content?: string;
}

export interface Provider {
  id: string;
  name: string;
  kind: 'clinic' | 'lab' | 'hospital' | 'pharmacy' | 'imaging';
  distance: string;
  address: string;
  specialties: string[];
  phone: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  is_active?: boolean;
}

export interface PatientQuestionMessage {
  id: string;
  patient_id: string;
  sender: 'patient' | 'system' | 'care_team';
  sender_name: string;
  text: string;
  created_at: string;
  type: 'question' | 'plan_answer' | 'escalation' | 'doctor_answer' | 'emergency_warning';
  cited_item_ids?: string[];
  escalation_reason?: string;
}

export interface Reminder {
  id: string;
  patient_id: string;
  followup_item_id?: string | null;
  item_title: string;
  due_time: string;
  channel: 'whatsapp' | 'sms';
  is_past: boolean;
  preview_text: string;
  scheduled_at?: string | null;
}

export interface AccessRequest {
  id: string;
  patient_id?: string;
  caregiver_name: string;
  caregiver_email: string;
  relationship: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  decided_at?: string | null;
}

export type ActiveTab = 'today' | 'plan' | 'medicines' | 'ask' | 'more';
export type SubRoute =
  | 'warning_signs'
  | 'tests'
  | 'find_care'
  | 'reminders'
  | 'settings'
  | 'print';

export type CoordinationCardType =
  | 'medication-delay'
  | 'medication-not-taken'
  | 'appointment-question'
  | 'test-delay'
  | 'symptom-report'
  | 'unclear-instruction'
  | 'general-review';

export type CoordinationCardStatus = 'needs-review' | 'acknowledged' | 'resolved';

export interface CoordinationCard {
  id: string;
  patientId: string;
  type: CoordinationCardType;
  raisedBy: 'patient' | 'caregiver';
  raisedByName: string;
  description: string;
  status: CoordinationCardStatus;
  createdAt: string;
  resolvedAt?: string;
  careTeamNotes?: string;
}

export type AIRoute = 'PLAN' | 'MEDICINE' | 'SYMPTOM' | 'EMERGENCY' | 'OTHER';

export interface AIClassificationResult {
  route: AIRoute;
  rawRoute?: string;
  confidence?: number;
  reason?: string;
}

export interface AIPlanAnswerResult {
  route: 'PLAN';
  answer: string;
  cited_item_ids: string[];
}

export interface AITranslationResult {
  translation: string;
  back_translation: string;
  verified: boolean;
  produced_by: 'ai-gemini' | 'doctor';
  target_language: Language;
}

export interface AIExtractionItem {
  category: 'appointment' | 'test' | 'referral' | 'medication' | 'care_instruction' | 'warning_sign' | 'diet' | 'rehab' | 'wound_care';
  original_text: string;
  structured: Record<string, unknown>;
  due_date?: string;
  date_rule?: string;
  confidence: number;
  flags?: string[];
  status: 'approved' | 'needs-review';
}

export interface AIExtractionResult {
  patient_id: string;
  discharge_summary_id: string;
  items: AIExtractionItem[];
  extraction_date: string;
}

export interface AIDraftedTask {
  title: string;
  category: ItemCategory;
  instructions: string;
  due_date?: string;
  confidence: number;
  status: 'needs-review';
}

export interface AIVerifyResult {
  item_id: string;
  verified: boolean;
  verifier_role?: string;
  verified_at: string;
}
