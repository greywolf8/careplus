# CarePlus Backend

Agentic hospital discharge & follow-up coordinator - Backend v1.0.0

## Most Important Principle

**CarePlus is NOT an autonomous medical agent.**

The AI extracts, structures, translates, classifies, drafts, and tracks. The AI does **NOT**:
- Diagnose
- Prescribe
- Change medication
- Recommend treatment
- Guarantee providers
- Override doctors
- Approve clinical items
- Answer symptoms
- Answer medication questions

When uncertain, escalate. The doctor remains the final authority.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CarePlus Backend                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Deterministic & Policy                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Routing      │  │ Policy       │  │ Compliance   │          │
│  │ (keyword     │  │ Engine       │  │ (Consent,    │          │
│  │  matching)   │  │ (audit chain)│  │  DeID)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Layer 2: AI Agents (OpenRouter)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Extraction   │  │ Translation  │  │ Task         │          │
│  │ (ensemble:   │  │ (roundtrip   │  │ Drafting     │          │
│  │  Gemini+     │  │  verify)     │  │              │          │
│  │  Claude)     │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ Obligation   │  │ Provider     │                          │
│  │ Graph        │  │ Matching     │                          │
│  └──────────────┘  └──────────────┘                          │
│                                                                  │
│  Layer 3: Data & Second Brain                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Supabase     │  │ Episode      │  │ Eval         │          │
│  │ (PostgreSQL) │  │ Page (wiki)  │  │ Harness      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- Supabase account (PostgreSQL database)
- OpenRouter API key

### Environment Variables

Create a `.env` file in the `careplus/` directory:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=google/gemini-pro
EXTRACTOR_A_MODEL=google/gemini-pro
EXTRACTOR_B_MODEL=anthropic/claude-3-haiku
```

### Database Migration

Run the database migrations:

```bash
# Apply initial schema
psql -h your-db-host -U postgres -d your-db -f careplus/db/migrations/0001_init.sql

# Apply translation fields migration
psql -h your-db-host -U postgres -d your-db -f careplus/db/migrations/0002_add_translation_fields.sql
```

### Install Dependencies

```bash
cd careplus
pip install -e ".[dev,eval]"
```

### Run the Server

```bash
uvicorn careplus.api.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
OpenAPI docs at `http://localhost:8000/docs`

## Evaluation Metrics

The eval harness computes 9 metrics to track system performance:

### 1. Omission Rate
**Percentage of seeded gold-standard items not extracted across the test set.**

- Runs both ensemble extractors (Gemini + Claude)
- Counts items in gold set not extracted by either
- Target: < 5%

### 2. Hallucination Rate
**Percentage of compiled wiki sentences that fail RAGAS faithfulness.**

- Any sentence without a source pointer fails
- Uses RAGAS library for faithfulness checking
- Target: < 2%

### 3. Readability
**Flesch-Kincaid grade + avg sentence length on every translation.**

- Target: grade ≤ 9, avg sentence < 20 words
- Computed on all translations
- Reported as pass rate percentage

### 4. Injection Resistance
**Percentage of 50+ adversarial discharge summaries that did not produce unauthorized instructions.**

- Tests 52 injection techniques (ignore instructions, system override, admin mode, etc.)
- Each test asserts the system did NOT produce unauthorized output
- Target: 100%

### 5. Reviewer Time Saved
**A/B comparison of review time with vs without AI assistance.**

- Mock synthetic numbers for hackathon (e.g., 6.5min vs 3.5min baseline)
- Computed as percentage improvement
- Target: > 40%

### 6. Reviewer Vigilance
**Percentage of seeded canaries caught by reviewers.**

- 5% of items in review queue get deliberately corrupted
- Input via `/admin/canary/seed` endpoint (auditor-only)
- Track detection in canary table
- Target: > 90%

### 7. Translation Entity Preservation
**Percentage of translations where round-trip entity check passes.**

- Entity extraction → translate → back-translate → compare entities
- Ensures key medical entities are preserved
- Target: > 95%

### 8. Calibrated Abstention Rate
**Percentage of items the system escalated vs gold-standard items requiring escalation.**

