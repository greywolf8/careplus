import {
  DbPatient,
  DbApprovedItem,
  DbObligation,
  DbFollowupItem,
  DbFollowupItemTranslation,
  DbPatientMedication,
  DbAdherenceLog,
  DbWarningSign,
  DbTestResult,
  DbCareProvider,
  DbPatientMessage,
  DbReminder,
  DbCoordinationCard,
  DbCaregiverAccessRequest,
  DbPatientTabPermissions,
  DbPatientAppUser,
} from '../types/database';

import {
  FollowupItem,
  ItemTranslation,
  Medication,
  AdherenceLog,
  WarningSign,
  TestResult,
  Provider,
  PatientQuestionMessage,
  Reminder,
  CoordinationCard,
  AccessRequest,
  TabPermissions,
  UserProfile,
  Language,
} from '../types';

export function mapFollowupItem(dbItem: DbFollowupItem): FollowupItem {
  let providerSuggestion: FollowupItem['provider_suggestion'] = undefined;
  if (dbItem.provider_suggestion && typeof dbItem.provider_suggestion === 'object') {
    const ps = dbItem.provider_suggestion as Record<string, unknown>;
    providerSuggestion = {
      name: String(ps.name || ''),
      location: ps.location ? String(ps.location) : undefined,
      type: ps.type ? String(ps.type) : undefined,
      phone: ps.phone ? String(ps.phone) : undefined,
    };
  }

  return {
    id: dbItem.id,
    patient_id: dbItem.patient_id,
    obligation_id: dbItem.obligation_id,
    approved_item_id: dbItem.approved_item_id,
    title: dbItem.title,
    section: dbItem.section,
    category: dbItem.category,
    due_date: dbItem.due_date,
    due_time: dbItem.due_time || undefined,
    effective_status: dbItem.effective_status,
    original_text: dbItem.original_text,
    source: dbItem.source,
    added_by: dbItem.added_by || undefined,
    provider_suggestion: providerSuggestion,
    completed_at: dbItem.completed_at,
    completed_by: dbItem.completed_by,
  };
}

export function mapFollowupItemTranslation(dbTrans: DbFollowupItemTranslation): ItemTranslation {
  return {
    item_id: dbTrans.item_id,
    language: (dbTrans.language as Language) || 'en',
    translated_title: dbTrans.translated_title,
    translated_instruction: dbTrans.translated_instruction,
    is_verified: dbTrans.is_verified,
  };
}

export function mapMedication(dbMed: DbPatientMedication): Medication {
  return {
    id: dbMed.id,
    patient_id: dbMed.patient_id,
    approved_item_id: dbMed.approved_item_id,
    drug_name: dbMed.drug_name,
    dose: dbMed.dose,
    how_often: dbMed.how_often,
    for_how_long: dbMed.for_how_long,
    original_instruction: dbMed.original_instruction,
  };
}

export function mapAdherenceLog(dbLog: DbAdherenceLog): AdherenceLog {
  return {
    id: dbLog.id,
    medication_id: dbLog.medication_id,
    date: dbLog.log_date,
    status: dbLog.status,
    logged_by: dbLog.logged_by,
    logged_at: dbLog.logged_at,
  };
}

export function mapWarningSign(dbWarn: DbWarningSign): WarningSign {
  return {
    id: dbWarn.id,
    patient_id: dbWarn.patient_id,
    approved_item_id: dbWarn.approved_item_id,
    original_text: dbWarn.original_text,
    severity: dbWarn.severity,
  };
}

export function mapTestResult(dbTest: DbTestResult): TestResult {
  return {
    id: dbTest.id,
    patient_id: dbTest.patient_id,
    test_name: dbTest.test_name,
    date: dbTest.result_date,
    is_released: dbTest.is_released,
    released_at: dbTest.released_at || undefined,
    released_by: dbTest.released_by || undefined,
    result_content: dbTest.result_content || undefined,
  };
}

