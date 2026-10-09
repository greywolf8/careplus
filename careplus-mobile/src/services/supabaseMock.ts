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

// Initial synthetic seed data
const SEED_PROFILES: UserProfile[] = [
  {
    id: 'usr_patient_lakshmi',
    name: 'Lakshmi Devi',
    role: 'patient',
    preferred_language: 'en',
    email: 'lakshmi.devi@example.com',
  },
  {
    id: 'usr_caregiver_ramesh',
    name: 'Ramesh Kumar',
    role: 'caregiver',
    preferred_language: 'en',
    email: 'ramesh.kumar@example.com',
  },
];

const SEED_PATIENTS = [
  {
    id: 'pat_lakshmi_01',
    user_id: 'usr_patient_lakshmi',
    full_name: 'Lakshmi Devi',
    discharge_date: '2026-10-04',
    hospital: 'Apollo Speciality Hospitals, Greams Road',
    primary_doctor: 'Dr. Anita Sharma, MD DM (Cardiology)',
    discharge_diagnosis: 'Post-PCI to LAD with Stent, Type 2 Diabetes Mellitus, Essential Hypertension',
  },
];

const SEED_PATIENT_ACCESS = [
  {
    id: 'acc_01',
    patient_id: 'pat_lakshmi_01',
    caregiver_user_id: 'usr_caregiver_ramesh',
    caregiver_name: 'Ramesh Kumar',
    relationship: 'Son',
    can_mark_done: true,
    status: 'active',
  },
];

const SEED_TAB_PERMISSIONS: Record<string, TabPermissions> = {
  usr_patient_lakshmi: {
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
  },
  usr_caregiver_ramesh: {
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
  },
};

const SEED_ITEMS: FollowupItem[] = [
  {
    id: 'item_01',
    patient_id: 'pat_lakshmi_01',
    title: 'Fasting Blood Sugar & HbA1c Lab Sample',
    section: 'OVERDUE',
    category: 'test',
    due_date: '2026-10-07',
    due_time: '08:00 AM',
    effective_status: 'overdue',
    original_text: 'Repeat fasting blood glucose and HbA1c on post-discharge day 3 at accredited pathology lab before 9:00 AM.',
    source: 'discharge_summary',
    provider_suggestion: {
      name: 'Apollo Diagnostics Greams Road',
      location: '1.2 km away',
      type: 'Diagnostic Lab',
      phone: '+91 44 2829 0200',
    },
  },
  {
    id: 'item_02',
    patient_id: 'pat_lakshmi_01',
    title: 'Morning Blood Pressure & Pulse Recording',
    section: 'DUE TODAY',
    category: 'care',
    due_date: '2026-10-08',
    due_time: '09:00 AM',
    effective_status: 'pending',
    original_text: 'Monitor BP twice daily (seated, after 5 min rest). Target systolic < 130 mmHg. Record pulse rate.',
    source: 'discharge_summary',
    provider_suggestion: {
      name: 'Home Care / Digital BP Monitor',
      location: 'At home',
    },
  },
  {
    id: 'item_03',
    patient_id: 'pat_lakshmi_01',
    title: 'Cardiology Wound & Groin Puncture Site Inspection',
    section: 'DUE TODAY',
    category: 'care',
    due_date: '2026-10-08',
    due_time: '11:00 AM',
    effective_status: 'pending',
    original_text: 'Inspect right femoral sheath entry point for any swelling, warmth, or hematoma formation. Keep clean and dry.',
    source: 'discharge_summary',
  },
  {
    id: 'item_04',
    patient_id: 'pat_lakshmi_01',
    title: '12-Lead ECG & Echo Review Appointment',
    section: 'NEXT UP',
    category: 'appointment',
    due_date: '2026-10-15',
    due_time: '10:30 AM',
    effective_status: 'pending',
    original_text: 'Follow-up review with Dr. Anita Sharma at OPD Suite 4 on 15 Oct with repeat 12-lead ECG and echo assessment.',
    source: 'doctor_added',
    added_by: 'Dr. Anita Sharma on 08 Oct',
    provider_suggestion: {
      name: 'Apollo Heart Centre OPD Room 4',
      location: 'Greams Road Block 2',
      type: 'Clinic',
      phone: '+91 44 2829 3333',
    },
  },
  {
    id: 'item_05',
    patient_id: 'pat_lakshmi_01',
    title: 'Gentle 15-Minute Flat Surface Walk',
    section: 'DAILY CARE',
    category: 'care',
    due_date: '2026-10-08',
    due_time: '07:00 AM',
    effective_status: 'completed',
    completed_at: '2026-10-08T07:25:00Z',
    completed_by: 'Lakshmi Devi (Patient)',
    original_text: 'Light flat walking for 15 minutes in shaded area. Avoid strenuous stair climbing or lifting weights > 5 kg.',
    source: 'discharge_summary',
  },
  // Two unresolved items currently undergoing doctor review
  {
    id: 'item_rev_1',
    patient_id: 'pat_lakshmi_01',
    title: 'Dose titration for beta-blocker',
    section: 'NEXT UP',
    category: 'care',
    due_date: '2026-10-10',
    effective_status: 'needs_review',
    original_text: 'Under doctor review for pulse adjustment.',
    source: 'doctor_added',
  },
  {
    id: 'item_rev_2',
    patient_id: 'pat_lakshmi_01',
    title: 'Cardio rehab schedule adjustment',
    section: 'NEXT UP',
    category: 'care',
    due_date: '2026-10-12',
    effective_status: 'needs_review',
    original_text: 'Pending review by physical therapy team.',
    source: 'doctor_added',
  },
];