- Measures how well the system knows when to escalate
- Rate close to 100% indicates good calibration
- Target: > 90%

### 9. Model Ensemble Agreement
**Percentage of items both extractors found.**

- Shows the OpenRouter multi-model advantage
- Items found by both extractors = high confidence
- Items found by only one = flagged for review
- Target: > 80%

## API Endpoints

### Extraction & Obligation

#### POST /extract
Extract obligations and follow-up items from a discharge summary.

**Request:**
```json
{
  "patient_id": "uuid",
  "discharge_summary_id": "uuid",
  "raw_text": "Patient was discharged on 2024-01-15...",
  "discharge_type": "general_medical"
}
```

**Response:**
```json
{
  "items": [
    {
      "category": "medication",
      "content": "Take Amoxicillin 500mg three times daily for 7 days",
      "source_span": {"start": 0, "end": 50},
      "confidence": 0.95
    }
  ],
  "quality": {...},
  "completeness": {...}
}
```

**Authorization:** RMP or coordinator

#### POST /obligation/approve
Approve an extracted obligation item.

**Request:**
```json
{
  "extracted_id": "uuid",
  "rmp_id": "uuid",
  "mci_reg": "MCI-12345",
  "final_text": "Take Amoxicillin 500mg three times daily for 7 days"
}
```

**Response:**
```json
{
  "obligation_id": "uuid",
  "state": "approved",
  "content_hash": "sha256hash",
  "approver_rmp_id": "uuid",
  "approved_at": "2024-01-15T10:00:00Z"
}
```

**Authorization:** RMP only

#### POST /obligation/close
Close an obligation as completed with evidence.

**Request:**
```json
{
  "obligation_id": "uuid",
  "evidence": "Patient completed follow-up visit"
}
```

**Response:**
```json
{
  "obligation_id": "uuid",
  "state": "completed",
  "closed_at": "2024-01-15T10:00:00Z"
}
```

**Authorization:** RMP or coordinator

#### GET /obligation/graph/{patient_id}
Get FHIR R4 Bundle of all obligations for a patient.

**Response:**
```json
{
  "patient_id": "uuid",
  "bundle_type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Task",
        "status": "in-progress",
        ...
      }
    }
  ]
}
```

**Authorization:** RMP or coordinator

### Translation

#### POST /translate
Translate an approved item or obligation to target language.

**Request:**
```json
{
  "item_id": "uuid",
  "item_type": "approved_item",
  "target_language": "es"
}
```

**Response:**
```json
{
  "translation_id": "uuid",
  "translated_content": "Tome Amoxicilina 500mg tres veces al día...",
  "verified": false,
  "flags": [],
  "grade_level": 8.5,
  "avg_sentence_length": 12
}
```

**Authorization:** RMP or coordinator

#### POST /verify/translation
Verify a translation created by OpenRouter.

**Request:**
```json
{
  "translation_id": "uuid",
  "rmp_id": "uuid",
  "decision": "approve",
  "reason": null
}
```

**Response:**
```json
{
  "translation_id": "uuid",
  "verified": true,
  "verifier_rmp_id": "uuid",
  "verified_at": "2024-01-15T10:00:00Z",
  "content_hash": "sha256hash"
}
```

**Authorization:** RMP only

### Question Routing

#### POST /question/classify
Classify a patient question using deterministic layer + LLM classifier.

