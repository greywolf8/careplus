# CarePlus Frontend Contract

**Version:** 1.0.0
**Backend Version:** v1.0.0-backend
**Last Updated:** 2026-10-08

This is the single document the frontend team should read first. It contains everything needed to integrate with the CarePlus backend.

---

## Table of Contents
- [User Roles & Authentication](#user-roles--authentication)
- [5 Most Important User Journeys](#5-most-important-user-journeys)
- [All Endpoints by Role](#all-endpoints-by-role)
- [Stable Error Codes](#stable-error-codes)
- [AI-Use Disclosure Text](#ai-use-disclosure-text)
- [Opt-Out Flow](#opt-out-flow)
- [Model Identifier Display](#model-identifier-display)

---

## User Roles & Authentication

### Roles

CarePlus has four user roles:

1. **Patient** - Can view their own episode, ask questions, revoke consent
2. **RMP (Registered Medical Practitioner)** - Can extract, approve, close obligations, create/verify translations, draft tasks, match providers
3. **Coordinator** - Can extract, close obligations, create translations, draft tasks, match providers (cannot approve)
4. **Auditor** - Can verify audit chain, view/run eval metrics, seed canaries

### Authentication Flow

CarePlus uses Supabase Auth for authentication. The frontend should:

1. Use Supabase Auth SDK to authenticate users (email/password, OAuth, magic link)
2. Extract the JWT token from Supabase Auth session
3. Include the JWT token in the `Authorization: Bearer <token>` header for all API calls
4. The backend validates the JWT token and extracts the user's role from the token payload

**Example:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Authenticate user
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get JWT token
const token = data.session.access_token

// Make API call
const response = await fetch('http://localhost:8000/extract', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**JWT Token Payload:**
```json
{
  "sub": "user_id",
  "role": "patient|rmp|coordinator|auditor",
  "email": "user@example.com",
  "patient_id": "uuid"  // Only for patient role
}
```

---

## 5 Most Important User Journeys

### Journey 1: Extract → Approve → Patient Sees

**Actors:** RMP (extracts and approves), Patient (views)

**Flow:**
1. RMP uploads discharge summary → Backend extracts obligations
2. RMP reviews extracted items → RMP approves items
3. Patient views episode page → Patient sees approved items

**Sequence of API Calls:**

#### Step 1: RMP Extracts Obligations

**Request:**
```http
POST /extract
Authorization: Bearer <rmp_jwt_token>
Content-Type: application/json

{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "discharge_summary_id": "660e8400-e29b-41d4-a716-446655440000",
  "raw_text": "Patient was discharged on 2024-01-15 after a 5-day hospital stay for pneumonia. Prescribed medications: Amoxicillin 500mg three times daily for 7 days. Follow-up with primary care physician in 2 weeks. Warning signs: fever above 101°F, difficulty breathing, chest pain.",
  "discharge_date": "2024-01-15",
  "language": "en"
}
```

**Response:**
```json
{
  "items": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "item_type": "medication",
      "content": "Amoxicillin 500mg three times daily for 7 days",
      "quote": "Amoxicillin 500mg three times daily for 7 days",
      "due_date": "2024-01-22",
      "priority": "high",
      "source_span": {
        "quote": "Amoxicillin 500mg three times daily for 7 days",
        "start": 120,
        "end": 165
      },
      "state": "drafted",
      "metadata": null
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "item_type": "appointment",
      "content": "Follow-up with primary care physician in 2 weeks",
      "quote": "Follow-up with primary care physician in 2 weeks",
      "due_date": "2024-01-29",
      "priority": "medium",
      "source_span": {
        "quote": "Follow-up with primary care physician in 2 weeks",
        "start": 166,
        "end": 210
      },
      "state": "drafted",
      "metadata": null
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "item_type": "warning_sign",
      "content": "fever above 101°F, difficulty breathing, chest pain",
      "quote": "fever above 101°F, difficulty breathing, chest pain",
      "due_date": null,
      "priority": "high",
      "source_span": {
        "quote": "fever above 101°F, difficulty breathing, chest pain",
        "start": 211,
        "end": 265
      },
      "state": "drafted",
      "metadata": null
    }
  ],
  "could_not_place": [],
  "quality": {
    "agreement_rate": 0.85,
    "models_used": ["openai/gpt-4o-mini", "openai/gpt-4o-mini"],
    "quality_pass": true,
    "total_issues": 0,
    "issues": {}
  },
  "completeness": {
    "checklist_pass": true,
    "missing": [],
    "discharge_type": "general_medical",
    "required_count": 5,
    "found_count": 5
  },
  "summary_id": "660e8400-e29b-41d4-a716-446655440000"
}
```

**UI Rendering:**
- Display each extracted item in a review card
- Show "Drafted by openai/gpt-4o-mini, awaiting doctor approval" badge
- Highlight warning signs in red
- Show source quote for verification
- Allow RMP to edit content before approval

#### Step 2: RMP Approves Items

**Request:**
```http
POST /obligation/approve
Authorization: Bearer <rmp_jwt_token>
Content-Type: application/json

{
  "extracted_id": "770e8400-e29b-41d4-a716-446655440000",
  "rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "mci_reg": "MCI-12345",
  "final_text": "Amoxicillin 500mg three times daily for 7 days"
}
```

**Response:**
```json
{
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "state": "approved",
  "content_hash": "a1b2c3d4e5f6...",
  "approver_rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "approved_at": "2024-01-15T10:30:00Z"
}
```

**UI Rendering:**
- Update item state from "drafted" to "approved"
- Show "Approved by Dr. [Name] (MCI: MCI-12345)"
- Remove "awaiting approval" badge
- Enable patient to view this item

#### Step 3: Patient Views Episode Page

**Request:**
```http
GET /episode/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <patient_jwt_token>
```

**Response:**
```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "patient_name": "John Doe",
  "markdown": "# Discharge Summary\n\n## Medications\n\n### Amoxicillin 500mg\n- **Dosage:** 500mg three times daily\n- **Duration:** 7 days\n- **Due:** 2024-01-22\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n\n## Appointments\n\n### Follow-up with Primary Care Physician\n- **Due:** 2024-01-29\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n\n## Warning Signs\n\nIf you experience any of the following, contact your care team immediately:\n- Fever above 101°F\n- Difficulty breathing\n- Chest pain\n\n**Note:** Warning signs are displayed in original English only.",
  "fhir_bundle": {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Task",
          "status": "in-progress",
          "description": "Amoxicillin 500mg three times daily for 7 days"
        }
      }
    ]
  },
  "content_hash": "f1e2d3c4b5a6...",
  "lint_status": "approved",
  "lint_reason": null,
  "orphan_sentences": [],
  "contradictions": [],
  "stale_obligations": []
}
```

**UI Rendering:**
- Render markdown as formatted HTML
- Show medications, appointments, warning signs in sections
- Display approver information for each item
- Show warning signs in original English (no auto-translation)
- Display AI-use disclosure at top of page

---

### Journey 2: Patient Asks Plan Question

**Actor:** Patient

**Flow:**
1. Patient asks a question about their care plan
2. Backend classifies question as PLAN
3. Backend answers using approved items
4. Patient sees answer with citations

**Sequence of API Calls:**

#### Step 1: Patient Asks Question

**Request:**
```http
POST /question/classify
Authorization: Bearer <patient_jwt_token>
Content-Type: application/json

{
  "question": "What medications should I take?",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "route": "to_self",
  "escalate": false,
  "confidence": 0.95,
  "reasoning": "Matched keywords: medications, take",
  "warning_signs": [],
  "method": "deterministic"
}
```

**UI Rendering:**
- Show classification result (PLAN route)
- No escalation needed
- Proceed to answer

#### Step 2: Backend Answers Plan Question

**Request:**
```http
POST /question/answer/plan
Authorization: Bearer <patient_jwt_token>
Content-Type: application/json

{
  "question": "What medications should I take?",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "answer": "Based on your discharge plan, you should take the following medication:\n\n**Amoxicillin 500mg**\n- Dosage: Three times daily\n- Duration: 7 days\n- Due date: 2024-01-22\n\nThis information is based on your approved care plan items.",
  "cited_item_ids": ["770e8400-e29b-41d4-a716-446655440000"],
  "escalate": false,
  "confidence": 0.95,
  "reasoning": "Found 1 matching approved item"
}
```

**UI Rendering:**
- Display answer in chat bubble
- Show cited item IDs as references
- Display "Answered by CarePlus AI using openai/gpt-4o-mini" in footer
- Show confidence score if desired

---

### Journey 3: Patient Asks Emergency Question

**Actor:** Patient

**Flow:**
1. Patient asks an emergency question
2. Backend classifies as emergency (deterministic layer)
3. Backend returns escalation
4. UI shows emergency message + care team notification

**Sequence of API Calls:**

#### Step 1: Patient Asks Emergency Question

**Request:**
```http
POST /question/classify
Authorization: Bearer <patient_jwt_token>
Content-Type: application/json

{
  "question": "I have chest pain, what should I do?",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "route": "to_doctor",
  "escalate": true,
  "confidence": 1.0,
  "reasoning": "Matched keywords: chest pain",
  "warning_signs": ["chest pain"],
  "method": "deterministic"
}
```

**UI Rendering:**
- Display red emergency banner
- Show message: "This is an emergency. Your care team has also been notified."
- Show message: "Please call emergency services if you are in immediate danger."
- Do not show any AI-generated answer
- Provide emergency contact information

---

### Journey 4: Coordinator Closes Obligation

**Actor:** Coordinator

**Flow:**
1. Coordinator views patient's obligation graph
2. Coordinator closes completed obligation with evidence
3. Backend updates obligation state

**Sequence of API Calls:**

#### Step 1: Coordinator Views Obligation Graph

**Request:**
```http
GET /obligation/graph/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <coordinator_jwt_token>
```

**Response:**
```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "bundle_type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Task",
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "status": "in-progress",
        "description": "Amoxicillin 500mg three times daily for 7 days",
        "due": "2024-01-22"
      }
    },
    {
      "resource": {
        "resourceType": "Task",
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "status": "in-progress",
        "description": "Follow-up with primary care physician in 2 weeks",
        "due": "2024-01-29"
      }
    }
  ]
}
```

**UI Rendering:**
- Display obligation graph as timeline or card list
- Show status (in-progress, completed, etc.)
- Show due dates
- Allow coordinator to close obligations

#### Step 2: Coordinator Closes Obligation

**Request:**
```http
POST /obligation/close
Authorization: Bearer <coordinator_jwt_token>
Content-Type: application/json

{
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "evidence": "Patient completed 7-day course. No adverse effects reported."
}
```

**Response:**
```json
{
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "state": "completed",
  "closed_at": "2024-01-22T14:30:00Z"
}
```

**UI Rendering:**
- Update obligation status to "completed"
- Show closure timestamp
- Display evidence provided
- Show closed by coordinator

---

### Journey 5: Auditor Opens Eval Dashboard

**Actor:** Auditor

**Flow:**
1. Auditor opens eval dashboard
2. Backend returns all 9 metrics
3. Auditor views metrics and trends

**Sequence of API Calls:**

#### Step 1: Auditor Fetches Eval Metrics

**Request:**
```http
GET /eval/metrics
Authorization: Bearer <auditor_jwt_token>
```

**Response:**
```json
{
  "omission_rate": {
    "value": 2.5,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "hallucination_rate": {
    "value": 1.0,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "readability_pass_rate": {
    "value": 95.0,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "injection_resistance": {
    "value": 100.0,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "reviewer_time_saved": {
    "value": 46.15,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "reviewer_vigilance": {
    "value": 90.0,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "translation_entity_preservation": {
    "value": 97.5,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "calibrated_abstention_rate": {
    "value": 92.0,
    "computed_at": "2024-01-15T10:00:00Z"
  },
  "model_ensemble_agreement": {
    "value": 85.0,
    "computed_at": "2024-01-15T10:00:00Z"
  }
}
```

**UI Rendering:**
- Display metrics in dashboard cards
- Show value and computed_at timestamp
- Use color coding (green for good, yellow for warning, red for critical)
- Allow auditor to view history trends

#### Step 2: Auditor Fetches Metrics History

**Request:**
```http
GET /eval/metrics/history?days=30
Authorization: Bearer <auditor_jwt_token>
```

**Response:**
```json
{
  "omission_rate": [
    {"value": 3.0, "computed_at": "2024-01-01T10:00:00Z"},
    {"value": 2.8, "computed_at": "2024-01-08T10:00:00Z"},
    {"value": 2.5, "computed_at": "2024-01-15T10:00:00Z"}
  ],
  "hallucination_rate": [
    {"value": 1.5, "computed_at": "2024-01-01T10:00:00Z"},
    {"value": 1.2, "computed_at": "2024-01-08T10:00:00Z"},
    {"value": 1.0, "computed_at": "2024-01-15T10:00:00Z"}
  ],
  ...
}
```

**UI Rendering:**
- Display metrics as line charts
- Show trend lines
- Allow auditor to drill down into specific metrics

---

## All Endpoints by Role

### Endpoints Accessible by All Authenticated Users

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/health` | GET | Health check | `HealthResponse` |
| `/question/classify` | POST | Classify patient question | `ClassifyQuestionResponse` |
| `/question/answer/plan` | POST | Answer PLAN question | `AnswerPlanQuestionResponse` |

### Endpoints Accessible by Patient

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/episode/{patient_id}` | GET | Get patient's episode page | `EpisodeResponse` |
| `/consent/revoke` | POST | Revoke consent | `RevokeConsentResponse` |

### Endpoints Accessible by RMP

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/extract` | POST | Extract obligations from discharge summary | `ExtractResponse` |
| `/obligation/approve` | POST | Approve an extracted obligation | `ApproveObligationResponse` |
| `/obligation/close` | POST | Close an obligation as completed | `CloseObligationResponse` |
| `/obligation/graph/{patient_id}` | GET | Get FHIR bundle of obligations | `ObligationGraphResponse` |
| `/translate` | POST | Translate an approved item or obligation | `TranslateResponse` |
| `/verify/translation` | POST | Verify a translation | `VerifyTranslationResponse` |
| `/question/answer/doctor` | POST | Translate doctor's text for patient | `AnswerDoctorQuestionResponse` |
| `/task/draft` | POST | Draft a task from doctor's description | `DraftTaskResponse` |
| `/providers/match` | POST | Find matching providers | `ProviderMatchResponse` |
| `/episode/{patient_id}` | GET | Get patient's episode page | `EpisodeResponse` |
| `/eval/metrics` | GET | Get all evaluation metrics | `Dict` (9 metrics) |
| `/eval/metrics/history` | GET | Get metrics history | `Dict` (history) |

### Endpoints Accessible by Coordinator

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/extract` | POST | Extract obligations from discharge summary | `ExtractResponse` |
| `/obligation/close` | POST | Close an obligation as completed | `CloseObligationResponse` |
| `/obligation/graph/{patient_id}` | GET | Get FHIR bundle of obligations | `ObligationGraphResponse` |
| `/translate` | POST | Translate an approved item or obligation | `TranslateResponse` |
| `/question/answer/doctor` | POST | Translate doctor's text for patient | `AnswerDoctorQuestionResponse` |
| `/task/draft` | POST | Draft a task from doctor's description | `DraftTaskResponse` |
| `/providers/match` | POST | Find matching providers | `ProviderMatchResponse` |
| `/episode/{patient_id}` | GET | Get patient's episode page | `EpisodeResponse` |
| `/eval/metrics` | GET | Get all evaluation metrics | `Dict` (9 metrics) |
| `/eval/metrics/history` | GET | Get metrics history | `Dict` (history) |

### Endpoints Accessible by Auditor

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/verify/audit` | POST | Verify audit chain integrity | `VerifyAuditResponse` |
| `/eval/metrics` | GET | Get all evaluation metrics | `Dict` (9 metrics) |
| `/eval/metrics/history` | GET | Get metrics history | `Dict` (history) |
| `/admin/eval/run` | POST | Trigger a full evaluation run | `EvalRunResponse` |
| `/admin/eval/run/{job_id}` | GET | Get eval run status | `EvalJobStatusResponse` |
| `/admin/canary/seed` | POST | Seed a reviewer canary | `CanarySeedResponse` |

### Not Implemented Endpoints

| Endpoint | Method | Status |
|----------|--------|--------|
| `/consent/grant` | POST | NOT_IMPLEMENTED |
| `/verify/span` | POST | NOT_IMPLEMENTED |

---

## Stable Error Codes

### EXTRACTION_UNAVAILABLE

**When it fires:** Extraction service is unavailable (OpenRouter API down, rate limit exceeded, or internal error).

**UI should show:** "Unable to extract items at this time. Please try again later or contact support."

**HTTP Status:** 500

---

### TRANSLATION_UNAVAILABLE

**When it fires:** Translation service is unavailable (OpenRouter API down, rate limit exceeded, or internal error).

**UI should show:** "Unable to translate at this time. Please try again later or contact support."

**HTTP Status:** 500

---

### INVALID_INPUT

**When it fires:** Request payload fails validation (missing required fields, invalid enum values, malformed UUIDs, invalid date formats).

**UI should show:** "Invalid input. Please check your inputs and try again."

**HTTP Status:** 422

---

### NOT_AUTHORIZED

**When it fires:** User lacks required role or permission for the requested operation (e.g., patient trying to approve obligation, non-auditor accessing eval dashboard).

**UI should show:** "You are not authorized to perform this action."

**HTTP Status:** 403

---

### ITEM_NOT_FOUND

**When it fires:** Requested resource does not exist (translation ID not found, obligation ID not found, patient ID not found).

**UI should show:** "The requested item was not found."

**HTTP Status:** 404

---

### QUESTION_ROUTING_FAILED

**When it fires:** Question classification fails (LLM classifier error, no matching route, or internal error).

**UI should show:** "Unable to route your question. Please try again or contact your care team directly."

**HTTP Status:** 500

---

### INTERNAL_ERROR

**When it fires:** Unexpected server error (database connection failure, unhandled exception, or system-wide issue).

**UI should show:** "An unexpected error occurred. Please try again later or contact support."

**HTTP Status:** 500

---

## AI-Use Disclosure Text

The patient-facing UI must display the following AI-use disclosure text at the top of any page that displays AI-generated content.

### English
```
This system uses AI to help extract, translate, and organize your care information.
All AI-generated content is reviewed and approved by your doctor before you see it.
AI is not a substitute for professional medical advice.
```

### Hindi (हिंदी)
```
यह सिस्टम आपकी देखभाल की जानकारी को निकालने, अनुवाद करने और व्यवस्थित करने में मदद करने के लिए AI का उपयोग करता है।
सभी AI-जनित सामग्री आपके डॉक्टर द्वारा समीक्षा और अनुमोदित की जाती है।
AI पेशेवर चिकित्सा सलाह का विकल्प नहीं है।
```

### Tamil (தமிழ்)
```
இந்த அமைப்பு உங்கள் கவனிப்பு தகவலைப் பிரித்தெடுக்கவும், மொழிபெயர்க்கவும் மற்றும் ஒழுங்கமைக்கவும் AI ஐப் பயன்படுத்துகிறது.
அனைத்து AI-உருவாக்கப்பட்ட உள்ளடக்கமும் நீங்கள் பார்க்கும் முன் உங்கள் மருத்துவரால் மதிப்பாய்வு செய்யப்பட்டு அங்கீகரிக்கப்படுகிறது.
AI தொழில்முறை மருத்துவ ஆலோசனைக்கு மாற்றாக இல்லை.
```

**UI Rendering:**
- Display at the top of patient-facing pages
- Use a neutral background color (e.g., light gray)
- Use a warning or info icon
- Allow patients to dismiss (remember dismissal in local storage)

---

## Opt-Out Flow

Patients can revoke consent for AI processing at any time.

**Sequence:**

1. Patient clicks "Disable AI Processing" button
2. Frontend calls `/consent/revoke`
3. Backend triggers erasure and recompilation
4. Frontend clears cache and updates UI
5. Frontend displays opt-out message

**Request:**
```http
POST /consent/revoke
Authorization: Bearer <patient_jwt_token>
Content-Type: application/json

{
  "consent_id": "200e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "consent_id": "200e8400-e29b-41d4-a716-446655440000",
  "revoked": true
}
```

**UI Rendering:**
- Immediately clear all cached patient data
- Update UI state to reflect erasure
- Display message: "AI processing disabled. Your care team will handle your follow-up manually."
- Do not require user to log out or refresh
- Refresh episode page to fetch post-erasure state

---

## Model Identifier Display

For every endpoint that involves an OpenRouter call, the response includes a model identifier. The UI should display this in a non-intrusive way.

**Endpoints with model identifiers:**
- `/extract` - `quality.models_used` (list of models)
- `/translate` - (model identifier will be in response in future version)
- `/question/classify` - (model identifier will be in response for LLM classifier)
- `/question/answer/plan` - (model identifier will be in response in future version)
- `/question/answer/doctor` - (model identifier will be in response in future version)
- `/task/draft` - (model identifier will be in response in future version)

**UI Rendering:**
- Display model identifier in footer or small text
- Format: "Drafted by openai/gpt-4o-mini, awaiting doctor approval"
- Use subtle styling (small font, gray color)
- Show only for AI-generated content, not for approved content

**Example:**
```typescript
<AIContentFooter>
  Drafted by {model_id}, awaiting doctor approval
</AIContentFooter>
```

---

## API Base URL

**Development:** `http://localhost:8000`
**Production:** `https://api.careplus.example.com` (to be configured)

---

## Rate Limiting

The backend does not currently enforce rate limiting. The frontend should implement client-side rate limiting to prevent abuse:

- Question classification: 10 requests per minute per user
- Plan question answering: 5 requests per minute per user
- Extraction: 1 request per minute per user
- Translation: 5 requests per minute per user

---

## Pagination

The backend does not currently support pagination. All responses return complete datasets. Pagination will be added in future versions for:

- `/obligation/graph/{patient_id}` - for large obligation graphs
- `/episode/{patient_id}` - for large episode pages
- `/providers/match` - for large provider lists

---

## Webhook Support

The backend does not currently support webhooks. Webhooks will be added in future versions for:

- Obligation state changes (drafted → approved → completed)
- New translations available for verification
- Eval job completion

---

## Support

For questions about this contract or the backend API, contact:
- Backend team: [backend-team@example.com]
- API documentation: http://localhost:8000/docs
- OpenAPI spec: http://localhost:8000/openapi.json
