# CarePlus Sample Payloads

Realistic example JSON for the actual backend endpoints. These payloads match the backend response shapes exactly.

**Note:** These are example payloads for reference. In production, hit the live backend at `http://localhost:8000` to capture real responses.

---

## 1. POST /extract

Extract obligations and follow-up items from a discharge summary.

### Request

```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "discharge_summary_id": "660e8400-e29b-41d4-a716-446655440000",
  "raw_text": "Patient was discharged on 2024-01-15 after a 5-day hospital stay for pneumonia. Prescribed medications: Amoxicillin 500mg three times daily for 7 days. Azithromycin 250mg once daily for 5 days. Follow-up with primary care physician in 2 weeks. Complete pulmonary function test in 1 month. Warning signs: fever above 101°F, difficulty breathing, chest pain, persistent cough. Patient advised to continue deep breathing exercises.",
  "discharge_date": "2024-01-15",
  "language": "en"
}
```

### Response

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
      "metadata": {
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "three times daily",
        "duration": "7 days"
      }
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "item_type": "medication",
      "content": "Azithromycin 250mg once daily for 5 days",
      "quote": "Azithromycin 250mg once daily for 5 days",
      "due_date": "2024-01-20",
      "priority": "high",
      "source_span": {
        "quote": "Azithromycin 250mg once daily for 5 days",
        "start": 166,
        "end": 205
      },
      "state": "drafted",
      "metadata": {
        "medication_name": "Azithromycin",
        "dosage": "250mg",
        "frequency": "once daily",
        "duration": "5 days"
      }
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "item_type": "appointment",
      "content": "Follow-up with primary care physician in 2 weeks",
      "quote": "Follow-up with primary care physician in 2 weeks",
      "due_date": "2024-01-29",
      "priority": "medium",
      "source_span": {
        "quote": "Follow-up with primary care physician in 2 weeks",
        "start": 206,
        "end": 250
      },
      "state": "drafted",
      "metadata": {
        "provider_type": "primary care physician",
        "timing": "2 weeks"
      }
    },
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "item_type": "test",
      "content": "Complete pulmonary function test in 1 month",
      "quote": "Complete pulmonary function test in 1 month",
      "due_date": "2024-02-15",
      "priority": "medium",
      "source_span": {
        "quote": "Complete pulmonary function test in 1 month",
        "start": 251,
        "end": 295
      },
      "state": "drafted",
      "metadata": {
        "test_type": "pulmonary function test",
        "timing": "1 month"
      }
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "item_type": "warning_sign",
      "content": "fever above 101°F, difficulty breathing, chest pain, persistent cough",
      "quote": "fever above 101°F, difficulty breathing, chest pain, persistent cough",
      "due_date": null,
      "priority": "high",
      "source_span": {
        "quote": "fever above 101°F, difficulty breathing, chest pain, persistent cough",
        "start": 296,
        "end": 365
      },
      "state": "drafted",
      "metadata": {
        "warning_type": "emergency"
      }
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "item_type": "care_instruction",
      "content": "Continue deep breathing exercises",
      "quote": "Patient advised to continue deep breathing exercises",
      "due_date": null,
      "priority": "low",
      "source_span": {
        "quote": "Patient advised to continue deep breathing exercises",
        "start": 366,
        "end": 410
      },
      "state": "drafted",
      "metadata": {
        "instruction_type": "exercise"
      }
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

---

## 2. POST /obligation/approve

Approve an extracted obligation item.

### Request

```json
{
  "extracted_id": "770e8400-e29b-41d4-a716-446655440000",
  "rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "mci_reg": "MCI-12345",
  "final_text": "Amoxicillin 500mg three times daily for 7 days"
}
```

### Response

```json
{
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "state": "approved",
  "content_hash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "approver_rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "approved_at": "2024-01-15T10:30:00Z"
}
```

---

## 3. GET /obligation/graph/{patient_id}

Get FHIR R4 Bundle of all obligations for a patient.

### Request

```
GET /obligation/graph/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <rmp_jwt_token>
```

