// Database entity types based on Supabase schema

export type UserRole = 'doctor' | 'patient' | 'caregiver';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  mrn: string;
  full_name: string;
  date_of_birth: string | null;
  sex: 'male' | 'female' | 'other' | null;
  language: string;
  city: string | null;
  discharge_date: string | null;
  care_circle: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorPatient {
  id: string;
  doctor_id: string;
  patient_id: string;
  assigned_at: string;
  active: boolean;
}

export interface FollowupItem {
  id: string;
  patient_id: string;
  category: string;
  what: string;
  specialty: string | null;
  due_date: string | null;
  source: string;
  span_start: number | null;
  span_end: number | null;
  confidence: number;
  status: 'draft' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  effective_status: 'overdue' | 'upcoming' | 'completed' | 'cancelled' | 'pending';
  created_at: string;
  updated_at: string;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  change_note: string | null;
  original_text: string | null;
}

export interface Medication {
  id: string;
  patient_id: string;
  drug: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions_verbatim: string | null;
  missing: boolean;
  status: 'active' | 'stopped' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ReviewFlag {
  id: string;
  patient_id: string;
  item_id: string | null;
  question_id: string | null;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  raised_by: string;
}

export interface PatientQuestion {
  id: string;
  patient_id: string;
  asked_by: string;
  relationship: string;
  question_text: string;
  original_language: string;
  translated_text: string | null;
  answer_text: string | null;
  answer_language: string | null;
  status: 'pending' | 'answered' | 'escalated';
  linked_flag_id: string | null;
  created_at: string;
  answered_at: string | null;
  answered_by: string | null;
}

export interface DischargeSummary {
  id: string;
  patient_id: string;
  raw_text: string;
  language: string;
  created_at: string;
  created_by: string;
}

export interface AuditLog {
  id: string;
  sequence: number;
  time: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  before_data: any;
  after_data: any;
  changed_fields: string[];
  hash: string;
  prev_hash: string | null;
}

export interface PatientAccess {
  id: string;
  patient_id: string;
  user_id: string;
  relationship: string;
  can_mark_done: boolean;
  tab_permissions: string[];
  created_at: string;
}

// View types
export interface PatientAttention {
  patient_id: string;
  patient_name: string;
  age: number;
  sex: string;
  mrn: string;
  language: string;
  city: string;
  discharge_date: string;
  day_number: number;
  care_circle: string;
  urgency_score: number;
  escalated_questions: number;
  open_flags: number;
  overdue_items: number;
  repeated_skips: number;
}

export interface ItemEffective {
  id: string;
  patient_id: string;
  category: string;
  what: string;
  specialty: string | null;
  due_date: string | null;
  source: string;
  confidence: number;
  status: string;
  effective_status: 'overdue' | 'upcoming' | 'completed' | 'cancelled' | 'pending';
  created_at: string;
  updated_at: string;
}
