# CarePlus Doctor Portal

Desktop application for the CarePlus Discharge & Follow-up Coordinator system.
This frontend integrates with the CarePlus backend FastAPI service, with the backend left unchanged
and the frontend adapted to match the backend API endpoints.

---

## 📋 Overview

The CarePlus Doctor Portal is a React TypeScript application that provides a doctor-facing interface
for managing patient discharges, follow-up care plans, translations, and audit trails.

**Key Integration Pattern**: Frontend services attempt backend API calls first, and fall back to direct
Supabase queries on error. This ensures backward compatibility while adding backend integration.
The backend (`careplus/`) was **not modified**.

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^19.2.8 | UI library |
| TypeScript | ~6.0.2 | Type safety |
| Vite | ^8.3.0 | Dev server & build |
| Tailwind CSS | ^3.4.19 | Styling |
| React Router DOM | ^7.1.1 | Routing |
| @supabase/supabase-js | ^2.48.1 | Backend (auth + DB) |
| @tanstack/react-query | ^5.62.7 | Data fetching & caching |
| lucide-react | ^0.468.0 | Icons |

---

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://prugerqunljhqtattwyo.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_AI_SERVER_URL` | Backend AI server URL | `http://localhost:3001` |

The `VITE_AI_SERVER_URL` is used by `src/lib/api.ts` to communicate with the FastAPI backend.
If empty, services fall back to direct Supabase queries.

### 3. Start Development Server

```bash
npm run dev
```

App available at `http://localhost:5173/`

### 4. Build for Production

```bash
npm run build
```

Output goes to `dist/`

### 5. Lint

```bash
npm run lint
```

Uses oxlint. Pre-existing warnings are expected (impure functions in render, etc.).

---

## 📁 Project Structure

```
src/
  components/           # Reusable UI components
    layout/             # DesktopShell, sidebar, header
  pages/                # Full-page components
    AIAgent.tsx         # AI chat agent with capabilities
    AuditLog.tsx        # Audit chain verification
    AuthPage.tsx        # Login / signup
    DoctorDashboard.tsx # Main dashboard with tiles
    DoctorPatients.tsx  # Patient list
    NewDischarge.tsx    # Multi-step discharge processing
    PatientDetail.tsx   # Patient detail view with tabs
    ReviewQueue.tsx     # Unresolved flags review
  contexts/             # React contexts
    AuthContext.tsx     # Auth state + profile
  lib/                  # Utilities
    api.ts              # **NEW** Backend API service layer
    auth.ts             # Auth helper (tokens, profiles)
    schemaCheck.ts      # Supabase schema inspector
    supabase.ts         # Supabase client instance
  services/             # Data access layer
    doctorService.ts    # Doctor/patient ops (try backend first)
    flagService.ts      # Review flag ops
    itemService.ts      # Follow-up item ops
    medicationService.ts# Medication ops
    questionService.ts  # Patient question ops
  types/                # TypeScript interfaces
    index.ts            # All type definitions
  App.tsx               # Root component with routing
  main.tsx              # App entry point
```

---

## 🛣 Routes

| Path | Component | Requires Auth |
|------|-----------|-------------|
| `/doctor` | DoctorDashboard | Yes (doctor role) |
| `/doctor/patients` | DoctorPatients | Yes |
| `/doctor/patients/:id` | PatientDetail | Yes |
| `/doctor/agent` | AIAgent | Yes |
| `/doctor/review` | ReviewQueue | Yes |
| `/doctor/intake` | NewDischarge | Yes |
| `/doctor/audit` | AuditLog | Yes |
| `/` | Redirect to `/doctor` | Yes |

---

## 🔐 Authentication & Authorization

### Auth Flow

1. Users sign in/sign up via `AuthPage` using Supabase Email/Password
2. `AuthProvider` subscribes to `supabase.auth.onAuthStateChange`
3. On `SIGNED_IN`, `loadProfile()` fetches user row from `profiles` table
4. Fallback profile created from auth user data if RLS blocks profiles table

### Role-Based Access

- `profile.role === 'doctor'` -> Full portal access
- `profile.role === 'patient'` -> Limited access (own data only)
- Unauthenticated -> Auth page
- Non-doctor -> "Access Denied" page

### Authorization Checks (in service layer)

Never call Supabase directly in components. Use the service modules:

| Service | Purpose |
|---------|---------|
| `doctorService.ts` | Get patients, patient attention list, patient by ID |
| `itemService.ts` | Get follow-up items, approve/reject/mark done |
| `questionService.ts` | Get/answer patient questions |
| `flagService.ts` | Get unresolved flags, resolve flags |
| `medicationService.ts` | Get patient medications |

All services perform authorization checks before database operations.

---

## 🔄 Backend Integration (New in this Integration)

### API Service: `src/lib/api.ts`

New file that communicates with the FastAPI backend at `VITE_AI_SERVER_URL`.
Uses Supabase access token for Bearer authentication.

**Functions** (all try backend first, fallback to Supabase on error):

