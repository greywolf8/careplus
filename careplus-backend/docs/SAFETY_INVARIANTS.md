# CarePlus Safety Invariants

The frontend team MUST enforce these 10 invariants in the UI. These are not optional best practices—they are critical safety requirements backed by backend RLS policies and audit logging.

---

## Invariant 1: Patient UI Never Renders Unapproved Content

**Rule:** The patient-facing UI must never display extracted items, obligations, or any clinical content that has not been explicitly approved by an RMP.

**Backend Enforcement:**
- RLS policy on `approved_item` table restricts reads to approved rows only
- RLS policy on `obligation` table restricts reads to approved/active rows only
- Policy engine enforces consent checks before any data access

**Frontend Requirement:**
- Never render items where `state != 'approved'`
- Never render items where `verified != true` (for translations)
- Even if backend data leaks (e.g., caching error), frontend must filter client-side
- Do not trust any client-side state or cached data—always verify approval status before rendering

**Example:**
```typescript
// ❌ WRONG - renders all items
items.map(item => <ItemCard content={item.content} />)

// ✅ CORRECT - filters by approval status
items.filter(item => item.state === 'approved').map(item => <ItemCard content={item.content} />)
```

---

## Invariant 2: Patient UI Never Renders Unverified Translations

**Rule:** The patient-facing UI must never display translations that have not been verified by an RMP.

**Backend Enforcement:**
- RLS policy on `translation` table restricts reads to rows where `verified = true`
- Episode page compiler filters translations by verification status
- Lint pass detects and flags unverified translations

**Frontend Requirement:**
- Never render translations where `verified !== true`
- For bilingual patients, show original English text if translation is unverified
- Display a clear indicator when verified translation is available vs unavailable

**Example:**
```typescript
// ❌ WRONG - renders all translations
translations.map(t => <Translation content={t.translated_content} />)

// ✅ CORRECT - filters by verification status
translations.filter(t => t.verified === true).map(t => <Translation content={t.translated_content} />)
```

---

## Invariant 3: Patient UI Never Auto-Translates Warning Sign Original Text

**Rule:** Warning signs (e.g., "Call your doctor if you experience chest pain") must never be auto-translated. They require doctor-verified translation only.

**Backend Enforcement:**
- `/translate` endpoint rejects requests for items with `title = 'warning_sign'`
- Explicit check in translation pipeline: `if item.get("title", "").lower() == "warning_sign": raise HTTPException`

**Frontend Requirement:**
- Never call `/translate` for warning_sign items
- For warning signs, always show original English text until doctor provides verified translation
- Display a clear message: "Warning signs require doctor-verified translation"

**Example:**
```typescript
// ❌ WRONG - auto-translates warning signs
warningSigns.map(sign => <TranslateButton itemId={sign.id} />)

// ✅ CORRECT - shows original English only
warningSigns.map(sign => <WarningSign content={sign.content} note="Original text only" />)
```

---

## Invariant 4: Emergency Route Shows Care Team Notification

**Rule:** When a patient question is classified as emergency (route: `to_doctor`, escalate: `true`), the UI must explicitly state that the care team has been notified.

**Backend Enforcement:**
- `/question/classify` returns `escalate: true` for emergency questions
- Deterministic layer routes emergency questions in <100ms (no LLM call)
- Backend logs emergency classification for audit trail

**Frontend Requirement:**
- When classification returns `route: 'to_doctor'` and `escalate: true`, display:
  - "This is an emergency. Your care team has also been notified."
  - "Please call emergency services if you are in immediate danger."
- Do not delay this message—show it immediately after classification
- Use distinct visual styling (red banner, alert icon)

**Example:**
```typescript
if (classification.route === 'to_doctor' && classification.escalate) {
  return (
    <Alert severity="error">
      This is an emergency. Your care team has also been notified.
      Please call emergency services if you are in immediate danger.
    </Alert>
  )
}
```

---

## Invariant 5: Provider Matches Always Show Disclaimer

**Rule:** Provider matching results must never be presented as recommendations or guarantees. Always show the disclaimer.

