# CarePlus - Agentic Hospital Discharge & Follow-Up Coordinator

A comprehensive, AI-powered healthcare coordination system for post-discharge patient care, featuring multi-platform interfaces for doctors, patients, and caregivers.

[![License](https://img.shields.io/badge/license-Proprietary-blue)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/react-19.2.8-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-6.0.2-3178C6.svg)](https://www.typescriptlang.org/)

---

## 🏥 Overview

CarePlus is an integrated healthcare platform designed to streamline hospital discharge processes and improve post-discharge patient outcomes through AI-assisted care coordination. The system comprises three main components:

- **Web Doctor Portal** (`CarePlus-frontend/`) - Desktop interface for clinical staff
- **Backend API** (`careplus/`) - FastAPI server with AI services and policy engine
- **Mobile Patient App** (`careplus-mobile/`) - Progressive Web App for patients and caregivers

### Clinical Focus

Built around real-world clinical discharge protocols, specifically modeled for post-PTCA stenting cardiology patients:
- Primary Patient: Lakshmi Devi (68 y/o, post-coronary angioplasty)
- Multilingual Support: English, Hindi (हिंदी), and Tamil (தமிழ்)
- Dual personas: Patient view and Caregiver view with permission-restricted actions

### ⚠️ Critical Safety Principle

**CarePlus is NOT an autonomous medical agent.**

The AI extracts, structures, translates, classifies, drafts, and tracks. The AI does **NOT**:
- Diagnose medical conditions
- Prescribe medications
- Change medication regimens
- Recommend treatments
- Guarantee provider availability
- Override doctor decisions
- Approve clinical items
- Answer symptom questions
- Answer medication questions

When uncertain, the system escalates to clinical staff. The doctor remains the final authority.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CarePlus Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Web Doctor     │  │  Mobile Patient  │  │  Backend     │ │
│  │  Portal          │  │  App (PWA)       │  │  API Server  │ │
│  │  (React/TS)      │  │  (React/TS)      │  │  (FastAPI)   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                      │                    │          │
│           └──────────────────────┴────────────────────┘          │
│                                  │                               │
│                                  ▼                               │
│                    ┌─────────────────────────┐                   │
│                    │     Supabase Database   │                   │
│                    │    (PostgreSQL + Auth)  │                   │
│                    └─────────────────────────┘                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 AI Services Layer                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │Extract   │ │Translate │ │Routing   │ │Task Drafting│ │  │
│  │  │(Ensemble)│ │(Verify)  │ │(LLM+Det) │ │              │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Web Doctor Portal (`CarePlus-frontend/`)
- **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS, Supabase
- **Purpose**: Clinical staff interface for discharge processing, patient management, and review queues
- **Key Features**:
  - Patient dashboard with attention lists and schedules
  - Discharge summary processing with AI extraction
  - Care plan item approval and management
  - Translation verification workflow
  - AI agent for doctor assistance
  - Audit log verification

#### 2. Backend API (`careplus/`)
- **Tech Stack**: Python 3.11+, FastAPI, Supabase, OpenRouter, SQLAlchemy
- **Purpose**: Core API server with AI services, policy engine, and compliance checks
- **Key Features**:
  - AI-powered extraction from discharge summaries
  - Multi-language translation with verification
  - Deterministic + LLM question routing
  - Task drafting assistance
  - Provider matching (geospatial)
  - Policy enforcement (consent, deidentification, audit chain)
  - Evaluation metrics dashboard

#### 3. Mobile Patient App (`careplus-mobile/`)
- **Tech Stack**: React 19, TypeScript, Express, Tailwind CSS, PWA
- **Purpose**: Patient and caregiver interface for daily care adherence
- **Key Features**:
  - Daily care plan with interactive timeline
  - Medication adherence tracking
  - AI clinical assistant with safety routing
  - Care team coordination cards
  - Emergency quick-dial (112)
  - Lab test tracking
  - Nearby care provider search
  - Multilingual support (EN/HI/TA)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Python**: 3.11 or higher
- **Supabase account** (PostgreSQL database + Auth)
- **OpenRouter API key** (for AI services)
- **Gemini API key** (for mobile app AI)

### 1. Clone Repository

```bash
git clone <repository-url>
cd careplus-main
```

### 2. Backend Setup (`careplus/`)

```bash
cd careplus

# Install dependencies
pip install -e ".[dev,eval]"

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase and OpenRouter credentials

# Run database migrations
psql -h your-db-host -U postgres -d your-db -f db/migrations/0001_init.sql
psql -h your-db-host -U postgres -d your-db -f db/migrations/0002_add_translation_fields.sql
psql -h your-db-host - U postgres -d your-db -f db/migrations/0005_unify_flags_system.sql

# Start the server
uvicorn careplus.api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend API will be available at `http://localhost:8000` with OpenAPI docs at `/docs`.

### 3. Web Doctor Portal Setup (`CarePlus-frontend/`)

```bash
cd CarePlus-frontend

# Install dependencies
npm install --legacy-peer-deps

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase and backend API URL

# Start development server
npm run dev
```

Web portal will be available at `http://localhost:5173`.

### 4. Mobile Patient App Setup (`careplus-mobile/`)

```bash
cd careplus-mobile

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Gemini API key and port

# Start development server
npm run dev
```

Mobile app will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
careplus-main/
├── CarePlus-frontend/          # Web Doctor Portal
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components (Dashboard, Patients, etc.)
│   │   ├── services/           # Data access layer (API + Supabase)
│   │   ├── lib/                # Utilities (API client, auth, schema check)
│   │   └── types/              # TypeScript interfaces
│   ├── package.json
│   └── README.md
│
├── careplus/                   # Backend API
│   ├── api/                    # FastAPI route handlers
│   │   ├── main.py             # Main API with all endpoints
│   │   ├── patient_mobile.py   # Patient mobile endpoints
│   │   └── web_flow.py         # Web doctor portal endpoints
│   ├── core/                   # Core utilities
│   │   ├── config.py           # Configuration settings
│   │   ├── auth.py             # Authentication
│   │   └── logging.py          # Structured logging
│   ├── db/                     # Database client and migrations
│   │   ├── client.py           # Supabase client
│   │   └── migrations/         # SQL migration files
│   ├── llm/                    # LLM abstraction layer
│   │   ├── base.py             # Base LLM client
│   │   └── openrouter.py       # OpenRouter implementation
│   ├── schemas/                # Pydantic models
│   │   ├── extraction.py
│   │   ├── translation.py
│   │   ├── question.py
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── extraction/         # AI extraction pipeline
│   │   ├── translation/        # Translation with verification
│   │   ├── routing/            # Question routing (deterministic + LLM)
│   │   ├── task_drafting/      # Task drafting service
│   │   ├── providers/          # Provider matching
│   │   ├── policy/             # Policy engine
│   │   ├── eval/               # Evaluation metrics
│   │   └── ...
│   ├── tests/                  # Test suite
│   ├── pyproject.toml
│   └── README.md
│
├── careplus-mobile/            # Mobile Patient App
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── views/              # Page views (Dashboard, Plan, Medicines, etc.)
│   │   ├── services/           # Services (AI, Supabase mock)
│   │   ├── context/            # React contexts (Auth, theme)
│   │   ├── i18n/               # Translations (EN/HI/TA)
│   │   └── types/              # TypeScript interfaces
│   ├── public/                 # PWA assets (manifest, service worker, icons)
│   ├── server.ts               # Express server
│   ├── package.json
│   └── README.md
│
├── careplus-backend/           # (Duplicate/Symlink of careplus/)
│
├── DATA_FLOW_ANALYSIS.md       # Detailed data flow documentation
├── FLAGS_UNIFICATION_SUMMARY.md # Flags system unification notes
└── README.md                   # This file
```

---

## 🔑 Key Features

### 1. AI-Powered Discharge Summary Extraction

- **Ensemble extraction** using two different LLM models (Gemini + Claude)
- Extracts medications, follow-up appointments, care instructions, warning signs
- Confidence scoring and span validation
- Hallucination detection and omission tracking
- Doctor review and approval workflow

### 2. Multi-Language Translation with Verification

- Translates care plan items to multiple languages
- **Roundtrip verification**: Translate → back-translate → compare entities
- **Readability checking**: Grade level ≤ 9, avg sentence < 20 words
- Doctor verification required before patient visibility
- Entity preservation validation

### 3. Clinical Safety Question Routing

```
Patient Question
       │
       ▼
┌──────────────────────────────┐
│   Deterministic Layer         │
│   (Keyword matching)          │
└────────────┬─────────────────┘
             │
       ┌─────┼─────┬─────┬─────┐
       ▼     ▼     ▼     ▼     ▼
  🚨 Emergency 💊 Med 🩺 Symptom 📋 Plan
       │         │      │        │
       ▼         ▼      ▼        ▼
  112 Quick  Care   Coordination  AI with
  Dial       Team   Card          Plan Citations
             Escalation
```

- **Emergency**: Immediate 112 routing for chest pain, bleeding, fainting
- **Medication**: Blocks AI advice, escalates to care team
- **Symptom**: Creates coordination card for clinical review
- **Plan**: AI answers with approved item citations

### 4. Care Plan Management

- Doctor can approve, reject, or edit extracted items
- Items sync to patient mobile app
- Caregiver permissions (mark done permission)
- Medication adherence tracking
- Appointment scheduling and reminders

### 5. Policy & Compliance Engine

- **Consent management**: Track and enforce patient consent
- **Deidentification**: Automatic PHI detection and redaction
- **Audit chain**: Immutable audit trail for all clinical actions
- **Role-based access**: RMP, coordinator, doctor, patient roles
- **Second Brain**: Compiled episode page with FHIR bundle generation

### 6. Evaluation Metrics Dashboard

9 key metrics tracked:
1. **Omission Rate**: < 5% target
2. **Hallucination Rate**: < 2% target
3. **Readability Pass Rate**: Grade ≤ 9, sentences < 20 words
4. **Injection Resistance**: 100% target
5. **Reviewer Time Saved**: > 40% target
6. **Reviewer Vigilance**: > 90% target
7. **Translation Entity Preservation**: > 95% target
8. **Calibrated Abstention Rate**: > 90% target
9. **Model Ensemble Agreement**: > 80% target

---

## 🔌 API Documentation

### Backend API Endpoints

#### Extraction & Obligation
- `POST /extract` - Extract obligations from discharge summary
- `POST /obligation/approve` - Approve an extracted obligation
- `POST /obligation/close` - Close an obligation as completed
- `GET /obligation/graph/{patient_id}` - Get FHIR bundle of obligations

#### Translation
- `POST /translate` - Translate an approved item or obligation
- `POST /verify/translation` - Verify a translation

#### Question Routing
- `POST /question/classify` - Classify a patient question
- `POST /question/answer/plan` - Answer a PLAN question
- `POST /question/answer/doctor` - Translate doctor's text for patient

#### Task Drafting
- `POST /task/draft` - Draft a task from description

#### Provider Matching
- `POST /providers/match` - Find matching providers

#### Episode & Second Brain
- `GET /episode/{patient_id}` - Get compiled episode page

#### Compliance & Consent
- `POST /consent/revoke` - Revoke consent
- `POST /verify/audit` - Verify audit chain integrity

#### Patient Mobile
- `GET /patient/me/context` - Get patient context
- `GET /patient/{id}/items` - List follow-up items
- `POST /patient/question` - Submit patient question
- `POST /patient/{id}/sync-plan` - Sync patient plan

#### Eval & Admin
- `GET /eval/metrics` - Get evaluation metrics
- `GET /eval/metrics/history` - Get metrics history
- `POST /admin/eval/run` - Trigger evaluation run
- `GET /admin/eval/run/{job_id}` - Get eval run status
- `POST /admin/canary/seed` - Seed reviewer canary

Full API documentation available at `http://localhost:8000/docs` when backend is running.

---

## 🧪 Testing

### Backend Tests

```bash
cd careplus
pytest careplus/tests/ -v
```

**Test Coverage** (47 tests total):
- `test_extraction.py` (11 tests) - Span validation, missing data, hallucinations
- `test_compliance.py` (7 tests) - Authorization, consent, audit chain
- `test_routing.py` (7 tests) - Emergency, medication, symptom, plan routing
- `test_translation.py` (7 tests) - Roundtrip verification, readability
- `test_eval.py` (15 tests) - All 9 evaluation metrics

### Frontend Tests

```bash
cd CarePlus-frontend
npm run lint  # oxlint for static analysis
```

### Mobile Tests

```bash
cd careplus-mobile
npm run lint  # TypeScript type checking
```

---

## 📊 Data Flow

### Patient Data Flow

```
┌─────────────────┐
│   Mobile App    │
│  (Patient/Care  │
│     giver)      │
└────────┬────────┘
         │ READ/WRITE
         ↓
┌─────────────────────────────────────┐
│  Supabase Database                 │
│  - patient, patient_app_user       │
│  - followup_item                   │
│  - patient_medication              │
│  - adherence_log                   │
│  - patient_message                 │
│  - review_flags                   │
└────────┬────────────────────────────┘
         │ READ
         ↓
┌─────────────────────────────────────┐
│  Backend API                       │
│  - /patient/* endpoints            │
│  - /web/* endpoints                │
└────────┬────────────────────────────┘
         │ READ
         ↓
┌─────────────────┐
│  Web Frontend   │
│  (Doctor Portal)│
└─────────────────┘
```

### Discharge Summary Flow

```
┌─────────────────┐
│  Web Frontend   │
│  (Doctor Portal)│
└────────┬────────┘
         │ UPLOAD raw text
         ↓
┌─────────────────────────────────────┐
│  AI Extraction (/extract)           │
│  - Extracts obligations/items       │
│  - Returns structured data          │
└────────┬────────────────────────────┘
         │ REVIEW & EDIT
         ↓
┌─────────────────┐
│  Web Frontend   │
│  (Doctor Portal)│
└────────┬────────┘
         │ PUBLISH approved items
         ↓
┌─────────────────────────────────────┐
│  Backend API (/web/publish)         │
│  - Creates approved_item            │
│  - Syncs to followup_item           │
│  - Syncs to patient_medication      │
│  - Syncs to warning_sign            │
└────────┬────────────────────────────┘
         │ READ
         ↓
┌─────────────────┐
│   Mobile App    │
│  (Patient/Care  │
│     giver)      │
└─────────────────┘
```

For detailed data flow analysis, see <ref_file file="/Users/arkapravapanigrahi/Downloads/careplus-main/DATA_FLOW_ANALYSIS.md" />.

---

## 🔒 Security & Privacy

### Authentication & Authorization

- **Supabase Auth**: Email/password authentication with role-based access
- **Role-based access control**:
  - `rmp` (Registered Medical Practitioner): Full clinical access
  - `coordinator`: Care coordination access
  - `doctor`: Limited clinical access
  - `patient`: Own data only
  - `caregiver`: Patient data with permissions

### Data Protection

- **Row-Level Security (RLS)**: Database-level access control
- **Deidentification**: Automatic PHI detection and redaction
- **Audit Chain**: Immutable audit trail for all clinical actions
- **Consent Management**: Track and enforce patient consent for data processing
- **Policy Engine**: Enforces consent, deidentification, and approver validation

### API Security

- **Bearer token authentication**: All API endpoints require valid JWT tokens
- **CORS**: Configured for frontend origins only
- **Service role key protection**: Never exposed to frontend
- **Request ID tracking**: All requests logged with unique IDs

---

## 🚢 Deployment

### Backend Deployment

#### Using Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY careplus/ .
RUN pip install -e ".[dev,eval]"
EXPOSE 8000
CMD ["uvicorn", "careplus.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Using Render/Railway

1. Set build command: `pip install -e ".[dev,eval]"`
2. Set start command: `uvicorn careplus.api.main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables from `.env.example`

### Web Frontend Deployment

#### Vercel/Netlify

```bash
cd CarePlus-frontend
npm run build
# Deploy dist/ folder
```

#### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY CarePlus-frontend/ .
RUN npm install --legacy-peer-deps
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

### Mobile App Deployment

#### Render/Railway (Recommended)

1. Set build command: `npm install && npm run build`
2. Set start command: `npm run start`
3. Add environment variable: `GEMINI_API_KEY`

#### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY careplus-mobile/ .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 📚 Documentation

- [Backend README](careplus/README.md) - Detailed backend documentation
- [Web Portal README](CarePlus-frontend/README.md) - Frontend setup and integration
- [Mobile App README](careplus-mobile/README.md) - Mobile app features and PWA setup
- [Data Flow Analysis](DATA_FLOW_ANALYSIS.md) - Comprehensive data flow documentation
- [Flags Unification Summary](FLAGS_UNIFICATION_SUMMARY.md) - Flags system migration notes

---

## 🤝 Contributing

This is a proprietary healthcare system. Please contact the project maintainers for contribution guidelines.

---

## ⚠️ Disclaimer

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

---

## 📄 License

Proprietary - CarePlus Project 2024

---

## 🆘 Support

For support, please contact the CarePlus development team or refer to the documentation in each component's README.
