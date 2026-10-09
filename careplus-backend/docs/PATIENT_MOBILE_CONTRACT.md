# Patient Mobile Backend Contract

**Audience:** Future integration of `careplus-mobile` (currently mock/local).  
**Backend prefix:** `/patient/*`  
**Auth:** Same JWT as CarePlus (`role`: `patient`, `caregiver`, or care team).

## Schema

Apply migration `db/migrations/0003_patient_mobile_app.sql` after `0001_init.sql` and `0002_add_translation_fields.sql`.

Patient-visible plan data lives in:

- `followup_item` — Today / Plan tabs (sections computed in API)
- `followup_item_translation` — verified translations only
- `patient_medication`, `adherence_log` — Medicines tab
- `warning_sign` — Warning signs (byte-for-byte `original_text`)
- `test_result` — Tests (released results for patients)
- `care_provider` — Find care
- `patient_message` — Ask tab thread
- `reminder` — Reminders preview
- `caregiver_access_request`, `patient_caregiver_link`, `patient_app_user`, `patient_tab_permissions` — access control
- `coordination_card` — patient/caregiver → care team review

## Care team workflow

1. RMP extracts and approves clinical items (`approved_item`, `obligation`).
2. **POST** `/patient/{patient_id}/sync-plan` (RMP/coordinator) runs `sync_followup_from_approved_item` and copies verified translations into `followup_item_translation`.
3. **POST** `/patient/{patient_id}/test-results/{test_id}/release` publishes lab results to the patient app.
4. **PATCH** `/patient/coordination-cards/{card_id}` updates coordination status (care team).

`POST /obligation/approve` attempts the same sync when the approved row already exists in `approved_item`.

## Patient / caregiver endpoints (summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/patient/me/context` | Resolve patient context (mirrors mock `resolvePatientContext`) |
| GET | `/patient/me/profile` | Profile |
| GET | `/patient/me/tab-permissions` | Tab flags |
| GET | `/patient/{patient_id}/items` | Follow-up items |
| POST | `/patient/{patient_id}/items/{item_id}/mark-done` | Mark done / toggle |
| GET | `/patient/{patient_id}/medications` | Medications |
| POST | `/patient/adherence` | Log adherence |
| GET | `/patient/{patient_id}/warning-signs` | Warning signs |
| GET | `/patient/{patient_id}/test-results` | Test results |
| GET | `/patient/providers/nearby` | Find care |
| GET/POST | `/patient/{patient_id}/messages` | Ask thread |
| POST | `/patient/question` | Classify + persist messages (+ plan answer when safe) |
| GET | `/patient/reminders/{patient_id}` | Reminders |
| GET/POST | `/patient/access-request` | Caregiver access |
| GET/POST | `/patient/{patient_id}/coordination-cards` | Coordination cards |

Mobile app can keep using `supabaseMock.ts` until `VITE_API_BASE_URL` is wired to these routes.
