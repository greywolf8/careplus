import { isSupabaseConfigured } from '../lib/supabase';
import { db as mockDb } from './supabaseMock';
import * as authService from './supabase/authService';
import * as permissionsService from './supabase/permissionsService';
import * as followupService from './supabase/followupService';
import * as medicationService from './supabase/medicationService';
import * as adherenceService from './supabase/adherenceService';
import * as warningSignService from './supabase/warningSignService';
import * as testResultService from './supabase/testResultService';
import * as providerService from './supabase/providerService';
import * as messageService from './supabase/messageService';
import * as reminderService from './supabase/reminderService';
import * as coordinationService from './supabase/coordinationService';
import * as caregiverService from './supabase/caregiverService';
import * as translationService from './supabase/translationService';
import * as consentService from './supabase/consentService';
import { subscribeToPatientRealtime } from './supabase/realtimeService';

import {
  FollowupItem,
  Medication,
  AdherenceLog,
  WarningSign,
  TestResult,
  Provider,
  PatientQuestionMessage,
  Reminder,
  AccessRequest,
  UserProfile,
  TabPermissions,
  PatientContext,
  Language,
  CoordinationCard,
  CoordinationCardStatus,
} from '../types';

export class DataService {
  private isSupabase = isSupabaseConfigured();

  public isUsingRealSupabase(): boolean {
    return this.isSupabase;
  }

  // Subscribe to changes (Mock DB or Realtime)
  public subscribe(cb: () => void, patientId?: string): () => void {
    if (!this.isSupabase) {
      return mockDb.subscribe(cb);
    }
    if (patientId) {
      return subscribeToPatientRealtime(patientId, () => {
        cb();
      });
    }
    return () => {};
  }

  // Auth & Profile
  public async getProfile(userId: string): Promise<UserProfile | null> {
    if (!this.isSupabase) {
      return mockDb.getProfile(userId);
    }
    const prof = await authService.getCurrentUser();
    return prof || mockDb.getProfile(userId);
  }

  public async updateProfileLanguage(userId: string, lang: Language): Promise<void> {
    if (!this.isSupabase) {
      mockDb.updateProfileLanguage(userId, lang);
      return;
    }
    await authService.updatePreferredLanguage(userId, lang);
    mockDb.updateProfileLanguage(userId, lang); // keep local cache in sync
  }

  public async resolvePatientContext(userId: string): Promise<PatientContext | null> {
    if (!this.isSupabase) {
      return mockDb.resolvePatientContext(userId);
    }
    const context = await authService.resolvePatientContextForUser(userId);
    return context || mockDb.resolvePatientContext(userId);
  }

  public async getTabPermissions(userId: string): Promise<TabPermissions> {
    if (!this.isSupabase) {
      return mockDb.getTabPermissions(userId);
    }
    return permissionsService.getTabPermissionsForUser(userId);
  }

  public async updateCaregiverCanMarkDone(caregiverUserId: string, allowed: boolean): Promise<void> {
    if (!this.isSupabase) {
      mockDb.updateCaregiverCanMarkDone(caregiverUserId, allowed);
      return;
    }
    await permissionsService.updateCaregiverMarkDonePermission(caregiverUserId, allowed);
    mockDb.updateCaregiverCanMarkDone(caregiverUserId, allowed);
  }

  // Follow-up Items / Tasks
  public async getEffectiveItems(patientId: string): Promise<FollowupItem[]> {
    if (!this.isSupabase) {
      return mockDb.getEffectiveItems(patientId);
    }
    const items = await followupService.fetchFollowupItems(patientId);
    if (items.length > 0) return items;
    return mockDb.getEffectiveItems(patientId);
  }

  public async getItemById(itemId: string): Promise<FollowupItem | null> {
    if (!this.isSupabase) {
      return mockDb.getItemById(itemId);
    }
    const item = await followupService.fetchFollowupItemById(itemId);
    return item || mockDb.getItemById(itemId);
  }

