/**
 * Authoritative Supabase Database Schema Types for CarePlus
 * Consists of Core Clinical Layer + Patient PWA Layer
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ==========================================
// 1. CORE CLINICAL LAYER TABLES
// ==========================================

export interface DbPatient {
  id: string;
  name: string;
  date_of_birth?: string | null;
  preferred_language?: string | null;
  phone?: string | null;
  email?: string | null;
  discharge_date?: string | null;
  hospital?: string | null;
  primary_doctor?: string | null;
  discharge_diagnosis?: string | null;
  auth_user_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DbRmp {
  id: string;
  name: string;
  mci_reg_number: string;
  specialization?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DbDischargeSummary {
  id: string;
  patient_id: string;
  admitting_rmp_id?: string | null;
  raw_content: string;
  content_hash?: string | null;
  language?: string | null;
  discharge_date?: string | null;
  created_at: string;
  updated_at?: string | null;
}

// Internal only - Patients MUST NOT see this
export interface DbExtractedItem {
  id: string;
  discharge_summary_id: string;
  item_type: string;
  content: string;
  confidence_score: number;
  source_span?: string | null;
  state?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DbApprovedItem {
  id: string;
  patient_id: string;
  discharge_summary_id?: string | null;
  approver_rmp_id?: string | null;
  item_type: string;
  content: string;
  content_hash?: string | null;
  due_date?: string | null;
  title?: string | null;
  metadata?: Json | null;
  approved_at: string;
  created_at: string;
}

export type DbObligationState = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface DbObligation {
  id: string;
  patient_id: string;
  owner_practitioner_id?: string | null;
  title: string;
  description?: string | null;
  state: DbObligationState;
  due_date?: string | null;
  closure_evidence?: string | null;
  provenance_ref?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DbConsent {
  id: string;
  patient_id: string;
  purpose: string;
  granted_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
}

export interface DbTranslation {
  id: string;
  source_item_id: string;
  source_type: string;
  target_language: string;
  translated_content: string;
  verified: boolean;
  verifier_rmp_id?: string | null;
  produced_by?: string | null;
  back_translation?: string | null;
  flags?: Json | null;
  grade_level?: number | null;
  avg_sentence_length?: number | null;
  content_hash?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type DbPatientQuestionRoute = 'to_doctor' | 'to_self' | 'escalate';

export interface DbPatientQuestion {
  id: string;
  patient_id: string;
  question: string;
  route: DbPatientQuestionRoute;
  answer?: string | null;
  cited_item_ids?: string[] | null;
  created_at: string;
  answered_at?: string | null;
}

// Internal governance tables
export interface DbAuditLog {
  id: string;
  event_type: string;
  actor_id?: string | null;
  patient_id?: string | null;
  details?: Json | null;
  created_at: string;
}

export interface DbPolicyDecision {
  id: string;
  policy_name: string;
  action: string;
  decision: string;
  context?: Json | null;
  created_at: string;
}

// ==========================================
// 2. PATIENT PWA LAYER TABLES
// ==========================================

export type DbUserRole = 'patient' | 'caregiver';

export interface DbPatientAppUser {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  role: DbUserRole;
  preferred_language: string;
  patient_id: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbPatientTabPermissions {
  user_id: string;
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
  updated_at?: string | null;
}

export type DbCaregiverLinkStatus = 'active' | 'revoked' | 'pending';

export interface DbPatientCaregiverLink {
  id: string;
  patient_id: string;
  caregiver_user_id: string;
  caregiver_name: string;
  relationship: string;
  can_mark_done: boolean;
  status: DbCaregiverLinkStatus;
  created_at: string;
}

export type DbFollowupItemSection = 'OVERDUE' | 'DUE TODAY' | 'NEXT UP' | 'DAILY CARE';
export type DbFollowupItemCategory = 'appointment' | 'test' | 'care' | 'general';
export type DbFollowupItemStatus =
  | 'pending'
  | 'completed'
  | 'needs_review'
  | 'escalated'
  | 'overdue'
  | 'missed'
  | 'rejected'
  | 'cancelled';

export interface DbFollowupItem {
  id: string;
  patient_id: string;
  obligation_id?: string | null;
  approved_item_id?: string | null;
  title: string;
  section: DbFollowupItemSection;
  category: DbFollowupItemCategory;
  due_date: string;
  due_time?: string | null;
  effective_status: DbFollowupItemStatus;
  original_text: string;
  source: 'discharge_summary' | 'doctor_added';
  added_by?: string | null;
  provider_suggestion?: Json | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DbFollowupItemTranslation {
  item_id: string;
  language: string;
  translated_title: string;
  translated_instruction: string;
  is_verified: boolean;
  created_at: string;
}

export interface DbPatientMedication {
  id: string;
  patient_id: string;
  approved_item_id?: string | null;
  drug_name: string;
  dose: string;
  how_often: string;
  for_how_long: string;
  original_instruction: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbAdherenceLog {
  id: string;
  medication_id: string;
  log_date: string;
  status: 'taken' | 'not_taken';
  logged_by: string;
  logged_at: string;
}

export interface DbWarningSign {
  id: string;
  patient_id: string;
  approved_item_id?: string | null;
  original_text: string;
  severity: 'critical' | 'urgent';
  created_at: string;
}

export interface DbTestResult {
  id: string;
  patient_id: string;
  test_name: string;
  result_date: string;
  is_released: boolean;
  released_at?: string | null;
  released_by?: string | null;
  result_content?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type DbCareProviderKind = 'clinic' | 'lab' | 'hospital' | 'pharmacy' | 'imaging';

export interface DbCareProvider {
  id: string;
  name: string;
  kind: DbCareProviderKind;
  distance_label?: string | null;
  address: string;
  specialties: string[];
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  created_at: string;
}

export type DbPatientMessageSender = 'patient' | 'system' | 'care_team';
export type DbPatientMessageType =
  | 'question'
  | 'plan_answer'
  | 'escalation'
  | 'doctor_answer'
  | 'emergency_warning';

export interface DbPatientMessage {
  id: string;
  patient_id: string;
  sender: DbPatientMessageSender;
  sender_name: string;
  body: string;
  message_type: DbPatientMessageType;
  cited_item_ids?: string[] | null;
  escalation_reason?: string | null;
  created_at: string;
}

export interface DbReminder {
  id: string;
  patient_id: string;
  followup_item_id?: string | null;
  item_title: string;
  due_time_label: string;
  channel: 'whatsapp' | 'sms';
  is_past: boolean;
  preview_text: string;
  scheduled_at?: string | null;
  created_at: string;
}

export interface DbCaregiverAccessRequest {
  id: string;
  patient_id: string;
  caregiver_name: string;
  caregiver_email: string;
  relationship: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  decided_at?: string | null;
  decided_by_user_id?: string | null;
}

export type DbCoordinationCardType =
  | 'medication-delay'
  | 'medication-not-taken'
  | 'appointment-question'
  | 'test-delay'
  | 'symptom-report'
  | 'unclear-instruction'
  | 'general-review';

export type DbCoordinationCardStatus = 'needs-review' | 'acknowledged' | 'resolved';

export interface DbCoordinationCard {
  id: string;
  patient_id: string;
  card_type: DbCoordinationCardType;
  raised_by: 'patient' | 'caregiver';
  raised_by_name: string;
  description: string;
  status: DbCoordinationCardStatus;
  care_team_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
}