const SEED_TRANSLATIONS: Record<string, Record<Language, { title: string; instruction: string }>> = {
  item_01: {
    en: {
      title: 'Fasting Blood Sugar & HbA1c Lab Sample',
      instruction: 'Repeat fasting blood glucose and HbA1c on post-discharge day 3 at accredited pathology lab before 9:00 AM.',
    },
    hi: {
      title: 'खाली पेट रक्त शर्करा और HbA1c जाँच नमूना',
      instruction: 'डिस्चार्ज के तीसरे दिन सुबह 9:00 बजे से पहले मान्यता प्राप्त पैथोलॉजी लैब में खाली पेट ब्लड शुगर और HbA1c कराएं।',
    },
    ta: {
      title: 'வெறும் வயிற்று சர்க்கரை மற்றும் HbA1c இரத்த பரிசோதனை',
      instruction: 'டிஸ்சார்ஜ் செய்யப்பட்ட 3வது நாளில் காலை 9:00 மணிக்கு முன் அங்கீகரிக்கப்பட்ட ஆய்வகத்தில் வெறும் வயிற்று இரத்த சர்க்கரை மற்றும் HbA1c எடுக்கவும்.',
    },
  },
  item_02: {
    en: {
      title: 'Morning Blood Pressure & Pulse Recording',
      instruction: 'Monitor BP twice daily (seated, after 5 min rest). Target systolic < 130 mmHg. Record pulse rate.',
    },
    hi: {
      title: 'सुबह का रक्तचाप (BP) और नाड़ी की जाँच',
      instruction: 'दिन में दो बार बीपी मापें (बैठकर, 5 मिनट आराम के बाद)। सिस्टोलिक लक्ष्य < 130 mmHg। नाड़ी की गति नोट करें।',
    },
    ta: {
      title: 'காலை இரத்த அழுத்தம் (BP) மற்றும் நாடித்துடிப்பு பதிவு',
      instruction: 'தினமும் இருமுறை இரத்த அழுத்தத்தை அளவிடவும் (அமர்ந்து, 5 நிமிடம் ஓய்வுக்குப் பிறகு). சிஸ்டாலிக் இலக்கு < 130 mmHg.',
    },
  },
  // Note: item_03 intentionally DOES NOT have a verified translation to trigger the fallback:
  // "Please confirm with your care team."
  item_04: {
    en: {
      title: '12-Lead ECG & Echo Review Appointment',
      instruction: 'Follow-up review with Dr. Anita Sharma at OPD Suite 4 on 15 Oct with repeat 12-lead ECG and echo assessment.',
    },
    hi: {
      title: '12-लीड ईसीजी एवं इको समीक्षा परामर्श',
      instruction: '15 अक्टूबर को ओपीडी सुइट 4 में डॉ. अनीता शर्मा से दोबारा 12-लीड ईसीजी और इको जांच के साथ समीक्षा कराएं।',
    },
    ta: {
      title: '12-லீட் இசிஜி மற்றும் எக்கோ மறுபரிசீலனை சந்திப்பு',
      instruction: 'அக் 15 அன்று ஓபிடி அறை 4 இல் டாக்டர் அனிதா சர்மாவுடன் 12-லீட் இசிஜி மற்றும் எக்கோ பரிசோதனையுடன் சந்திப்பு.',
    },
  },
  item_05: {
    en: {
      title: 'Gentle 15-Minute Flat Surface Walk',
      instruction: 'Light flat walking for 15 minutes in shaded area. Avoid strenuous stair climbing or lifting weights > 5 kg.',
    },
    hi: {
      title: 'समतल स्थान पर 15 मिनट की धीमी चहलकदमी',
      instruction: 'छायादार जगह में 15 मिनट समतल सतह पर हल्का टहलें। सीढ़ियां चढ़ने या 5 किलो से अधिक वजन उठाने से बचें।',
    },
    ta: {
      title: 'சமதளத்தில் 15 நிமிட மெதுவான நடைப்பயிற்சி',
      instruction: 'நிழலான சமதளப் பகுதியில் 15 நிமிடங்கள் லேசான நடைப்பயிற்சி மேற்கொள்ளவும். 5 கிலோவுக்கு மேல் எடை தூக்குவதைத் தவிர்க்கவும்.',
    },
  },
};