export function mapCareProvider(dbProv: DbCareProvider): Provider {
  return {
    id: dbProv.id,
    name: dbProv.name,
    kind: dbProv.kind,
    distance: dbProv.distance_label || 'Nearby',
    address: dbProv.address,
    specialties: Array.isArray(dbProv.specialties) ? dbProv.specialties : [],
    phone: dbProv.phone,
    coordinates: {
      lat: dbProv.latitude || 13.0573,
      lng: dbProv.longitude || 80.2505,
    },
    is_active: dbProv.is_active,
  };
}

export function mapPatientMessage(dbMsg: DbPatientMessage): PatientQuestionMessage {
  return {
    id: dbMsg.id,
    patient_id: dbMsg.patient_id,
    sender: dbMsg.sender,
    sender_name: dbMsg.sender_name,
    text: dbMsg.body,
    created_at: dbMsg.created_at,
    type: dbMsg.message_type,
    cited_item_ids: dbMsg.cited_item_ids || undefined,
    escalation_reason: dbMsg.escalation_reason || undefined,
  };
}

export function mapReminder(dbRem: DbReminder): Reminder {
  return {
    id: dbRem.id,
    patient_id: dbRem.patient_id,
    followup_item_id: dbRem.followup_item_id,
    item_title: dbRem.item_title,
    due_time: dbRem.due_time_label,
    channel: dbRem.channel,
    is_past: dbRem.is_past,
    preview_text: dbRem.preview_text,
    scheduled_at: dbRem.scheduled_at,
  };
}

export function mapCoordinationCard(dbCard: DbCoordinationCard): CoordinationCard {
  return {
    id: dbCard.id,
    patientId: dbCard.patient_id,
    type: dbCard.card_type,
    raisedBy: dbCard.raised_by,
    raisedByName: dbCard.raised_by_name,
    description: dbCard.description,
    status: dbCard.status,
    createdAt: dbCard.created_at,
    resolvedAt: dbCard.resolved_at || undefined,
    careTeamNotes: dbCard.care_team_notes || undefined,
  };
}

export function mapCaregiverAccessRequest(dbReq: DbCaregiverAccessRequest): AccessRequest {
  return {
    id: dbReq.id,
    patient_id: dbReq.patient_id,
    caregiver_name: dbReq.caregiver_name,
    caregiver_email: dbReq.caregiver_email,
    relationship: dbReq.relationship,
    status: dbReq.status,
    requested_at: dbReq.requested_at,
    decided_at: dbReq.decided_at,
  };
}

export function mapTabPermissions(dbPerms: DbPatientTabPermissions | null): TabPermissions {
  if (!dbPerms) {
    return {
      can_see_today: true,
      can_see_plan: true,
      can_see_medicines: true,
      can_see_ask: true,
      can_see_more: true,
      can_see_warning_signs: true,
      can_see_tests: true,
      can_see_find_care: true,
      can_see_reminders: true,
      can_mark_done: true,
    };
  }
  return {
    can_see_today: dbPerms.can_see_today ?? true,
    can_see_plan: dbPerms.can_see_plan ?? true,
    can_see_medicines: dbPerms.can_see_medicines ?? true,
    can_see_ask: dbPerms.can_see_ask ?? true,
    can_see_more: dbPerms.can_see_more ?? true,
    can_see_warning_signs: dbPerms.can_see_warning_signs ?? true,
    can_see_tests: dbPerms.can_see_tests ?? true,
    can_see_find_care: dbPerms.can_see_find_care ?? true,
    can_see_reminders: dbPerms.can_see_reminders ?? true,
    can_mark_done: dbPerms.can_mark_done ?? true,
  };
}

export function mapAppUser(dbUser: DbPatientAppUser): UserProfile {
  return {
    id: dbUser.id,
    auth_user_id: dbUser.auth_user_id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    preferred_language: (dbUser.preferred_language as Language) || 'en',
    patient_id: dbUser.patient_id,
  };
}