**Backend Enforcement:**
- `/providers/match` always returns `disclaimer: "Suggestion only. Please confirm availability with the provider."`
- Backend never uses words like "best", "recommended", "guaranteed"

**Frontend Requirement:**
- Always display the disclaimer prominently in provider match results
- Do not suppress or minimize the disclaimer
- Use consistent wording: "Suggestion only. Please confirm availability with the provider."
- Display disclaimer above or below provider list, never hidden in fine print

**Example:**
```typescript
<ProviderMatchResults>
  <Disclaimer>Suggestion only. Please confirm availability with the provider.</Disclaimer>
  {providers.map(p => <ProviderCard {...p} />)}
</ProviderMatchResults>
```

---

## Invariant 6: AI-Generated Drafts Show Pending Approval Notice

**Rule:** Every AI-generated draft (extraction, translation, task draft) must display "Drafted by CarePlus AI, awaiting doctor approval" until explicitly approved.

**Backend Enforcement:**
- Extracted items have `state: 'drafted'` until approved
- Translations have `verified: false` until verified
- Task drafts have `valid: true` but are not auto-approved
- All LLM responses include `model_id` for transparency

**Frontend Requirement:**
- Display the approval notice prominently for all AI-generated content
- Show the model identifier (e.g., "Drafted by openai/gpt-4o-mini, awaiting doctor approval")
- Remove the notice only after backend confirms approval (state change or verification)
- Use visual indicators (draft badge, pending icon) to distinguish from approved content

**Example:**
```typescript
{item.state === 'drafted' && (
  <DraftBadge>
    Drafted by {item.model_id}, awaiting doctor approval
  </DraftBadge>
)}
```

---

## Invariant 7: Approved Items Show RMP Name + MCI Registration

**Rule:** Every approved clinical item must display the approving RMP's name and MCI registration number for accountability.

**Backend Enforcement:**
- `/obligation/approve` requires `mci_reg` field
- `/verify/translation` requires `mci_reg` field
- Audit log records approver RMP ID and MCI registration
- FHIR Provenance resources include approver information

**Frontend Requirement:**
- Display RMP name and MCI registration number for all approved items
- Format: "Approved by Dr. [Name] (MCI: [MCI_REG])"
- Display this information prominently, not hidden in details
- For translations, show: "Verified by Dr. [Name] (MCI: [MCI_REG])"

**Example:**
```typescript
{item.state === 'approved' && (
  <ApproverInfo>
    Approved by Dr. {item.approver_name} (MCI: {item.approver_mci_reg})
  </ApproverInfo>
)}
```

---

## Invariant 8: Eval Dashboard is Auditor-Only

**Rule:** The evaluation metrics dashboard is accessible only to users with the `auditor` role.

**Backend Enforcement:**
- `/eval/metrics` endpoint checks `user_role in ["auditor", "rmp", "coordinator"]`
- `/admin/eval/run` endpoint checks `user_role === "auditor"`
- `/admin/canary/seed` endpoint checks `user_role === "auditor"`
- Auth middleware validates JWT token and extracts role

**Frontend Requirement:**
- Do not render eval dashboard navigation item for non-auditor roles
- Do not make eval API calls for non-auditor users
- If a non-auditor somehow accesses the dashboard URL, redirect or show 403
- Never cache eval data for non-auditor users

**Example:**
```typescript
{user.role === 'auditor' && (
  <NavLink to="/eval-dashboard">Eval Dashboard</NavLink>
)}
```

---

## Invariant 9: Canary Seeding is Auditor-Only; Dashboard Hides Canary IDs

**Rule:** Canary seeding is auditor-only. The eval dashboard shows canary catch rate but never reveals which specific items are canaries.

**Backend Enforcement:**
- `/admin/canary/seed` endpoint checks `user_role === "auditor"`
- Canary table stores `obligation_id` and `corruption_type`
- `/eval/metrics` returns `reviewer_vigilance` metric (catch rate) but not canary IDs
- Backend never exposes canary IDs in any public endpoint