const SEED_MEDICATIONS: Medication[] = [
  {
    id: 'med_01',
    patient_id: 'pat_lakshmi_01',
    drug_name: 'Tab. Ticagrelor (Brilinta)',
    dose: '90 mg',
    how_often: 'Twice daily after meals (Morning & Night)',
    for_how_long: '12 months',
    original_instruction: 'Tab Ticagrelor 90mg 1 tab PO BD x 12 months. Do not stop without cardiologist consultation.',
  },
  {
    id: 'med_02',
    patient_id: 'pat_lakshmi_01',
    drug_name: 'Tab. Aspirin (Ecosprin)',
    dose: '75 mg',
    how_often: 'Once daily after lunch',
    for_how_long: 'Lifelong',
    original_instruction: 'Tab Ecosprin 75mg 1 tab PO OD after food indefinitely.',
  },
  {
    id: 'med_03',
    patient_id: 'pat_lakshmi_01',
    drug_name: 'Tab. Atorvastatin (Lipitor)',
    dose: '40 mg',
    how_often: 'Once daily at bedtime',
    for_how_long: 'Ongoing',
    original_instruction: 'Tab Atorvastatin 40mg 1 tab PO HS. Lipid profile monitoring at 6 weeks.',
  },
  {
    id: 'med_04',
    patient_id: 'pat_lakshmi_01',
    drug_name: 'Tab. Metoprolol Succinate (Betaloc ER)',
    dose: '25 mg',
    how_often: 'Once daily in the morning',
    for_how_long: 'Ongoing',
    original_instruction: 'Tab Metoprolol ER 25mg 1 tab PO OD morning. Hold if resting pulse < 55 bpm.',
  },
  {
    id: 'med_05',
    patient_id: 'pat_lakshmi_01',
    drug_name: 'Tab. Metformin',
    dose: '500 mg',
    how_often: 'Twice daily with breakfast and dinner',
    for_how_long: 'Ongoing',
    original_instruction: 'Tab Metformin 500mg PO BD with meals. Check renal parameters periodically.',
  },
];

const SEED_ADHERENCE_LOGS: AdherenceLog[] = [
  {
    id: 'adh_01',
    medication_id: 'med_01',
    date: '2026-10-08',
    status: 'taken',
    logged_by: 'Lakshmi Devi (Patient)',
    logged_at: '2026-10-08T08:15:00Z',
  },
  {
    id: 'adh_02',
    medication_id: 'med_04',
    date: '2026-10-08',
    status: 'taken',
    logged_by: 'Ramesh Kumar (Caregiver)',
    logged_at: '2026-10-08T08:45:00Z',
  },
];