| Function | Backend Endpoint | Fallback |
|----------|-----------------|----------|
| `getPatientItems(patientId)` | `GET /obligation/graph/{patientId}` | `SELECT * FROM v_items_effective` |
| `approveItem(itemId)` | `POST /obligation/approve` | `RPC: approve_item` |
| `getPatientById(patientId)` | `GET /episode/{patientId}` | `SELECT * FROM patients` |
| `getPatientMedications(patientId)` | `GET /episode/{patientId}` | `SELECT * FROM medications` |
| `translateItem(itemId, type, lang)` | `POST /translate` | N/A (Supabase only) |
| `verifyTranslation(translationId, rmpId, decision)` | `POST /verify/translation` | N/A (Supabase only) |
| `classifyQuestion(question, patientId)` | `POST /question/classify` | N/A (Supabase only) |
| `answerPlanQuestion(question, patientId)` | `POST /question/answer/plan` | N/A (Supabase only) |
| `answerDoctorQuestion(question, patientId)` | `POST /question/answer/doctor` | N/A (Supabase only) |
| `draftTask(description, patientId, dischargeDate)` | `POST /task/draft` | N/A (Supabase only) |
| `matchProviders(itemType, lat, lng, radius)` | `POST /providers/match` | N/A (Supabase only) |

### Integration Pattern

```
Frontend Service
│
├─ Try: apiFetch('/endpoint', options)
│   └─ Success → Return data
│
└─ Error → Fallback: supabase.from('table').select(...)
        └─ Return data
```

This pattern ensures:
- ✅ Backend integration works when AI server is running
- ✅ Backward compatibility when backend is down
- ✅ No breaking changes to existing UI
- ✅ Gradual rollout possible

---

## 📄 Data Access Rules

### Never write Supabase queries directly in UI components!

Always use the centralized service modules:

```tsx
// ❌ WRONG - don't do this in components
const { data } = await supabase
  .from('followup_items')
  .select('*')
  .eq('patient_id', id);

// ✅ CORRECT - use the service
import { getPatientItems } from '../services/itemService';
const items = await getPatientItems(patientId);
```

### Service Layer Responsibilities

- Authorization checks (doctor-patient assignment, role validation)
- Try-backend-first pattern
- Error handling and fallbacks
- Type-safe return values

---

## 🎨 Design System

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#eef4f1` | Page background |
| Primary (primary accent) | `#2b9360` | Buttons, active states |
| Info (informational accent) | `#3b7bd4` | Links, hints |
| Warning (attention accent) | `#d85d38` | Alerts, warnings, urgent tags |
| Surface Container | Various | Card backgrounds |
| On Surface | Various | Text on backgrounds |

### Typography & Spacing

- Rounded corners: `rounded-xl`, `rounded-2xl`
- Shadows: `shadow-sm`, `shadow`
- Whitespace: generous spacing between sections
- Grid: `grid cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

### Component Patterns

- **Tabs**: Horizontal pill-shaped tabs with badge counts
- **Cards**: Rounded, shadowed, bordered containers
- **Tables**: `w-full` with `divide-y divide-slate-100`
- **Badges**: Rounded pill shapes with conditional colors
- **Links**: Underlined on hover, text-primary color

---

## 🔒 Security

| Rule | Implementation |
|------|---------------|
| Anon key only | `VITE_SUPABASE_ANON_KEY` only - never service-role key |
| AI server auth | All `apiFetch()` calls include `Bearer ` + Supabase access token |
| RLS | Currently disabled in migration but architecture supports enabling later |
| RPCs | All sensitive mutations go through Supabase RPCs (approve_item, reject_item, etc.) |
| No secrets in frontend | No API keys, JWT secrets, or service roles in client code |

---

## 📦 npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server at `localhost:5173` |
| `npm run build` | Build production bundle (`tsc -b && vite build`) |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview production build locally |

---

## 🐛 Known Issues / Pre-existing Warnings

Running `oxlint` may show these warnings (not introduced by this integration):

- `react(purity)`: Impure functions called during render (`Date`, `Math.random`, `Date.now`)
- `react(immutability)`: Variable accessed during initialization
- `react(only-export-components)`: Fast refresh constraint

These are existing in the codebase and not related to the backend integration.

---

## 🔧 Integration Details (Developer Notes)

### What Changed

1. **New file**: `src/lib/api.ts` - Backend API service layer
2. **Modified 4 services**: Each tries `apiFetch()` first, falls back to Supabase
3. **No backend changes**: `careplus/` untouched entirely
4. **SQL migration fix**: `0001_init.sql` - `ON ALL TABLES` → individual policies (PostgreSQL version compatibility)

### How It Works

```
User clicks "Approve Item"
│
├──> itemService.approveItem(itemId)
│   │
│   ├────> apiFetch('/obligation/approve', {...})
│   │       ├────> FastAPI: return success
│   │       └────> Error → fallback: supabase.rpc('approve_item', {...})
│   │
│   └──> Return data to component
│
└──> UI updates
```

### When to Use Which Path

- **Backend running** (`uvicorn` running on port 8001): `apiFetch()` succeeds, uses backend logic
- **Backend down**: `apiFetch()` throws, service falls back to direct Supabase queries
- **Development**: Both paths work; production should have backend running for full features

### Adding New Backend Endpoints

1. Add function to `src/lib/api.ts` with `@app.post` mapping
2. Add function to the appropriate service file with try/fallback pattern
3. Use the service in components (never direct Supabase)

### Rolling Back

If backend integration causes issues, simply remove the `apiFetch()` calls from services
and the services will use Supabase exclusively (full backward compatibility).