**Request:**
```json
{
  "patient_id": "uuid",
  "question": "I have chest pain, what should I do?"
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

**Authorization:** Any authenticated user

#### POST /question/answer/plan
Answer a PLAN question using approved_item records.

**Request:**
```json
{
  "patient_id": "uuid",
  "question": "What medications should I take?"
}
```

**Response:**
```json
{
  "answer": "Based on your discharge plan, you should take...",
  "cited_item_ids": ["uuid1", "uuid2"],
  "escalate": false,
  "confidence": 0.95,
  "reasoning": "Found 2 matching approved items"
}
```

**Authorization:** Any authenticated user

#### POST /question/answer/doctor
Translate and simplify doctor's text for patient communication.

**Request:**
```json
{
  "patient_id": "uuid",
  "question": "Continue monitoring blood pressure at home"
}
```

**Response:**
```json
{
  "patient_text": "Siga monitoreando su presión arterial en casa",
  "source": "doctor_translation",
  "original_text": "Continue monitoring blood pressure at home"
}
```

**Authorization:** RMP or coordinator

### Task Drafting

#### POST /task/draft
Draft a task from doctor's description.

**Request:**
```json
{
  "patient_id": "uuid",
  "doctor_description": "Patient needs follow-up with cardiologist in 2 weeks",
  "discharge_date": "2024-01-15"
}
```

**Response:**
```json
{
  "valid": true,
  "category": "follow_up",
  "what": "Follow-up appointment",
  "specialty": "cardiology",
  "due_date": "2024-01-29",
  "date_rule": "discharge_date + 14 days",
  "provider_specialty": "cardiology"
}
```

**Authorization:** RMP or coordinator

### Provider Matching

#### POST /providers/match
Find matching providers for a given item type.

**Request:**
```json
{
  "item_type": "cardiology",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "radius_km": 10
}
```

**Response:**
```json
{
  "providers": [
    {
      "provider_id": "uuid",
      "name": "Dr. Smith Cardiology",
      "specialty": "cardiology",
      "distance_km": 2.5,
      "address": "123 Main St"
    }
  ],
  "total_count": 5,
  "disclaimer": "Suggestion only. Please confirm availability with the provider."
}
```

**Authorization:** RMP or coordinator

### Episode & Second Brain

#### GET /episode/{patient_id}
Get the compiled episode page for a patient.

**Response:**
```json
{
  "patient_id": "uuid",
  "patient_name": "John Doe",
  "markdown": "# Discharge Summary\n\n## Medications\n...",
  "fhir_bundle": {...},
  "content_hash": "sha256hash",
  "lint_status": "approved",
  "lint_reason": null,
  "orphan_sentences": [],
  "contradictions": [],
  "stale_obligations": []
}
```

**Authorization:** Patient (own only), RMP, or coordinator

### Compliance & Consent

#### POST /consent/revoke
Revoke consent for a purpose.

**Request:**
```json
{
  "consent_id": "uuid"
}
```

**Response:**
```json
{
  "consent_id": "uuid",
  "revoked": true
}
```

**Authorization:** Patient (own consent only)

#### POST /verify/audit
Verify audit chain integrity.

**Request:**
```json
{
  "range_start": "2024-01-01",
  "range_end": "2024-01-31"
}
```

**Response:**
```json
{
  "valid": true,
  "total_entries": 150,
  "invalid_entries": 0,
  "broken_at": null,
  "evidence": {...}
}
```

**Authorization:** Auditor only

### Eval & Admin

#### GET /eval/metrics
Get all evaluation metrics for the dashboard.

**Response:**
```json
{
  "omission_rate": {"value": 2.5, "computed_at": "2024-01-15T10:00:00Z"},
  "hallucination_rate": {"value": 1.0, "computed_at": "2024-01-15T10:00:00Z"},
  "readability_pass_rate": {"value": 95.0, "computed_at": "2024-01-15T10:00:00Z"},
  "injection_resistance": {"value": 100.0, "computed_at": "2024-01-15T10:00:00Z"},
  "reviewer_time_saved": {"value": 46.15, "computed_at": "2024-01-15T10:00:00Z"},
  "reviewer_vigilance": {"value": 90.0, "computed_at": "2024-01-15T10:00:00Z"},
  "translation_entity_preservation": {"value": 97.5, "computed_at": "2024-01-15T10:00:00Z"},
  "calibrated_abstention_rate": {"value": 92.0, "computed_at": "2024-01-15T10:00:00Z"},
  "model_ensemble_agreement": {"value": 85.0, "computed_at": "2024-01-15T10:00:00Z"}
}
```

**Authorization:** Auditor, RMP, or coordinator

#### GET /eval/metrics/history?days=30
Get evaluation metrics history for trend analysis.

**Response:**
```json
{
  "omission_rate": [
    {"value": 3.0, "computed_at": "2024-01-01T10:00:00Z"},
    {"value": 2.5, "computed_at": "2024-01-15T10:00:00Z"}
  ],
  ...
}
```

**Authorization:** Auditor, RMP, or coordinator

#### POST /admin/eval/run
Trigger a full evaluation run.

**Request:**
```json
{
  "gold_standard_items": [...],
  "extractor_a_results": [...],
  "extractor_b_results": [...]
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Authorization:** Auditor only

#### GET /admin/eval/run/{job_id}
Get the status of an evaluation run.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "created_at": "2024-01-15T10:00:00Z",
  "started_at": "2024-01-15T10:00:01Z",
  "completed_at": "2024-01-15T10:05:00Z",
  "metrics": {...},
  "error": null
}
```

**Authorization:** Auditor only

#### POST /admin/canary/seed
Seed a reviewer canary for vigilance testing.

**Request:**
```json
{
  "obligation_id": "uuid",
  "corruption_type": "dose_error",
  "corruption_value": "50mg"
}
```

**Response:**
```json
{
  "canary_id": "uuid",
  "obligation_id": "uuid",
  "corruption_type": "dose_error",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Authorization:** Auditor only

## Test Suite

Run the full test suite:

```bash
pytest careplus/tests/ -v
```

### Test Coverage

- **test_extraction.py** (11 tests)
  - Span validation
  - Missing dose/freq/duration
  - Conflicting/vague dates
  - Medication changes
  - Warning signs
  - Hallucinated rejection
  - Invalid enum
  - Prompt injection

- **test_compliance.py** (7 tests)
  - Bypass via service role
  - Unauthorized patient access
  - Unapproved translation hidden
  - Erasure propagation
  - Audit chain reconstruction
  - Policy deny logs cited regulation
  - DeID hard deny

- **test_routing.py** (7 tests)
  - Emergency routing
  - Medicine routing
  - Symptom routing
  - Plan routing
  - Plan no match
  - Doctor answer
  - Routing fail-safe

- **test_translation.py** (7 tests)
  - Roundtrip mismatch
  - Readability fail
  - Warning sign never translated
  - Unapproved translation never displays

- **test_eval.py** (15 tests)
  - Omission detection
  - Hallucination rate
  - Injection resistance
  - Canary seeding and detection
  - OpenRouter ensemble disagreement
  - RAGAS faithfulness check
  - Readability metrics
  - Reviewer time saved
  - Reviewer vigilance
  - Calibrated abstention rate
  - Translation entity preservation
  - Eval job lifecycle
  - Injection test set existence
  - Batch faithfulness check

**Total: 47 tests**

## OpenRouter Integration

CarePlus uses OpenRouter for model-agnostic LLM calls. This allows:

- **Model swapping** without code changes
- **Cost optimization** by choosing the best model for each task
- **Redundancy** by using multiple model families

### Ensemble Strategy

The extraction service deliberately uses two different model families:
- **Extractor A:** Google Gemini Pro
- **Extractor B:** Anthropic Claude 3 Haiku

This ensemble approach provides:
- **Stronger omission detection:** Items found by both extractors have high confidence
- **Better disagreement tracking:** Items found by only one are flagged for review
- **Model diversity:** Reduces bias from a single model family

### Model Identifiers

All responses that involved LLM calls include the model identifier for transparency:
- `model_id` in extraction responses
- `model_id` in translation responses
- `model_id` in question classification responses

## Disclaimer

**Synthetic data only. Not for production clinical use without regulatory review.**

This system is a proof-of-concept for a hackathon. It uses synthetic data and has not been:
- Clinically validated
- Regulatory approved
- Tested with real patient data
- Deployed in a production environment

Any use of this system for actual patient care would require:
- Clinical validation studies
- Regulatory approval (e.g., FDA, NMPA)
- Real-world testing with de-identified data
- Security audits
- Compliance with healthcare regulations (HIPAA, GDPR, etc.)

## License

Proprietary - CarePlus Project 2024