const SEED_WARNING_SIGNS: WarningSign[] = [
  {
    id: 'warn_01',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Sudden severe chest tightness, pressure, crushing sensation or pain radiating to left arm, neck, shoulder, or jaw',
    severity: 'critical',
  },
  {
    id: 'warn_02',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Unexplained breathlessness at rest or waking up gasping for air in the middle of the night',
    severity: 'critical',
  },
  {
    id: 'warn_03',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Repeated dizziness, loss of balance, sudden blackouts, or fainting episodes',
    severity: 'urgent',
  },
  {
    id: 'warn_04',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Bleeding that does not stop after 10 minutes of direct firm pressure (puncture site, gums, urine, or dark tarry stools)',
    severity: 'critical',
  },
  {
    id: 'warn_05',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Rapid swelling of both feet, ankles, or lower legs accompanied by sudden weight gain greater than 2 kg in 48 hours',
    severity: 'urgent',
  },
  {
    id: 'warn_06',
    patient_id: 'pat_lakshmi_01',
    original_text: 'Cold, clammy profuse sweat accompanied by nausea, severe vomiting, and overwhelming weakness',
    severity: 'critical',
  },
];

const SEED_TEST_RESULTS: TestResult[] = [
  {
    id: 'test_01',
    patient_id: 'pat_lakshmi_01',
    test_name: 'Serum Creatinine & eGFR',
    date: '2026-10-06',
    is_released: true,
    released_at: '2026-10-06T14:30:00Z',
    released_by: 'Dr. Anita Sharma',
    result_content: 'Serum Creatinine: 0.9 mg/dL | Estimated GFR: 72 mL/min/1.73m² (Within baseline acceptable limits).',
  },
  {
    id: 'test_02',
    patient_id: 'pat_lakshmi_01',
    test_name: 'Post-PCI High Sensitivity Troponin I',
    date: '2026-10-05',
    is_released: true,
    released_at: '2026-10-05T19:00:00Z',
    released_by: 'Dr. Anita Sharma',
    result_content: 'hs-cTnI: < 0.01 ng/mL (Normal baseline settling post-stent placement).',
  },
  {
    id: 'test_03',
    patient_id: 'pat_lakshmi_01',
    test_name: 'Fasting Lipid Profile Panel',
    date: '2026-10-07',
    is_released: false, // Unreleased
  },
];

const SEED_PROVIDERS: Provider[] = [
  {
    id: 'prov_01',
    name: 'Apollo Diagnostics Centre',
    kind: 'lab',
    distance: '0.9 km',
    address: 'Old No. 34, Greams Road, Thousand Lights, Chennai 600006',
    specialties: ['Cardiac Biomarkers', 'HbA1c', 'Lipid Profiles', 'Home Sample Collection'],
    phone: '+91 44 2829 0200',
    coordinates: { lat: 13.0573, lng: 80.2505 },
  },
  {
    id: 'prov_02',
    name: 'Apollo Heart Centre OPD',
    kind: 'clinic',
    distance: '1.2 km',
    address: 'Greams Lane, Off Greams Road, Chennai 600006',
    specialties: ['Interventional Cardiology', 'Echocardiography', 'Stress Testing', 'Pacemaker Clinic'],
    phone: '+91 44 2829 3333',
    coordinates: { lat: 13.0585, lng: 80.252 },
  },
  {
    id: 'prov_03',
    name: 'MedPlus 24x7 Pharmacy',
    kind: 'pharmacy',
    distance: '0.4 km',
    address: 'No. 12, Thousand Lights West, Chennai 600006',
    specialties: ['Prescription Cardiac Medications', 'Antiplatelet Formulations', 'Cold Chain Storage'],
    phone: '+91 44 4211 5566',
    coordinates: { lat: 13.056, lng: 80.248 },
  },
  {
    id: 'prov_04',
    name: 'ScansWorld Advanced Imaging & Doppler',
    kind: 'imaging',
    distance: '2.1 km',
    address: 'Cathedral Road, Near Music Academy, Chennai 600086',
    specialties: ['Carotid Doppler', '2D Echo Doppler', 'Coronary Calcium Score'],
    phone: '+91 44 2811 7788',
    coordinates: { lat: 13.048, lng: 80.255 },
  },
];

const SEED_QUESTIONS: PatientQuestionMessage[] = [
  {
    id: 'msg_01',
    patient_id: 'pat_lakshmi_01',
    sender: 'care_team',
    sender_name: 'Dr. Anita Sharma',
    text: 'Namaste Lakshmi ji. Glad to see you are resting well at home. Please make sure to check your pulse before taking Betaloc and take Ticagrelor without missing doses.',
    created_at: '2026-10-05T10:00:00Z',
    type: 'doctor_answer',
  },
  {
    id: 'msg_02',
    patient_id: 'pat_lakshmi_01',
    sender: 'patient',
    sender_name: 'Lakshmi Devi',
    text: 'When is my follow-up appointment with Dr. Sharma?',
    created_at: '2026-10-06T11:20:00Z',
    type: 'question',
  },
  {
    id: 'msg_03',
    patient_id: 'pat_lakshmi_01',
    sender: 'system',
    sender_name: 'CarePlus Coordinator',
    text: 'Your follow-up review appointment is scheduled for 15 Oct at 10:30 AM at Apollo Heart Centre OPD Room 4.',
    created_at: '2026-10-06T11:20:05Z',
    type: 'plan_answer',
    cited_item_ids: ['item_04'],
  },
];