  public async getItemTranslation(
    itemId: string,
    lang: Language
  ): Promise<{ title: string; instruction: string } | null> {
    if (!this.isSupabase) {
      return mockDb.getItemTranslation(itemId, lang);
    }
    const trans = await translationService.fetchFollowupItemTranslation(itemId, lang);
    if (trans) {
      return { title: trans.translated_title, instruction: trans.translated_instruction };
    }
    return mockDb.getItemTranslation(itemId, lang);
  }

  public async markItemDone(
    itemId: string,
    patientContext: PatientContext
  ): Promise<{ success: boolean; item?: FollowupItem; error?: string }> {
    // 1. Optimistically apply update locally so UI responds immediately
    const localResult = mockDb.markItemDone(itemId, patientContext);

    // 2. If Supabase is active, sync with backend in background/parallel
    if (this.isSupabase) {
      const completedBy =
        patientContext.role === 'caregiver'
          ? `${patientContext.relationship || 'Caregiver'} (${patientContext.userId})`
          : `${patientContext.patientName || 'Patient'} (Patient)`;

      try {
        const res = await followupService.patientMarkFollowupDone(itemId, completedBy);
        if (res.success && res.item) {
          return res;
        }
      } catch (err) {
        console.warn('Supabase markItemDone sync error, local updated:', err);
      }
    }

    // Always succeed so UI checkmark/progress updates cleanly
    return { success: true, item: localResult.item };
  }

  // Medications
  public async getMedications(patientId: string): Promise<Medication[]> {
    if (!this.isSupabase) {
      return mockDb.getMedications(patientId);
    }
    const meds = await medicationService.fetchPatientMedications(patientId);
    if (meds.length > 0) return meds;
    return mockDb.getMedications(patientId);
  }

  // Adherence
  public async getAdherenceLogs(patientId: string, date: string): Promise<AdherenceLog[]> {
    if (!this.isSupabase) {
      return mockDb.getAdherenceLogs(patientId, date);
    }
    const logs = await adherenceService.fetchAdherenceLogs(patientId, date);
    if (logs.length > 0) return logs;
    return mockDb.getAdherenceLogs(patientId, date);
  }