### Response

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
        "intent": "order",
        "description": "Amoxicillin 500mg three times daily for 7 days",
        "due": "2024-01-22",
        "priority": "high",
        "authoredOn": "2024-01-15T10:00:00Z",
        "lastModified": "2024-01-15T10:30:00Z",
        "for": {
          "reference": "Patient/550e8400-e29b-41d4-a716-446655440000",
          "display": "John Doe"
        }
      }
    },
    {
      "resource": {
        "resourceType": "Task",
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "status": "in-progress",
        "intent": "order",
        "description": "Azithromycin 250mg once daily for 5 days",
        "due": "2024-01-20",
        "priority": "high",
        "authoredOn": "2024-01-15T10:00:00Z",
        "lastModified": "2024-01-15T10:30:00Z",
        "for": {
          "reference": "Patient/550e8400-e29b-41d4-a716-446655440000",
          "display": "John Doe"
        }
      }
    },
    {
      "resource": {
        "resourceType": "Task",
        "id": "990e8400-e29b-41d4-a716-446655440000",
        "status": "in-progress",
        "intent": "order",
        "description": "Follow-up with primary care physician in 2 weeks",
        "due": "2024-01-29",
        "priority": "medium",
        "authoredOn": "2024-01-15T10:00:00Z",
        "lastModified": "2024-01-15T10:30:00Z",
        "for": {
          "reference": "Patient/550e8400-e29b-41d4-a716-446655440000",
          "display": "John Doe"
        }
      }
    },
    {
      "resource": {
        "resourceType": "Task",
        "id": "aa0e8400-e29b-41d4-a716-446655440000",
        "status": "in-progress",
        "intent": "order",
        "description": "Complete pulmonary function test in 1 month",
        "due": "2024-02-15",
        "priority": "medium",
        "authoredOn": "2024-01-15T10:00:00Z",
        "lastModified": "2024-01-15T10:30:00Z",
        "for": {
          "reference": "Patient/550e8400-e29b-41d4-a716-446655440000",
          "display": "John Doe"
        }
      }
    },
    {
      "resource": {
        "resourceType": "Provenance",
        "id": "prov-770e8400-e29b-41d4-a716-446655440000",
        "target": [
          {
            "reference": "Task/770e8400-e29b-41d4-a716-446655440000"
          }
        ],
        "recorded": "2024-01-15T10:30:00Z",
        "agent": [
          {
            "type": {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/provenance-agent-type",
                  "code": "author"
                }
              ]
            },
            "who": {
              "reference": "Practitioner/100e8400-e29b-41d4-a716-446655440000",
              "display": "Dr. Smith (MCI: MCI-12345)"
            }
          }
        ],
        "signature": [
          {
            "type": [
              {
                "system": "urn:iso-astm:E1762-95:2013",
                "code": "1.2.840.10065.1.12.1.1",
                "display": "Author's Signature"
              }
            ],
            "data": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
          }
        ]
      }
    }
  ]
}
```

---

## 4. GET /episode/{patient_id}

Get the compiled episode page for a patient.

### Request

```
GET /episode/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <patient_jwt_token>
```

### Response

```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "patient_name": "John Doe",
  "markdown": "# Discharge Summary\n\nPatient was discharged on 2024-01-15 after a 5-day hospital stay for pneumonia.\n\n## Medications\n\n### Amoxicillin 500mg [[source:approved_item:770e8400-e29b-41d4-a716-446655440000]]\n- **Dosage:** 500mg three times daily\n- **Duration:** 7 days\n- **Due:** 2024-01-22\n- **Priority:** High\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n- **Approved at:** 2024-01-15T10:30:00Z\n\n### Azithromycin 250mg [[source:approved_item:880e8400-e29b-41d4-a716-446655440000]]\n- **Dosage:** 250mg once daily\n- **Duration:** 5 days\n- **Due:** 2024-01-20\n- **Priority:** High\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n- **Approved at:** 2024-01-15T10:30:00Z\n\n## Appointments\n\n### Follow-up with Primary Care Physician [[source:approved_item:990e8400-e29b-41d4-a716-446655440000]]\n- **Due:** 2024-01-29\n- **Priority:** Medium\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n- **Approved at:** 2024-01-15T10:30:00Z\n\n## Tests\n\n### Pulmonary Function Test [[source:approved_item:aa0e8400-e29b-41d4-a716-446655440000]]\n- **Due:** 2024-02-15\n- **Priority:** Medium\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n- **Approved at:** 2024-01-15T10:30:00Z\n\n## Warning Signs\n\nIf you experience any of the following, contact your care team immediately:\n- Fever above 101°F [[source:approved_item:bb0e8400-e29b-41d4-a716-446655440000]]\n- Difficulty breathing [[source:approved_item:bb0e8400-e29b-41d4-a716-446655440000]]\n- Chest pain [[source:approved_item:bb0e8400-e29b-41d4-a716-446655440000]]\n- Persistent cough [[source:approved_item:bb0e8400-e29b-41d4-a716-446655440000]]\n\n**Note:** Warning signs are displayed in original English only.\n\n## Care Instructions\n\n### Deep Breathing Exercises [[source:approved_item:cc0e8400-e29b-41d4-a716-446655440000]]\n- Continue deep breathing exercises as advised\n- **Priority:** Low\n- **Approved by:** Dr. Smith (MCI: MCI-12345)\n- **Approved at:** 2024-01-15T10:30:00Z",
  "fhir_bundle": {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Composition",
          "id": "episode-550e8400-e29b-41d4-a716-446655440000",
          "status": "final",
          "type": {
            "coding": [
              {
                "system": "http://loinc.org",
                "code": "18842-5",
                "display": "Discharge summary"
              }
            ]
          },
          "subject": {
            "reference": "Patient/550e8400-e29b-41d4-a716-446655440000",
            "display": "John Doe"
          },
          "date": "2024-01-15T10:00:00Z",
          "author": [
            {
              "reference": "Practitioner/100e8400-e29b-41d4-a716-446655440000",
              "display": "Dr. Smith"
            }
          ],
          "section": [
            {
              "title": "Medications",
              "code": {
                "coding": [
                  {
                    "system": "http://loinc.org",
                    "code": "10160-0",
                    "display": "History of Medication use"
                  }
                ]
              },
              "entry": [
                {
                  "reference": "MedicationAdministration/770e8400-e29b-41d4-a716-446655440000"
                },
                {
                  "reference": "MedicationAdministration/880e8400-e29b-41d4-a716-446655440000"
                }
              ]
            }
          ]
        }
      }
    ]
  },
  "content_hash": "f1e2d3c4b5a6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
  "lint_status": "approved",
  "lint_reason": null,
  "orphan_sentences": [],
  "contradictions": [],
  "stale_obligations": []
}
```

---

## 5. POST /question/classify

Classify a patient question using deterministic layer + LLM classifier.

### Request (Emergency Question)

```json
{
  "question": "I have chest pain, what should I do?",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response

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

---

## 6. POST /question/answer/plan

Answer a PLAN question using approved_item records.

### Request

```json
{
  "question": "What medications should I take?",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Response

```json
{
  "answer": "Based on your discharge plan, you should take the following medications:\n\n**Amoxicillin 500mg**\n- Dosage: Three times daily\n- Duration: 7 days\n- Due date: 2024-01-22\n\n**Azithromycin 250mg**\n- Dosage: Once daily\n- Duration: 5 days\n- Due date: 2024-01-20\n\nThis information is based on your approved care plan items. Please follow the dosage instructions as prescribed by your doctor.",
  "cited_item_ids": [
    "770e8400-e29b-41d4-a716-446655440000",
    "880e8400-e29b-41d4-a716-446655440000"
  ],
  "escalate": false,
  "confidence": 0.95,
  "reasoning": "Found 2 matching approved items in patient's care plan"
}
```

---

## 7. POST /translate

Translate an approved item or obligation to target language.

### Request (Tamil Translation)

```json
{
  "item_id": "770e8400-e29b-41d4-a716-446655440000",
  "item_type": "approved_item",
  "target_language": "ta"
}
```

### Response

```json
{
  "translation_id": "dd0e8400-e29b-41d4-a716-446655440000",
  "translated_content": "நீங்கள் ஒரு நாளைக்கு மூன்று முறை 500 மில்லிகிராம் ஆமோக்சிசிலின் எடுத்துக்கொள்ள வேண்டும், 7 நாட்களுக்கு.",
  "verified": false,
  "flags": [],
  "back_translation": "You should take 500 milligrams Amoxicillin three times a day, for 7 days.",
  "grade_level": 8.5,
  "avg_sentence_length": 12.3
}
```

**Note:** The `model_id` field will be added in a future version to indicate which OpenRouter model was used for the translation.

---

## 8. POST /verify/translation

Verify a translation created by OpenRouter.

### Request

```json
{
  "translation_id": "dd0e8400-e29b-41d4-a716-446655440000",
  "rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "mci_reg": "MCI-12345",
  "decision": "approve",
  "reason": null
}
```

### Response

```json
{
  "translation_id": "dd0e8400-e29b-41d4-a716-446655440000",
  "verified": true,
  "verifier_rmp_id": "100e8400-e29b-41d4-a716-446655440000",
  "verified_at": "2024-01-15T11:00:00Z",
  "content_hash": "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
}
```

---

## 9. POST /consent/revoke

Revoke consent for a purpose (triggers erasure).

### Request

```json
{
  "consent_id": "200e8400-e29b-41d4-a716-446655440000"
}
```

### Response

```json
{
  "consent_id": "200e8400-e29b-41d4-a716-446655440000",
  "revoked": true
}
```

**Note:** This triggers the `recompile_after_erasure` function which:
- Deletes source rows (discharge_summary, approved_item) for that patient + purpose
- Calls compile_episode_page to rebuild the wiki
- Lint pass verifies no orphan pointers remain
- Audit logs the erasure with the consent revocation hash as anchor

---

## 10. GET /eval/metrics

Get all evaluation metrics for the dashboard.

### Request

```
GET /eval/metrics
Authorization: Bearer <auditor_jwt_token>
```

### Response

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

---

## Additional Example: POST /task/draft

Draft a task from doctor's description.

### Request

```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "doctor_description": "Patient needs follow-up with cardiologist in 2 weeks for ECG",
  "discharge_date": "2024-01-15"
}
```

### Response

```json
{
  "category": "appointment",
  "what": "Follow-up with cardiologist for ECG",
  "specialty": "cardiology",
  "due_date": "2024-01-29",
  "date_rule": "discharge_date + 14 days",
  "provider_specialty": "cardiology",
  "vague_timing": false,
  "valid": true,
  "error": null,
  "reasoning": "Extracted appointment with cardiologist due 2 weeks after discharge"
}
```

---

## Additional Example: POST /providers/match

Find matching providers for a given item type.

### Request

```json
{
  "item_type": "cardiology",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "radius_km": 10
}
```

### Response

```json
{
  "providers": [
    {
      "provider_id": "prov-001",
      "provider_name": "Dr. Jane Smith Cardiology",
      "match_score": 0.95,
      "distance_km": 2.5,
      "specialty": "cardiology"
    },
    {
      "provider_id": "prov-002",
      "provider_name": "NYC Heart Center",
      "match_score": 0.88,
      "distance_km": 3.2,
      "specialty": "cardiology"
    },
    {
      "provider_id": "prov-003",
      "provider_name": "Dr. Michael Brown",
      "match_score": 0.82,
      "distance_km": 4.1,
      "specialty": "cardiology"
    }
  ],
  "disclaimer": "Suggestion only. Please confirm availability with the provider.",
  "total_count": 3,
  "error": null
}
```

---

## Additional Example: POST /admin/canary/seed

Seed a reviewer canary for vigilance testing.

### Request

```json
{
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "corruption_type": "dose_error",
  "corruption_value": "50mg"
}
```

### Response

```json
{
  "canary_id": "ee0e8400-e29b-41d4-a716-446655440000",
  "obligation_id": "770e8400-e29b-41d4-a716-446655440000",
  "corruption_type": "dose_error",
  "created_at": "2024-01-15T12:00:00Z"
}
```

---

## Notes

- All UUIDs in these examples are placeholder values. In production, use actual UUIDs from the database.
- All timestamps are in ISO 8601 format (UTC).
- Content hashes are SHA256 hashes of the content string.
- The backend response shapes match the Pydantic schemas defined in `careplus/schemas/`.
- For production use, hit the live backend at `http://localhost:8000` to capture real responses.
