# CarePlus Doctor Portal

Desktop application for the CarePlus Discharge & Follow-up Coordinator system.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase JS
- TanStack Query
- Lucide icons

## Setup

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AI_SERVER_URL=http://localhost:3001
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
  components/
    layout/        # Sidebar, TopBar, DesktopShell
  pages/          # Doctor pages (Dashboard, Patients, etc.)
  contexts/       # AuthContext
  services/       # Data access layer (doctorService, itemService, etc.)
  lib/            # Supabase client, auth helpers
  types/          # TypeScript types
```

## Routes

- `/doctor` - Dashboard
- `/doctor/patients` - Patients list
- `/doctor/patients/:id` - Patient detail with tabs
- `/doctor/review` - Review queue
- `/doctor/intake` - New discharge intake
- `/doctor/audit` - Audit log

## Design System

The application uses a calm, premium healthcare aesthetic:
- Dark but not black background (#eef4f1)
- Blue-green/teal environment
- Muted green primary accent (#2b9360)
- Muted blue informational accent (#3b7bd4)
- Muted yellow/amber attention accent (#d85d38)
- Subtle borders and shadows
- Rounded corners
- Generous whitespace

## Authentication

The application uses Supabase Email/Password authentication. All users must be authenticated. The doctor portal is restricted to users with `role = 'doctor'` in the profiles table.

## Authorization

Application-level authorization is implemented in the data access layer:
- `assertDoctorAccess(patientId)` - Verifies doctor is assigned to patient
- `assertPatientOwner(patientId)` - Verifies patient owns their record
- All service functions perform authorization checks before database queries

## Data Access

Never write Supabase queries directly in UI components. Use the centralized service modules:
- `doctorService.ts` - Doctor-specific operations
- `itemService.ts` - Follow-up item operations
- `questionService.ts` - Patient question operations
- `flagService.ts` - Review flag operations
- `medicationService.ts` - Medication operations

## Security

- Never expose service-role keys
- Use only the public Supabase anon key in the frontend
- All sensitive mutations go through Supabase RPCs
- AI server communication requires authenticated Supabase JWT
- RLS is currently disabled but the architecture supports enabling it later
