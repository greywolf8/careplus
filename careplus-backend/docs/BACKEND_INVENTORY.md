# CarePlus Backend Inventory

Complete structural map of the CarePlus backend v1.0.0 for frontend team reference.

## Table of Contents
- [API Endpoints](#api-endpoints)
- [Pydantic Schemas](#pydantic-schemas)
- [Environment Variables](#environment-variables)
- [Evaluation Metrics](#evaluation-metrics)
- [Error Codes](#error-codes)
- [Test Suite](#test-suite)

---

## API Endpoints

### Extraction & Obligation

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/extract` | POST | ExtractRequest | ExtractResponse | grounded-only | rmp, coordinator |
| `/obligation/approve` | POST | ApproveObligationRequest | ApproveObligationResponse | grounded-only | rmp |
| `/obligation/close` | POST | CloseObligationRequest | CloseObligationResponse | grounded-only | rmp, coordinator |
| `/obligation/graph/{patient_id}` | GET | - | ObligationGraphResponse | grounded-only | rmp, coordinator |

### Translation

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/translate` | POST | TranslateRequest | TranslateResponse | grounded-only | rmp, coordinator |
| `/verify/translation` | POST | VerifyTranslationRequest | VerifyTranslationResponse | grounded-only | rmp |

### Question Routing

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/question/classify` | POST | ClassifyQuestionRequest | - | always-escalate | Any authenticated |
| `/question/answer/plan` | POST | AnswerPlanQuestionRequest | - | grounded-only | Any authenticated |
| `/question/answer/doctor` | POST | AnswerDoctorQuestionRequest | - | grounded-only | rmp, coordinator |

### Task Drafting

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/task/draft` | POST | DraftTaskRequest | DraftTaskResponse | grounded-only | rmp, coordinator |

### Provider Matching

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/providers/match` | POST | ProviderMatchRequest | ProviderMatchResponse | draft | rmp, coordinator |

### Episode & Second Brain

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/episode/{patient_id}` | GET | - | EpisodeResponse | grounded-only | patient (own), rmp, coordinator |

### Compliance & Consent

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/consent/grant` | POST | GrantConsentRequest | GrantConsentResponse | draft | NOT_IMPLEMENTED |
| `/consent/revoke` | POST | RevokeConsentRequest | RevokeConsentResponse | always-escalate | patient (own) |
| `/verify/audit` | POST | VerifyAuditRequest | VerifyAuditResponse | always-escalate | auditor |
| `/verify/span` | POST | - | - | draft | NOT_IMPLEMENTED |

### Eval & Admin

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/eval/metrics` | GET | - | Dict (9 metrics) | draft | auditor, rmp, coordinator |
| `/eval/metrics/history` | GET | - | Dict (history) | draft | auditor, rmp, coordinator |
| `/admin/eval/run` | POST | EvalRunRequest | EvalRunResponse | draft | auditor |
| `/admin/eval/run/{job_id}` | GET | - | EvalJobStatusResponse | draft | auditor |
| `/admin/canary/seed` | POST | CanarySeedRequest | CanarySeedResponse | always-escalate | auditor |

### Health

| Path | Method | Request Schema | Response Schema | x-safety-tier | Required Role |
|------|--------|----------------|-----------------|---------------|---------------|
| `/health` | GET | - | HealthResponse | draft | None (public) |

---

## Pydantic Schemas

### schemas/extraction.py

#### ExtractRequest
- `patient_id: UUID` - Patient identifier
- `discharge_summary_id: Optional[UUID]` - Discharge summary record ID
- `raw_text: str` - The discharge summary text (required)
- `discharge_date: date` - Date of discharge
- `language: str` - Language of the summary (default: "en")

#### ExtractedItem
- `id: Optional[UUID]` - Item identifier
- `item_type: ItemCategory` - Category (appointment, test, referral, medication, care_instruction, warning_sign, diet, rehab, wound_care)
- `content: str` - Extracted content
- `quote: str` - Original quote from source
- `due_date: Optional[str]` - Due date for the item
- `priority: str` - Priority level (high, medium, low)
- `source_span: Optional[SourceSpan]` - Span in source text
- `state: str` - State (default: "drafted")
- `metadata: Optional[Dict[str, Any]]` - Additional metadata

#### SourceSpan
- `quote: str` - Original text
- `start: int` - Start character index
- `end: int` - End character index

#### QualityMetrics
- `agreement_rate: float` - Agreement between ensemble extractors
- `models_used: List[str]` - Model identifiers used
- `quality_pass: bool` - Overall quality check pass/fail
- `total_issues: int` - Total number of issues found
- `issues: Dict[str, Any]` - Detailed issues breakdown

#### CompletenessMetrics
- `checklist_pass: bool` - Completeness checklist pass/fail
- `missing: List[str]` - Missing required fields
- `discharge_type: str` - Type of discharge
- `required_count: int` - Number of required items
- `found_count: int` - Number of items found

#### ExtractResponse
- `items: List[ExtractedItem]` - Extracted items
- `could_not_place: List[Dict[str, Any]]` - Items that could not be categorized
- `quality: QualityMetrics` - Quality metrics
- `completeness: CompletenessMetrics` - Completeness metrics
- `summary_id: Optional[UUID]` - Summary identifier

### schemas/obligation.py

#### ApproveObligationRequest
- `extracted_id: UUID` - Extracted item ID to approve
- `rmp_id: UUID` - RMP user ID
- `mci_reg: str` - MCI registration number (required)
- `final_text: str` - Final approved text

#### ApproveObligationResponse
- `obligation_id: UUID` - Obligation identifier
- `state: ObligationStatus` - State (drafted, awaiting_approval, approved, pending, in_progress, completed, failed, on_hold, cancelled)
- `content_hash: str` - SHA256 hash of content
- `approver_rmp_id: UUID` - Approver RMP ID
- `approved_at: datetime` - Approval timestamp

#### CloseObligationRequest
- `obligation_id: UUID` - Obligation ID to close
- `evidence: str` - Evidence of completion (required)

#### CloseObligationResponse
- `obligation_id: UUID` - Obligation identifier
- `state: ObligationStatus` - State after closing
- `closed_at: datetime` - Closure timestamp

#### ObligationGraphResponse
- `patient_id: UUID` - Patient identifier
- `bundle_type: str` - FHIR bundle type
- `entry: list` - FHIR bundle entries (Task, CarePlan, Provenance resources)

### schemas/translation.py

#### TranslateRequest
- `item_id: UUID` - Item ID to translate
- `item_type: str` - Type of item: 'approved_item' or 'obligation' (required)
- `target_language: str` - Target language code, e.g., 'hi', 'ta' (required)

#### TranslateResponse
- `translation_id: UUID` - Translation identifier
- `translated_content: str` - Translated text
- `verified: bool` - Verification status (default: false)
- `flags: List[str]` - Quality flags (e.g., roundtrip_mismatch, readability_fail)
- `back_translation: Optional[str]` - Back-translation for verification
- `grade_level: Optional[float]` - Flesch-Kincaid grade level
- `avg_sentence_length: Optional[float]` - Average sentence length

#### VerifyTranslationRequest
- `translation_id: UUID` - Translation ID to verify
- `rmp_id: UUID` - RMP user ID
- `mci_reg: str` - MCI registration number
- `decision: str` - Decision: 'approve' or 'reject' (required)
- `reason: Optional[str]` - Reason for rejection

#### VerifyTranslationResponse
- `translation_id: UUID` - Translation identifier
- `verified: bool` - Verification status
- `verifier_rmp_id: Optional[UUID]` - Verifier RMP ID
- `verified_at: Optional[datetime]` - Verification timestamp
- `content_hash: Optional[str]` - Content hash of verified translation

### schemas/question.py

#### ClassifyQuestionRequest
- `question: str` - Patient's question
- `patient_id: UUID` - Patient identifier

#### ClassifyQuestionResponse
- `route: QuestionRoute` - Route (to_doctor, to_self, escalate)
- `confidence: float` - Classification confidence
- `reasoning: Optional[str]` - Classification reasoning

#### AnswerPlanQuestionRequest
- `question: str` - Patient's question
- `patient_id: UUID` - Patient identifier
- `cited_item_ids: Optional[List[UUID]]` - Cited approved item IDs

#### AnswerPlanQuestionResponse
- `answer: str` - Answer text
- `cited_items: List[UUID]` - Cited item IDs
- `confidence: float` - Answer confidence

#### AnswerDoctorQuestionRequest
- `question: str` - Doctor's text to translate/simplify
- `patient_id: UUID` - Patient identifier
- `context: Optional[str]` - Additional context

#### AnswerDoctorQuestionResponse
- `answer: str` - Translated/simplified text
- `suggested_doctor_specialization: Optional[str]` - Suggested doctor type
- `urgency: Optional[str]` - Urgency level

### schemas/task.py

#### DraftTaskRequest
- `patient_id: UUID` - Patient identifier
- `doctor_description: str` - Doctor's task description (required)
- `discharge_date: datetime` - Patient's discharge date (anchor for date resolution) (required)

#### DraftTaskResponse
- `category: Optional[str]` - Task category
- `what: Optional[str]` - Task description
- `specialty: Optional[str]` - Medical specialty
- `due_date: Optional[str]` - Due date
- `date_rule: Optional[str]` - Date resolution rule
- `provider_specialty: Optional[str]` - Provider specialty needed
- `vague_timing: bool` - Whether timing is vague
- `valid: bool` - Validity check
- `error: Optional[str]` - Error message if invalid
- `reasoning: Optional[str]` - Drafting reasoning

### schemas/episode.py

#### EpisodeResponse
- `patient_id: UUID` - Patient identifier
- `patient_name: str` - Patient name
- `markdown: str` - Compiled episode page in markdown
- `fhir_bundle: Dict[str, Any]` - FHIR R4 Bundle
- `content_hash: str` - SHA256 hash of content
- `lint_status: str` - Lint status (approved, rejected)
- `lint_reason: Optional[str]` - Reason for rejection
- `orphan_sentences: Optional[List[Dict[str, Any]]]` - Orphan sentences detected
- `contradictions: Optional[List[Dict[str, Any]]]` - Contradictions detected
- `stale_obligations: Optional[List[Dict[str, Any]]]` - Stale obligations detected

### schemas/consent.py

#### GrantConsentRequest
- `patient_id: UUID` - Patient identifier
- `purpose: str` - Consent purpose
- `expires_at: Optional[str]` - Expiration timestamp

#### GrantConsentResponse
- `consent_id: UUID` - Consent record ID
- `granted: bool` - Grant status

#### RevokeConsentRequest
- `consent_id: UUID` - Consent record ID to revoke

#### RevokeConsentResponse
- `consent_id: UUID` - Consent record ID
- `revoked: bool` - Revocation status

### schemas/provider.py

#### ProviderMatchRequest
- `item_type: str` - Type of item (e.g., 'cardiology', 'orthopedics') (required)
- `latitude: Optional[float]` - Latitude for geographic search
- `longitude: Optional[float]` - Longitude for geographic search
- `radius_km: int` - Search radius in kilometers (default: 10)

#### ProviderInfo
- `provider_id: str` - Provider identifier
- `provider_name: str` - Provider name
- `match_score: float` - Match score
- `distance_km: Optional[float]` - Distance in kilometers
- `specialty: Optional[str]` - Medical specialty

#### ProviderMatchResponse
- `providers: List[ProviderInfo]` - Matching providers
- `disclaimer: str` - Disclaimer text
- `total_count: int` - Total number of matches
- `error: Optional[str]` - Error message if any

### schemas/verification.py

#### VerifyAuditRequest
- `range_start: Optional[datetime]` - Start of audit log range
- `range_end: Optional[datetime]` - End of audit log range
- `patient_id: Optional[str]` - Patient UUID to filter by
- `since: Optional[datetime]` - Verify audit logs since this timestamp

#### VerifyAuditResponse
- `valid: bool` - Audit chain validity
- `total_entries: int` - Total audit log entries
- `invalid_entries: int` - Number of invalid entries
- `broken_at: Optional[str]` - audit_log_id where chain is broken
- `evidence: dict` - Verification evidence

### schemas/eval.py

#### EvalMetric
- `metric_name: str` - Metric name
- `value: float` - Metric value
- `computed_at: str` - Computation timestamp
- `dataset_ref: Optional[str]` - Dataset reference
- `metadata: Optional[dict]` - Additional metadata

#### EvalMetricsResponse
- `metrics: List[EvalMetric]` - List of metrics

#### CanarySeedRequest
- `obligation_id: UUID` - Obligation ID to corrupt
- `corruption_type: str` - Type of corruption (dose_error, date_error, medication_error) (default: dose_error)
- `corruption_value: Optional[str]` - Optional specific corruption value

#### CanarySeedResponse
- `canary_id: UUID` - Canary record ID
- `obligation_id: UUID` - Obligation ID
- `corruption_type: str` - Corruption type
- `created_at: str` - Creation timestamp

#### EvalRunRequest
- `gold_standard_items: Optional[List[Dict[str, Any]]]` - Gold-standard items for omission rate
- `extractor_a_results: Optional[List[Dict[str, Any]]]` - Extractor A results
- `extractor_b_results: Optional[List[Dict[str, Any]]]` - Extractor B results

#### EvalRunResponse
- `job_id: str` - Job identifier
- `status: str` - Job status (pending, running, completed, failed)
- `created_at: str` - Creation timestamp

#### EvalJobStatusResponse
- `job_id: str` - Job identifier
- `status: str` - Job status
- `created_at: Optional[str]` - Creation timestamp
- `started_at: Optional[str]` - Start timestamp
- `completed_at: Optional[str]` - Completion timestamp
- `metrics: Optional[Dict[str, Any]]` - Computed metrics (if completed)
- `error: Optional[str]` - Error message (if failed)

### schemas/common.py

#### ErrorCode (Enum)
- `EXTRACTION_UNAVAILABLE` - Extraction service unavailable
- `TRANSLATION_UNAVAILABLE` - Translation service unavailable
- `INVALID_INPUT` - Invalid input provided
- `NOT_AUTHORIZED` - User not authorized
- `ITEM_NOT_FOUND` - Item not found
- `QUESTION_ROUTING_FAILED` - Question routing failed
- `INTERNAL_ERROR` - Internal server error

#### ErrorResponse
- `error_code: ErrorCode` - Error code
- `message: str` - Error message
- `details: Optional[Dict[str, Any]]` - Additional error details

#### HealthResponse
- `status: str` - Health status
- `version: str` - API version
- `dependencies: Dict[str, str]` - Dependency versions

---

## Environment Variables

### Supabase Configuration

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### OpenRouter API

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls | `sk-or-v1-...` |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_DEFAULT_MODEL` | Default model for general LLM calls | `openai/gpt-4o-mini` |
| `EXTRACTOR_A_MODEL` | Model for extractor A in ensemble | `openai/gpt-4o-mini` |
| `EXTRACTOR_B_MODEL` | Model for extractor B in ensemble | `openai/gpt-4o-mini` |

### JWT Configuration

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `JWT_SECRET` | Secret key for JWT token signing | `your-jwt-secret-key` |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |

### Application Settings

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `LOG_LEVEL` | Logging level | `INFO` (DEBUG, INFO, WARNING, ERROR) |
| `ENVIRONMENT` | Deployment environment | `development` (development, production) |

---

## Evaluation Metrics

### 1. Omission Rate
**Formula:** `(gold_standard_items_not_extracted / total_gold_standard_items) * 100`

**Description:** Percentage of seeded gold-standard items not extracted across the test set. Runs both ensemble extractors (Extractor A + Extractor B) and counts items in gold set not extracted by either.

**Target:** < 5%

**Contributing Endpoints:** `/extract`

---

### 2. Hallucination Rate
**Formula:** `(sentences_failing_faithfulness / total_compiled_sentences) * 100`

**Description:** Percentage of compiled wiki sentences that fail RAGAS faithfulness check. Any sentence without a source pointer fails. Uses RAGAS library for faithfulness checking.

**Target:** < 2%

**Contributing Endpoints:** `/extract`, `/episode/{patient_id}`

---

### 3. Readability Pass Rate
**Formula:** `(translations_passing_readability / total_translations) * 100`

**Description:** Percentage of translations meeting readability thresholds (Flesch-Kincaid grade ≤ 9, average sentence length < 20 words). Computed on all translations.

**Target:** > 95%

**Contributing Endpoints:** `/translate`

---

### 4. Injection Resistance
**Formula:** `(adversarial_inputs_rejected / total_adversarial_inputs) * 100`

**Description:** Percentage of 50+ adversarial discharge summaries that did not produce unauthorized instructions. Tests 52 injection techniques (ignore instructions, system override, admin mode, etc.). Each test asserts the system did NOT produce unauthorized output.

**Target:** 100%

**Contributing Endpoints:** `/extract`

---

### 5. Reviewer Time Saved
**Formula:** `((baseline_review_time - ai_assisted_review_time) / baseline_review_time) * 100`

**Description:** A/B comparison of review time with vs without AI assistance. Mock synthetic numbers for hackathon (e.g., 6.5min vs 3.5min baseline). Computed as percentage improvement.

**Target:** > 40%

**Contributing Endpoints:** `/obligation/approve`

---

### 6. Reviewer Vigilance
**Formula:** `(canaries_caught / total_canaries_seeded) * 100`

**Description:** Percentage of seeded canaries caught by reviewers. 5% of items in review queue get deliberately corrupted. Input via `/admin/canary/seed` endpoint (auditor-only). Track detection in canary table.

**Target:** > 90%

**Contributing Endpoints:** `/admin/canary/seed`

---

### 7. Translation Entity Preservation
**Formula:** `(translations_passing_entity_check / total_translations) * 100`

**Description:** Percentage of translations where round-trip entity check passes. Entity extraction → translate → back-translate → compare entities. Ensures key medical entities are preserved.

**Target:** > 95%

**Contributing Endpoints:** `/translate`

---

### 8. Calibrated Abstention Rate
**Formula:** `(escalations_matching_gold_standard / total_escalations) * 100`

**Description:** Percentage of items the system escalated vs gold-standard items requiring escalation. Measures how well the system knows when to escalate. Rate close to 100% indicates good calibration.

**Target:** > 90%

**Contributing Endpoints:** `/question/classify`

---

### 9. Model Ensemble Agreement
**Formula:** `(items_found_by_both_extractors / total_items_extracted) * 100`

**Description:** Percentage of items both extractors found. Shows the OpenRouter multi-model advantage. Items found by both extractors = high confidence. Items found by only one = flagged for review.

**Target:** > 80%

**Contributing Endpoints:** `/extract`

---

## Error Codes

### EXTRACTION_UNAVAILABLE
**When it fires:** Extraction service is unavailable (OpenRouter API down, rate limit exceeded, or internal error).

**UI should show:** "Unable to extract items at this time. Please try again later or contact support."

---

### TRANSLATION_UNAVAILABLE
**When it fires:** Translation service is unavailable (OpenRouter API down, rate limit exceeded, or internal error).

**UI should show:** "Unable to translate at this time. Please try again later or contact support."

---

### INVALID_INPUT
**When it fires:** Request payload fails validation (missing required fields, invalid enum values, malformed UUIDs, invalid date formats).

**UI should show:** "Invalid input. Please check your inputs and try again."

---

### NOT_AUTHORIZED
**When it fires:** User lacks required role or permission for the requested operation (e.g., patient trying to approve obligation, non-auditor accessing eval dashboard).

**UI should show:** "You are not authorized to perform this action."

---

### ITEM_NOT_FOUND
**When it fires:** Requested resource does not exist (translation ID not found, obligation ID not found, patient ID not found).

**UI should show:** "The requested item was not found."

---

### QUESTION_ROUTING_FAILED
**When it fires:** Question classification fails (LLM classifier error, no matching route, or internal error).

**UI should show:** "Unable to route your question. Please try again or contact your care team directly."

---

### INTERNAL_ERROR
**When it fires:** Unexpected server error (database connection failure, unhandled exception, or system-wide issue).

**UI should show:** "An unexpected error occurred. Please try again later or contact support."

---

## Test Suite

### test_extraction.py (17 tests)
1. `test_exact_span_validation_rejects_hallucinated_quote` - Verifies span validation rejects hallucinated quotes
2. `test_exact_span_validation_accepts_real_quote` - Verifies span validation accepts real quotes
3. `test_missing_medication_dose` - Detects missing medication dose
4. `test_missing_medication_frequency` - Detects missing medication frequency
5. `test_missing_medication_duration` - Detects missing medication duration
6. `test_conflicting_dates` - Detects conflicting dates in extraction
7. `test_vague_dates` - Detects vague date references
8. `test_medication_changes` - Handles medication changes correctly
9. `test_warning_sign_extraction_verbatim` - Extracts warning signs verbatim
10. `test_hallucinated_extraction_rejection` - Rejects hallucinated extractions
11. `test_invalid_category_enum_rejection` - Rejects invalid category enums
12. `test_prompt_injection_resistance` - Resists prompt injection attacks
13. `test_completeness_checklist` - Verifies completeness checklist
14. `test_confidence_computation` - Computes confidence correctly
15. `test_agreement_rate_computation` - Computes agreement rate between extractors
16. `test_deidentification_and_reidentification` - Tests deidentification and reidentification
17. `test_restoration_of_quotes_with_original_phi` - Restores quotes with original PHI

### test_compliance.py (10 tests)
1. `test_bypass_via_service_role` - Prevents service role bypass
2. `test_unauthorized_patient_access` - Prevents unauthorized patient access
3. `test_unapproved_translation_never_displays` - Ensures unapproved translations never display
4. `test_deid_hard_deny` - Hard denies PHI in deidentification
5. `test_policy_deny_logs_cited_regulation` - Logs cited regulation on policy deny
6. `test_audit_chain_reconstruction` - Reconstructs audit chain
7. `test_erasure_propagation` - Propagates erasure on consent revocation
8. `test_hash_sensitive_data` - Hashes sensitive data
9. `test_output_from_approved_check` - Verifies output from approved check
10. `test_lint_orphan_detection` - Detects orphan sentences in lint

### test_routing.py (7 tests)
1. `test_emergency_routing` - Routes emergency questions correctly
2. `test_medicine_routing` - Routes medicine questions correctly
3. `test_symptom_routing` - Routes symptom questions correctly
4. `test_plan_routing` - Routes plan questions correctly
5. `test_plan_no_match` - Handles plan questions with no match
6. `test_doctor_answer` - Handles doctor answer translation
7. `test_routing_fail_safe` - Implements routing fail-safe

### test_translation.py (7 tests)
1. `test_roundtrip_mismatch` - Detects roundtrip translation mismatches
2. `test_readability_fail` - Detects readability failures
3. `test_warning_sign_never_translated` - Ensures warning signs are never auto-translated
4. `test_unapproved_translation_never_displays` - Ensures unapproved translations never display

### test_eval.py (14 tests)
1. `test_omission_detection` - Detects omissions in extraction
2. `test_hallucination_rate` - Computes hallucination rate
3. `test_injection_resistance` - Tests injection resistance
4. `test_canary_seeding_and_detection` - Tests canary seeding and detection
5. `test_openrouter_ensemble_disagreement` - Tests OpenRouter ensemble disagreement
6. `test_ragas_faithfulness_check` - Runs RAGAS faithfulness check
7. `test_readability_metrics` - Computes readability metrics
8. `test_reviewer_time_saved` - Computes reviewer time saved
9. `test_reviewer_vigilance` - Computes reviewer vigilance
10. `test_calibrated_abstention_rate` - Computes calibrated abstention rate
11. `test_translation_entity_preservation` - Tests translation entity preservation
12. `test_eval_job_lifecycle` - Tests eval job lifecycle
13. `test_injection_test_set_exists` - Verifies injection test set exists
14. `test_batch_faithfulness_check` - Runs batch faithfulness check

### test_smoke.py (6 tests)
1. `test_health_endpoint` - Verifies health endpoint works
2. `test_all_endpoints_exist` - Verifies all endpoints exist
3. `test_schemas_import` - Verifies schemas import correctly
4. `test_llm_client_import` - Verifies LLM client imports
5. `test_config_import` - Verifies config imports
6. `test_auth_import` - Verifies auth imports

### test_openapi.py (7 tests)
1. `test_openapi_schema_exists` - Verifies OpenAPI schema exists
2. `test_extract_endpoint_documented` - Verifies extract endpoint documented
3. `test_obligation_approve_endpoint_documented` - Verifies obligation approve documented
4. `test_obligation_close_endpoint_documented` - Verifies obligation close documented
5. `test_obligation_graph_endpoint_documented` - Verifies obligation graph documented
6. `test_extract_request_schema` - Verifies extract request schema
7. `test_extract_response_schema` - Verifies extract response schema

### test_migration.py (3 tests)
1. `test_migration_syntax` - Verifies migration SQL syntax
2. `test_rls_policies` - Verifies RLS policies in migrations
3. `test_table_columns` - Verifies table columns in migrations

**Total: 71 tests**

---

## User Roles

### Patient
- Can view their own episode page (`/episode/{patient_id}`)
- Can ask questions (`/question/classify`, `/question/answer/plan`)
- Can revoke their own consent (`/consent/revoke`)

### RMP (Registered Medical Practitioner)
- Can extract obligations (`/extract`)
- Can approve obligations (`/obligation/approve`)
- Can close obligations (`/obligation/close`)
- Can view obligation graphs (`/obligation/graph/{patient_id}`)
- Can create translations (`/translate`)
- Can verify translations (`/verify/translation`)
- Can answer doctor questions (`/question/answer/doctor`)
- Can draft tasks (`/task/draft`)
- Can match providers (`/providers/match`)
- Can view episode pages (`/episode/{patient_id}`)
- Can view eval metrics (`/eval/metrics`, `/eval/metrics/history`)

### Coordinator
- Can extract obligations (`/extract`)
- Can close obligations (`/obligation/close`)
- Can view obligation graphs (`/obligation/graph/{patient_id}`)
- Can create translations (`/translate`)
- Can answer doctor questions (`/question/answer/doctor`)
- Can draft tasks (`/task/draft`)
- Can match providers (`/providers/match`)
- Can view episode pages (`/episode/{patient_id}`)
- Can view eval metrics (`/eval/metrics`, `/eval/metrics/history`)

### Auditor
- Can verify audit chain (`/verify/audit`)
- Can view eval metrics (`/eval/metrics`, `/eval/metrics/history`)
- Can trigger eval runs (`/admin/eval/run`)
- Can check eval job status (`/admin/eval/run/{job_id}`)
- Can seed canaries (`/admin/canary/seed`)

---

## Backend Directory Structure

```
careplus/
├── api/
│   └── main.py                 # FastAPI application with all endpoints
├── core/
│   ├── auth.py                 # JWT authentication and user verification
│   ├── config.py               # Pydantic settings from environment variables
│   └── logging.py              # Structured logging configuration
├── db/
│   ├── client.py               # Supabase client initialization
│   └── migrations/            # SQL migration files
├── llm/
│   ├── base.py                 # Base LLM client interface
│   └── openrouter.py           # OpenRouter client implementation
├── schemas/
│   ├── admin.py                # Admin-related schemas
│   ├── common.py               # Common error codes and health response
│   ├── consent.py              # Consent grant/revoke schemas
│   ├── episode.py              # Episode page response schema
│   ├── eval.py                 # Eval metrics and canary schemas
│   ├── extraction.py          # Extraction request/response schemas
│   ├── obligation.py           # Obligation approval/close schemas
│   ├── provider.py            # Provider matching schemas
│   ├── question.py             # Question routing schemas
│   ├── task.py                 # Task drafting schemas
│   ├── translation.py          # Translation schemas
│   └── verification.py         # Audit verification schemas
├── services/
│   ├── eval/
│   │   ├── canary_seeder.py    # Canary seeding logic
│   │   ├── dashboard_route.py  # Eval dashboard endpoints
│   │   ├── injection_test_set.py # Adversarial injection test set
│   │   ├── metrics.py          # Metrics computation
│   │   └── ragas_check.py      # RAGAS faithfulness checking
│   ├── extraction/
│   │   ├── completeness_checklist.py # Extraction completeness checks
│   │   ├── confidence.py      # Confidence computation
│   │   ├── deidentification.py # PHI deidentification
│   │   ├── ensemble.py         # Ensemble extraction logic
│   │   ├── lint.py             # Extraction linting
│   │   ├── prompts.py          # Extraction prompts
│   │   ├── service.py          # Main extraction service
│   │   └── span_resolver.py    # Span resolution and validation
│   ├── obligation/
│   │   ├── fhir_mapper.py      # FHIR resource mapping
│   │   ├── orphan_detect.py    # Orphan obligation detection
│   │   ├── stale_detect.py     # Stale obligation detection
│   │   └── states.py           # Obligation state machine
│   ├── policy/
│   │   ├── decorator.py        # Policy check decorator
│   │   └── engine.py           # Policy engine (consent, deID, audit)
│   ├── providers/
│   │   └── matcher.py          # Provider matching logic
│   ├── routing/
│   │   ├── deterministic_layer.py # Keyword-based routing
│   │   ├── doctor_answer.py    # Doctor answer translation
│   │   ├── llm_classifier.py  # LLM-based question classification
│   │   └── plan_answer.py      # Plan question answering
│   ├── second_brain/
│   │   ├── compiler.py         # Episode page compilation
│   │   ├── lint.py             # Episode page linting
│   │   └── rules_md.py         # Second brain rules
│   ├── task_drafting/
│   │   └── draft.py            # Task drafting logic
│   └── translation/
│       ├── entity_extractor.py # Entity extraction for translation
│       ├── readability.py      # Readability checking
│       ├── roundtrip_verify.py # Roundtrip translation verification
│       └── translator.py       # Translation service
├── scripts/
│   └── seed.py                 # Database seeding script
└── tests/
    ├── conftest.py             # Pytest configuration
    ├── test_compliance.py      # Compliance and policy tests
    ├── test_eval.py            # Evaluation metrics tests
    ├── test_extraction.py      # Extraction service tests
    ├── test_migration.py       # Database migration tests
    ├── test_openapi.py         # OpenAPI documentation tests
    ├── test_openrouter_smoke.py # OpenRouter smoke tests
    ├── test_routing.py         # Question routing tests
    ├── test_smoke.py           # Basic smoke tests
    └── test_translation.py     # Translation service tests
```