**Frontend Requirement:**
- Do not render canary seeding UI for non-auditor roles
- In eval dashboard, display canary catch rate as a percentage
- Never display which obligations are canaries to anyone (including auditors in the main UI)
- Canary management should be in a separate admin-only interface

**Example:**
```typescript
// ✅ CORRECT - shows catch rate only
<MetricCard>
  <Label>Reviewer Vigilance</Label>
  <Value>{metrics.reviewer_vigilance}%</Value>
</MetricCard>

// ❌ WRONG - reveals canary IDs
<CanaryList>
  {canaries.map(c => <CanaryItem id={c.obligation_id} />)}
</CanaryList>
```

---

## Invariant 10: Consent Revocation is Immediate; UI Reflects Without Logout

**Rule:** When a patient revokes consent, the UI must immediately reflect the revocation without requiring the user to log out or refresh.

**Backend Enforcement:**
- `/consent/revoke` triggers `recompile_after_erasure` RPC
- Erasure deletes source rows and recompiles episode page
- Lint pass verifies no orphan pointers remain
- Audit log records erasure with consent revocation hash as anchor

**Frontend Requirement:**
- After successful consent revocation, immediately clear all cached patient data
- Update UI state to reflect erasure (show "AI processing disabled" message)
- Do not require user to log out or refresh the page
- Call `/episode/{patient_id}` again to fetch post-erasure state
- Display the message: "AI processing disabled. Your care team will handle your follow-up manually."

**Example:**
```typescript
async function handleRevokeConsent(consentId: string) {
  await api.post('/consent/revoke', { consent_id: consentId })
  // Immediately clear cache
  clearPatientDataCache()
  // Update UI state
  setConsentRevoked(true)
  // Show message
  showNotification('AI processing disabled. Your care team will handle your follow-up manually.')
  // Refresh episode page
  await fetchEpisodePage(patientId)
}
```

---

## General Safety Principles

### 1. Defense in Depth
- Backend enforces safety via RLS, policy engine, and audit logging
- Frontend provides defense in depth by enforcing these invariants client-side
- Never rely solely on backend enforcement—frontend must also validate

### 2. Fail Securely
- If safety state is unclear, default to the safest option (hide content, show error)
- Never render unverified content due to missing data
- Never auto-approve or auto-verify based on incomplete information

### 3. Audit Trail Visibility
- Display approver information for all approved items
- Show model identifiers for all AI-generated content
- Make audit trail visible to users for transparency

### 4. User Control
- Patients can revoke consent at any time
- RMPs must explicitly approve all clinical content
- Auditors have exclusive control over eval and canary operations

### 5. Clear Communication
- Use clear, non-technical language for safety messages
- Display warnings and disclaimers prominently
- Never hide safety information in fine print or tooltips

---

## Testing Checklist

For each invariant, the frontend team should:

1. **Unit Test:** Verify the UI logic enforces the invariant
2. **Integration Test:** Verify the UI correctly handles backend responses
3. **E2E Test:** Verify the full user flow respects the invariant
4. **Manual Review:** Visually inspect the UI for compliance

### Example Test for Invariant 1:
```typescript
describe('Invariant 1: Patient UI Never Renders Unapproved Content', () => {
  it('should not render items with state != approved', () => {
    const items = [
      { id: 1, state: 'approved', content: 'Take medication' },
      { id: 2, state: 'drafted', content: 'Call doctor' },
    ]
    const { container } = render(<PatientView items={items} />)
    expect(container).toHaveTextContent('Take medication')
    expect(container).not.toHaveTextContent('Call doctor')
  })
})
```

---

## Violation Consequences

Violating these invariants may result in:

- **Patient harm:** Displaying unapproved clinical content could lead to incorrect treatment
- **Regulatory non-compliance:** Violating consent or data protection regulations
- **Loss of trust:** Users losing trust in the system due to safety failures
- **Legal liability:** Legal consequences for medical errors or data breaches

**If you identify a potential violation, escalate immediately to the backend team.**

---

## Contact

For questions about these invariants or to report potential violations, contact:
- Backend team: [backend-team@example.com]
- Security team: [security@example.com]
- Product owner: [product@example.com]
