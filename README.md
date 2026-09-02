# Mausam 2.0 — Personalized Weather Intelligence Engine
**SIH 2026 · PS 26076 · MoES/IMD · Team BugNotFound**

Weather that understands *who you are, where you are, and what you are planning* — decisions, not data.

A personalized homepage for the 'Mausam' mobile application: the same official IMD weather, re-ranked per user context (persona, health, activity, location, time, behavior), with explainable impact scores and offline-first support for ₹7,000 budget phones.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Mobile App (React Native + TypeScript, Hermes)                │
│  Onboarding · Personalized Homepage Cards · My Day · Ask      │
│  WatermelonDB offline cache · MMKV + Keychain · FCM/Notifee   │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / HTTP2 (gzip/brotli)
┌───────────────────────────▼──────────────────────────────────┐
│ API Gateway (NGINX) — auth, rate limiting, routing            │
└───────────────────────────┬──────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────┐
│ Modular Monolith (FastAPI, Python 3.12)                       │
│  Modules:                                                      │
│   · Weather Aggregator        · Personalization & Ranking      │
│   · User Context Service      · Impact Models Service          │
│   · Alert Orchestrator        · AI/NLG (template-first)        │
│   · Geospatial (PostGIS)      · Admin Dashboard                │
├───────────────────────────────────────────────────────────────┤
│ PostgreSQL+PostGIS · Redis · Celery/RabbitMQ · MinIO           │
└───────────────────────────┬──────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────┐
│ Data Ingestion: IMD · CPCB · INCOIS · ISRO · Open-Meteo        │
│ (provider abstraction + mocks; fallback chain, provenance)     │
└───────────────────────────────────────────────────────────────┘
```

## Repo Layout

```
repo
├── backend/        FastAPI modular monolith (Python 3.12)
├── mobile/         React Native app (TypeScript, Hermes, Expo)
├── infra/          docker-compose, nginx, deploy manifests
├── docs/           API contracts, schema, runbook
└── diagrams/       architecture & impact diagrams
```

## The Product In Numbers

| Aspect | Value |
|---|---|
| Problem Statement | PS 26076 — Personalized homepage for 'Mausam' app |
| Ministry | MoES / IMD |
| Theme | Smart Automation |
| Personas | 8 (Health, Fitness, Beach, Travel, Parent, Agriculture, Commuter, Events) |
| Ranking | Interest × Context × Urgency × Time × Location × Behavior |
| Notification priority | Severity × Location × Activity × Time × Preference |
| Alert phases | Official / Derived / Informational |
| Languages | EN + HI bundled; +9 regional lazy-loaded (TA/TE/BN/MR/GU/KN/ML/OR/PA) |
| Targets | Cold start <2.5 s · homepage p95 <500 ms · crash <0.5% · APK ≈25 MB |

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Docs at http://localhost:8000/docs — try `GET /api/v1/homepage/cards?user_id=...`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Data & Licensing

Official IMD/CPCB/INCOIS data is authoritative and free/public. Provider abstraction + mocks mean the demo never blocks on live API availability; licensing terms are verified during SIH week. See `docs/LICENSING.md`.

*Team BugNotFound · SIH 2026 · MoES / IMD · Prepared from the MAUSAM 2.0 Definitive Implementation Blueprint*