const SEED_REMINDERS: Reminder[] = [
  {
    id: 'rem_01',
    patient_id: 'pat_lakshmi_01',
    item_title: 'Morning Blood Pressure & Pulse Recording',
    due_time: '09:00 AM Today',
    channel: 'whatsapp',
    is_past: false,
    preview_text: 'CarePlus Reminder: Lakshmi ji, please measure and record your seated blood pressure and pulse for today.',
  },
  {
    id: 'rem_02',
    patient_id: 'pat_lakshmi_01',
    item_title: 'Tab. Ticagrelor (90mg) Morning Dose',
    due_time: '08:00 AM Today',
    channel: 'sms',
    is_past: true,
    preview_text: 'CarePlus Alert: Reminder to take Tab. Ticagrelor 90mg after breakfast. Log as Taken in CarePlus app.',
  },
  {
    id: 'rem_03',
    patient_id: 'pat_lakshmi_01',
    item_title: '12-Lead ECG Review with Dr. Sharma',
    due_time: '15 Oct, 10:00 AM',
    channel: 'whatsapp',
    is_past: false,
    preview_text: 'CarePlus Appointment: Reminder for your cardiology OPD follow-up at Apollo Heart Centre with Dr. Anita Sharma.',
  },
];

const SEED_ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: 'req_01',
    caregiver_name: 'Priya Kumar',
    caregiver_email: 'priya.k@example.com',
    relationship: 'Daughter',
    status: 'pending',
    requested_at: '2026-10-07T16:00:00Z',
  },
];

const SEED_COORDINATION_CARDS: CoordinationCard[] = [
  {
    id: 'coord-001',
    patientId: 'pat_lakshmi_01',
    type: 'medication-delay',
    raisedBy: 'caregiver',
    raisedByName: 'Ramesh Kumar (Caregiver)',
    description: 'Ticagrelor refill pharmacy delivery delayed until tomorrow afternoon.',
    status: 'needs-review',
    createdAt: '2026-10-08T09:30:00Z',
  },
  {
    id: 'coord-002',
    patientId: 'pat_lakshmi_01',
    type: 'appointment-question',
    raisedBy: 'patient',
    raisedByName: 'Lakshmi Devi (Patient)',
    description: 'Requested wheelchair assistance confirmation at Apollo OPD Suite 4 on 15 Oct.',
    status: 'acknowledged',
    createdAt: '2026-10-07T14:15:00Z',
    careTeamNotes: 'Cardiology nursing station acknowledged: wheelchair booked at hospital entry Block 2.',
  },
];