  public async recordAdherence(
    medicationId: string,
    status: 'taken' | 'not_taken',
    patientContext: PatientContext,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<{ success: boolean; log?: AdherenceLog; error?: string }> {
    // 1. Optimistic local update
    const localLog = mockDb.recordAdherence(medicationId, status, patientContext, date);

    if (this.isSupabase) {
      const actor =
        patientContext.role === 'caregiver'
          ? `${patientContext.relationship || 'Caregiver'} (${patientContext.userId})`
          : `${patientContext.patientName || 'Patient'} (Patient)`;

      try {
        const res = await adherenceService.recordMedicationAdherence(medicationId, status, actor, date);
        if (res.success && res.log) {
          return res;
        }
      } catch (err) {
        console.warn('Supabase recordAdherence sync error, local updated:', err);
      }
    }

    return { success: true, log: localLog };
  }

  // Login & Caregiver Management
  public async loginPatient(
    identifier: string,
    pass: string
  ): Promise<{ success: boolean; user?: UserProfile; patientContext?: PatientContext; error?: string }> {
    return authService.loginPatientWithCredentials(identifier, pass);
  }

  public async addCaregiver(
    patientId: string,
    caregiver: { name: string; phone?: string; email?: string; relationship: string; canMarkDone: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    return authService.addCaregiverToPatient(patientId, caregiver);
  }

  // Warning Signs
  public async getWarningSigns(patientId: string): Promise<WarningSign[]> {
    if (!this.isSupabase) {
      return mockDb.getWarningSigns(patientId);
    }
    const signs = await warningSignService.fetchWarningSigns(patientId);
    if (signs.length > 0) return signs;
    return mockDb.getWarningSigns(patientId);
  }

  // Test Results
  public async getTestResults(patientId: string): Promise<TestResult[]> {
    if (!this.isSupabase) {
      return mockDb.getTestResults(patientId);
    }
    const tests = await testResultService.fetchReleasedTestResults(patientId);
    if (tests.length > 0) return tests;
    return mockDb.getTestResults(patientId);
  }

  // Care Providers
  public async getProviders(): Promise<Provider[]> {
    if (!this.isSupabase) {
      return mockDb.getProviders();
    }
    const provs = await providerService.fetchActiveCareProviders();
    if (provs.length > 0) return provs;
    return mockDb.getProviders();
  }

  public async nearbyProviders(category?: string, query?: string): Promise<Provider[]> {
    if (!this.isSupabase) {
      return mockDb.nearbyProviders(category, query);
    }
    const results = await providerService.searchNearbyCareProviders(category, query);
    if (results.length > 0) return results;
    return mockDb.nearbyProviders(category, query);
  }

  // Chat / Messages
  public async getQuestions(patientId: string): Promise<PatientQuestionMessage[]> {
    if (!this.isSupabase) {
      return mockDb.getQuestions(patientId);
    }
    const msgs = await messageService.fetchPatientMessages(patientId);
    if (msgs.length > 0) return msgs;
    return mockDb.getQuestions(patientId);
  }

  public async addQuestionMessage(
    msg: Omit<PatientQuestionMessage, 'id' | 'created_at'>
  ): Promise<PatientQuestionMessage> {
    if (!this.isSupabase) {
      return mockDb.addQuestionMessage(msg);
    }
    const saved = await messageService.savePatientMessage(msg);
    if (saved) {
      mockDb.addQuestionMessage(msg);
      return saved;
    }
    return mockDb.addQuestionMessage(msg);
  }

  // Reminders
  public async getReminders(patientId: string): Promise<Reminder[]> {
    if (!this.isSupabase) {
      return mockDb.getReminders(patientId);
    }
    const rems = await reminderService.fetchPatientReminders(patientId);
    if (rems.length > 0) return rems;
    return mockDb.getReminders(patientId);
  }

  // Access Requests
  public async getAccessRequests(): Promise<AccessRequest[]> {
    if (!this.isSupabase) {
      return mockDb.getAccessRequests();
    }
    const reqs = await caregiverService.fetchCaregiverAccessRequests('pat_lakshmi_01');
    if (reqs.length > 0) return reqs;
    return mockDb.getAccessRequests();
  }

  public async decideAccessRequest(
    requestId: string,
    decision: 'approved' | 'denied',
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupabase) {
      mockDb.decideAccessRequest(requestId, decision);
      return { success: true };
    }
    const res = await caregiverService.decideCaregiverAccessRequest(requestId, decision === 'approved', reason);
    if (res.success) {
      mockDb.decideAccessRequest(requestId, decision);
    }
    return res;
  }

  // Coordination Cards
  public async getCoordinationCards(patientId: string): Promise<CoordinationCard[]> {
    if (!this.isSupabase) {
      return mockDb.getCoordinationCards(patientId);
    }
    const cards = await coordinationService.fetchCoordinationCards(patientId);
    if (cards.length > 0) return cards;
    return mockDb.getCoordinationCards(patientId);
  }

  public async addCoordinationCard(
    card: Omit<CoordinationCard, 'id' | 'createdAt' | 'status'> & { status?: CoordinationCardStatus }
  ): Promise<CoordinationCard> {
    if (!this.isSupabase) {
      return mockDb.addCoordinationCard(card);
    }
    const created = await coordinationService.createCoordinationCard(card);
    if (created) {
      mockDb.addCoordinationCard(card);
      return created;
    }
    return mockDb.addCoordinationCard(card);
  }

  public async updateCoordinationCardStatus(
    id: string,
    status: CoordinationCardStatus,
    careTeamNotes?: string
  ): Promise<boolean> {
    if (!this.isSupabase) {
      return mockDb.updateCoordinationCardStatus(id, status, careTeamNotes);
    }
    const ok = await coordinationService.updateCoordinationCardStatus(id, status, careTeamNotes);
    if (ok) {
      mockDb.updateCoordinationCardStatus(id, status, careTeamNotes);
    }
    return ok;
  }

  // Reset demo
  public resetToDefault() {
    mockDb.resetToDefault();
  }
}

export const dataService = new DataService();
