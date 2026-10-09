# Flags System Unification - Summary

## Overview

Unified the flags system so that the mobile app uses the same `review_flags` table as the web frontend, eliminating the previous dual-system where mobile used `coordination_card` and web used `review_flags`.

## Changes Made

### 1. Database Migration (0005_unify_flags_system.sql)

**File**: `careplus/db/migrations/0005_unify_flags_system.sql`

**Changes**:
- Enhanced `review_flags` table with mobile-specific columns:
  - `card_type` - matches coordination_card types
  - `care_team_notes` - notes from care team
  - `raised_by_name` - name of person who raised the flag
  - `question_id` - optional link to patient_question
- Added check constraint for `card_type` values
- Created view `v_coordination_card_review_flags` for backward compatibility
- Updated RLS policies to allow mobile users (patient/caregiver) to create flags
- Added indexes for mobile app queries
- Migrated existing `coordination_card` data to `review_flags`

### 2. Backend API Changes

**File**: `careplus/api/patient_mobile.py`

**Changes**:
- Added import for `ReviewFlagCreate`, `ReviewFlagResponse`, `ReviewFlagUpdate`
- Added `datetime` import
- Added three new endpoints:
  - `GET /patient/{patient_id}/review-flags` - List review flags for a patient
  - `POST /patient/{patient_id}/review-flags` - Create a review flag
  - `PATCH /patient/review-flags/{flag_id}` - Update a review flag status

**File**: `careplus/schemas/patient_mobile.py`

**Changes**:
- Added three new Pydantic models:
  - `ReviewFlagCreate` - Request body for creating flags
  - `ReviewFlagUpdate` - Request body for updating flags
  - `ReviewFlagResponse` - Response model for flags

### 3. Mobile App Changes

**File**: `careplus-mobile/src/services/supabase/reviewFlagService.ts` (NEW)

**Purpose**: New service to interact with `review_flags` table instead of `coordination_card`

**Functions**:
- `fetchReviewFlags()` - Fetch review flags for a patient
- `createReviewFlag()` - Create a new review flag
- `updateReviewFlagStatus()` - Update flag status
- `mapReviewFlagToCoordinationCard()` - Maps review_flags to CoordinationCard format for backward compatibility

**File**: `careplus-mobile/src/types/database.ts`

**Changes**:
- Added `DbReviewFlagSeverity` type
- Added `DbReviewFlagStatus` type
- Added `DbReviewFlag` interface

**File**: `careplus-mobile/src/services/dataService.ts`

**Changes**:
- Added import for `reviewFlagService`
- Updated `getCoordinationCards()` to use `reviewFlagService.fetchReviewFlags()`
- Updated `addCoordinationCard()` to use `reviewFlagService.createReviewFlag()`
- Updated `updateCoordinationCardStatus()` to use `reviewFlagService.updateReviewFlagStatus()`

### 4. Documentation Updates

**File**: `DATA_FLOW_ANALYSIS.md`

**Changes**:
- Updated identified gaps section to mark flags unification as resolved
- Updated data model alignment table to show `review_flags` as aligned
- Updated recommendations to mark flags unification as completed
- Updated conclusion to reflect completed work
- Added "Changes Made in This Analysis" section

## Backward Compatibility

The changes maintain backward compatibility through:

1. **View Mapping**: Created `v_coordination_card_review_flags` view that maps `review_flags` to `coordination_card` structure
2. **Service Layer Mapping**: Mobile service maps `review_flags` to `CoordinationCard` format internally
3. **Migration**: Existing `coordination_card` data is migrated to `review_flags` automatically
4. **Legacy Endpoint**: Kept coordination_card endpoints in backend for transition period

## Testing Recommendations

1. Run migration `0005_unify_flags_system.sql` in development environment
2. Verify that existing coordination_card data is migrated to review_flags
3. Test mobile app flag creation and status updates
4. Test web frontend flag visibility and resolution
5. Verify RLS policies allow patients to create but not resolve flags
6. Test that care team can resolve flags

## Rollback Plan

If issues arise:

1. Mobile app can temporarily revert to using `coordination_card` table by:
   - Undoing changes in `dataService.ts`
   - Using `coordinationService` instead of `reviewFlagService`

2. Backend can restore coordination_card endpoints if needed

3. Database migration can be rolled back by:
   - Dropping added columns from `review_flags`
   - Dropping the view `v_coordination_card_review_flags`
   - Restoring original RLS policies

## Future Work

1. Remove `coordination_card` table and endpoints after transition period
2. Remove backward compatibility view
3. Clean up mobile app coordination_service.ts (if no longer needed)
4. Update mobile app types to use `ReviewFlag` directly instead of mapping from `CoordinationCard`