// Persistent state class with subscribers for Realtime reactivity
class CarePlusDatabase {
  private profiles = [...SEED_PROFILES];
  private patients = [...SEED_PATIENTS];
  private access = [...SEED_PATIENT_ACCESS];
  private permissions = { ...SEED_TAB_PERMISSIONS };
  private items = [...SEED_ITEMS];
  private medications = [...SEED_MEDICATIONS];
  private adherenceLogs = [...SEED_ADHERENCE_LOGS];
  private warningSigns = [...SEED_WARNING_SIGNS];
  private testResults = [...SEED_TEST_RESULTS];
  private providers = [...SEED_PROVIDERS];
  private questions = [...SEED_QUESTIONS];
  private reminders = [...SEED_REMINDERS];
  private accessRequests = [...SEED_ACCESS_REQUESTS];
  private coordinationCards = [...SEED_COORDINATION_CARDS];

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('careplus_local_db_v1');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.items) this.items = data.items;
        if (data.adherenceLogs) this.adherenceLogs = data.adherenceLogs;
        if (data.questions) this.questions = data.questions;
        if (data.accessRequests) this.accessRequests = data.accessRequests;
        if (data.permissions) this.permissions = data.permissions;
        if (data.profiles) this.profiles = data.profiles;
        if (data.coordinationCards) this.coordinationCards = data.coordinationCards;
      }
    } catch {
      // Ignore storage error
    }
  }

  private saveToStorage() {
    try {
      const payload = {
        items: this.items,
        adherenceLogs: this.adherenceLogs,
        questions: this.questions,
        accessRequests: this.accessRequests,
        permissions: this.permissions,
        profiles: this.profiles,
        coordinationCards: this.coordinationCards,
      };
      localStorage.setItem('careplus_local_db_v1', JSON.stringify(payload));
    } catch {
      // Storage full or unavailable
    }
    this.notify();
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Auth & Context Resolution
  public getProfile(userId: string): UserProfile | null {
    return this.profiles.find((p) => p.id === userId) || null;
  }

  public updateProfileLanguage(userId: string, lang: Language) {
    const prof = this.profiles.find((p) => p.id === userId);
    if (prof) {
      prof.preferred_language = lang;
      this.saveToStorage();
    }
  }

  public resolvePatientContext(userId: string): PatientContext | null {
    const profile = this.getProfile(userId);
    if (!profile) return null;

    if (profile.role === 'patient') {
      const pat = this.patients.find((p) => p.user_id === userId);
      if (!pat) return null;
      return {
        userId,
        role: 'patient',
        patientId: pat.id,
        patientName: pat.full_name,
        canMarkDone: true,
      };
    } else {
      // Caregiver: find link in patient_access
      const access = this.access.find((a) => a.caregiver_user_id === userId && a.status === 'active');
      if (!access) return null;
      const pat = this.patients.find((p) => p.id === access.patient_id);
      if (!pat) return null;
      const canMark = this.permissions[userId]?.can_mark_done ?? access.can_mark_done;
      return {
        userId,
        role: 'caregiver',
        patientId: pat.id,
        patientName: pat.full_name,
        relationship: access.relationship,
        canMarkDone: canMark,
      };
    }
  }

  public getTabPermissions(userId: string): TabPermissions {
    return (
      this.permissions[userId] || {
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
      }
    );
  }

  public updateCaregiverCanMarkDone(caregiverUserId: string, allowed: boolean) {
    if (!this.permissions[caregiverUserId]) {
      this.permissions[caregiverUserId] = { ...SEED_TAB_PERMISSIONS.usr_caregiver_ramesh };
    }
    this.permissions[caregiverUserId].can_mark_done = allowed;
    const acc = this.access.find((a) => a.caregiver_user_id === caregiverUserId);
    if (acc) {
      acc.can_mark_done = allowed;
    }
    this.saveToStorage();
  }

  // Items / Tasks
  public getEffectiveItems(patientId: string): FollowupItem[] {
    // Only return records belonging to the resolved patient
    return this.items.filter((item) => item.patient_id === patientId);
  }

  public getItemById(itemId: string): FollowupItem | null {
    return this.items.find((i) => i.id === itemId) || null;
  }

  public getItemTranslation(itemId: string, lang: Language): { title: string; instruction: string } | null {
    const entry = SEED_TRANSLATIONS[itemId];
    if (entry && entry[lang]) {
      return entry[lang];
    }
    return null;
  }

  public markItemDone(itemId: string, patientContext: PatientContext): { success: boolean; item?: FollowupItem } {
    if (!patientContext.canMarkDone) {
      return { success: false };
    }
    const idx = this.items.findIndex((i) => i.id === itemId && i.patient_id === patientContext.patientId);
    if (idx === -1) return { success: false };

    const item = { ...this.items[idx] };
    const isNowDone = item.effective_status !== 'completed';

    item.effective_status = isNowDone ? 'completed' : 'pending';
    item.completed_at = isNowDone ? new Date().toISOString() : null;
    item.completed_by = isNowDone
      ? `${patientContext.role === 'caregiver' ? 'Ramesh Kumar (Caregiver)' : patientContext.patientName + ' (Patient)'}`
      : null;

    this.items[idx] = item;
    this.saveToStorage();
    return { success: true, item };
  }

  // Medications & Adherence
  public getMedications(patientId: string): Medication[] {
    return this.medications.filter((m) => m.patient_id === patientId);
  }

  public getAdherenceLogs(patientId: string, date: string): AdherenceLog[] {
    const patientMedIds = new Set(this.getMedications(patientId).map((m) => m.id));
    return this.adherenceLogs.filter((log) => patientMedIds.has(log.medication_id) && log.date === date);
  }

  public recordAdherence(
    medicationId: string,
    status: 'taken' | 'not_taken',
    patientContext: PatientContext,
    date: string = '2026-10-08'
  ): AdherenceLog {
    const existingIdx = this.adherenceLogs.findIndex(
      (l) => l.medication_id === medicationId && l.date === date
    );

    const actor =
      patientContext.role === 'caregiver'
        ? 'Ramesh Kumar (Caregiver)'
        : `${patientContext.patientName} (Patient)`;

    const newLog: AdherenceLog = {
      id: `adh_${Date.now()}`,
      medication_id: medicationId,
      date,
      status,
      logged_by: actor,
      logged_at: new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      this.adherenceLogs[existingIdx] = newLog;
    } else {
      this.adherenceLogs.push(newLog);
    }

    this.saveToStorage();
    return newLog;
  }

  // Warning Signs (Byte-for-byte)
  public getWarningSigns(patientId: string): WarningSign[] {
    return this.warningSigns.filter((w) => w.patient_id === patientId);
  }

  // Test Results
  public getTestResults(patientId: string): TestResult[] {
    // Both released and unreleased items in plan are listed so patient can see scheduled tests
    return this.testResults.filter((t) => t.patient_id === patientId);
  }

  // Providers & Nearby Search
  public getProviders(): Provider[] {
    return this.providers;
  }

  public nearbyProviders(category?: string, query?: string): Provider[] {
    return this.providers.filter((p) => {
      if (category && category !== 'all' && p.kind !== category) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()) && !p.specialties.some((s) => s.toLowerCase().includes(query.toLowerCase()))) {
        return false;
      }
      return true;
    });
  }

  // Patient Questions & Chat
  public getQuestions(patientId: string): PatientQuestionMessage[] {
    return this.questions.filter((q) => q.patient_id === patientId);
  }

  public addQuestionMessage(msg: Omit<PatientQuestionMessage, 'id' | 'created_at'>): PatientQuestionMessage {
    const fullMsg: PatientQuestionMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.questions.push(fullMsg);
    this.saveToStorage();
    return fullMsg;
  }

  // Reminders
  public getReminders(patientId: string): Reminder[] {
    return this.reminders.filter((r) => r.patient_id === patientId);
  }

  // Access Requests
  public getAccessRequests(): AccessRequest[] {
    return this.accessRequests;
  }

  public decideAccessRequest(requestId: string, decision: 'approved' | 'denied') {
    const req = this.accessRequests.find((r) => r.id === requestId);
    if (req) {
      req.status = decision;
      this.saveToStorage();
    }
  }

  // Coordination Cards (Hospital/Care-Team Review System)
  public getCoordinationCards(patientId: string): CoordinationCard[] {
    return this.coordinationCards.filter((c) => c.patientId === patientId);
  }

  public addCoordinationCard(
    card: Omit<CoordinationCard, 'id' | 'createdAt' | 'status'> & { status?: CoordinationCardStatus }
  ): CoordinationCard {
    const newCard: CoordinationCard = {
      ...card,
      id: `coord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: card.status || 'needs-review',
      createdAt: new Date().toISOString(),
    };
    this.coordinationCards.unshift(newCard);
    this.saveToStorage();
    return newCard;
  }

  public updateCoordinationCardStatus(
    id: string,
    status: CoordinationCardStatus,
    careTeamNotes?: string
  ): boolean {
    const card = this.coordinationCards.find((c) => c.id === id);
    if (!card) return false;
    card.status = status;
    if (careTeamNotes) {
      card.careTeamNotes = careTeamNotes;
    }
    if (status === 'resolved') {
      card.resolvedAt = new Date().toISOString();
    }
    this.saveToStorage();
    return true;
  }

  // Reset database for test/demo
  public resetToDefault() {
    this.items = [...SEED_ITEMS];
    this.adherenceLogs = [...SEED_ADHERENCE_LOGS];
    this.questions = [...SEED_QUESTIONS];
    this.accessRequests = [...SEED_ACCESS_REQUESTS];
    this.permissions = { ...SEED_TAB_PERMISSIONS };
    this.profiles = [...SEED_PROFILES];
    this.coordinationCards = [...SEED_COORDINATION_CARDS];
    localStorage.removeItem('careplus_local_db_v1');
    this.notify();
  }
}

export const db = new CarePlusDatabase();
