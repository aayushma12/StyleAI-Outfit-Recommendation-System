# StyleAI — AI-Driven Outfit Recommendation System

**Final-year thesis project:** *"Design and Development of an Artificial Intelligence–Driven Outfit Recommendation System for Young Women Aged 18–25 Using Personalized Style Profiling in the Context of Kathmandu."*

StyleAI is a full-stack application that recommends outfits from a user's own digital wardrobe using a deterministic, explainable, ML-informed scoring pipeline — **not a single LLM prompt**. A large language model is used only for optional, fact-checked natural-language polish *after* the recommendation has already been computed by real code.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Thesis Objective](#thesis-objective)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Folder Structure](#project-folder-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Build Instructions](#build-instructions)
- [API Documentation](#api-documentation)
- [Machine Learning Pipeline](#machine-learning-pipeline)
- [Database Design](#database-design)
- [Testing](#testing)
- [Screenshots](#screenshots)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Author](#author)
- [License](#license)

---

## Project Overview

StyleAI has three cooperating services:

1. **Frontend** — React 18 (Create React App), no third-party UI kit, hand-authored CSS on a shared design-token system.
2. **Backend** — Node.js/Express + MongoDB (Mongoose). Owns authentication, the wardrobe, the recommendation pipeline, the AI assistant, and the admin panel.
3. **ML Service** — Python/Flask microservice hosting a trained Logistic Regression model that predicts the probability a user will accept a given outfit, based on the same 9 scoring dimensions the backend already computes.

The core academic contribution is the **recommendation pipeline itself**: candidate generation → deterministic multi-dimension scoring → ML-informed ranking → diversity selection → explanation — computed *before* any LLM is involved, with the LLM optionally polishing the wording afterward and discarded if it changes any fact.

## Thesis Objective

The system investigates whether a **personalized, explainable, hybrid recommendation approach** (deterministic rule-based scoring + a trained acceptance-probability model + collaborative behavioral signals) can produce outfit suggestions for young women in Kathmandu that are more relevant and trustworthy than either a purely rule-based system or a purely generative-AI system alone — while remaining fully explainable at every step, a requirement generative-only approaches cannot satisfy.

## Key Features

- **Personalized style profiling** — body type, skin tone, fashion styles, modesty preference, budget, lifestyle, and more, captured during onboarding and editable anytime.
- **AI-tagged wardrobe** — uploading a photo triggers real k-means color clustering (unsupervised ML, no API key needed) plus an optional vision-LLM call for category/pattern/fit/style/season/occasion, with graceful degradation to colors-only when no vision-capable provider is configured. Every AI-suggested field can be corrected by the user.
- **Deterministic recommendation engine** — hard fashion-compatibility filters, a 9-dimension weighted scoring model (style, color harmony, color preference, occasion fit, weather fit, behavior signal, body-type match, fabric match, trend score), a real trained acceptance-probability model, and an MMR-style diversity selector — all before any LLM call.
- **Explainable AI (XAI)** — every recommendation's explanation is generated from its actual computed scores (template-based, always present, always numerically consistent), with an optional LLM prose-polish pass that is validated and discarded if it changes any fact.
- **Kathmandu-specific context** — live weather (Open-Meteo), seasonal climate notes, historical climate normals, and festival/trend/local-brand data sourced from an admin-editable database collection (with hardcoded fallback data).
- **AI Fashion Assistant** — a chat assistant sharing the same recommendation engine as the dashboard (a "what should I wear" question is answered by the real pipeline, not a second, disconnected LLM guess), with a lexical grounding check that flags replies referencing wardrobe items the user doesn't actually own.
- **Behavioral learning** — accept/reject/save/rate signals feed both a lightweight collaborative-filtering signal and the acceptance-prediction model's training data.
- **Admin panel** — user management, wardrobe/feedback moderation, Kathmandu trend/festival CRUD, ML model retraining and metrics (including algorithm comparison and ranking-quality metrics), recommendation analytics.

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, React Router, Axios, hand-authored CSS (design-token system), Jest + React Testing Library |
| **Backend** | Node.js, Express, Mongoose (MongoDB), JSON Web Tokens, bcrypt, Helmet, express-rate-limit, express-validator, express-mongo-sanitize, Jest + Supertest |
| **Machine Learning** | Python, Flask, scikit-learn (Logistic Regression, Gradient Boosting), pandas, NumPy, joblib, pytest |
| **Database** | MongoDB (Mongoose ODM) |
| **AI Providers** | Anthropic Claude, Google Gemini, Groq (Llama) — cascaded, first configured provider wins |
| **Media Storage** | Cloudinary (unsigned client-side uploads) |
| **Email** | Nodemailer (SMTP — e.g. Mailtrap for development) |
| **DevOps** | Docker, Docker Compose, concurrently (unified dev orchestration) |

## System Architecture

```
┌─────────────┐      ┌──────────────────────────────────────────────┐      ┌────────────────────┐
│  Frontend   │◄────►│                   Backend                     │◄────►│    ML Service      │
│  (React)    │ HTTP │              (Node/Express)                   │ HTTP │   (Python/Flask)   │
└─────────────┘      │                                                │      └─────────┬──────────┘
                      │  contextEngine → candidateGenerationService   │                │
                      │    → rankingService → diversityEngine         │                │ /predict-acceptance-batch
                      │    → explanationService                       │                │ /retrain
                      │                                                │                │
                      │  aiProviderService (Anthropic/Gemini/Groq      │                ▼
                      │    cascade — text + vision, shared by the      │      Logistic Regression
                      │    recommendation engine AND the chat          │      acceptance-probability
                      │    assistant)                                  │      model (scikit-learn)
                      └───────────────────┬────────────────────────────┘
                                           │
                                           ▼
                                     MongoDB (Mongoose)
```

**The recommendation pipeline, precisely** (see `backend/services/recommendationEngine.js`):

```
contextEngine.buildContext()            — wardrobe, weather, season/festivals, behavior insights,
                                           collaborative signal, calendar event, dedup history
        ↓
candidateGenerationService              — hard-filters + assembles real outfit combinations
  .generateCandidates()                   from the wardrobe (zero LLM calls)
        ↓
rankingService.rankForCategories()      — 9-dimension scoring per candidate, ONE batched call
                                           to the ML acceptance model, per-category ranking
        ↓
diversityEngine.selectDiverse()         — MMR-style greedy selection: genuinely distinct
                                           outfits, penalized for overlap with recent history
        ↓
explanationService.explainSession()     — template explanation from the REAL scores (always
                                           present) + optional LLM polish (discarded on any
                                           factual mismatch)
        ↓
Recommendation.create(...)              — persisted session, returned to the client
```

The LLM is called **zero to two times** per session (an optional gap-fill for missing wardrobe slots, an optional prose polish) — never to decide which outfit is best.

## Project Folder Structure

```
StyleAI-Outfit-Recommendation-System/
├── backend/
│   ├── app.js                   # Express app definition (routes/middleware) — no listen/DB-connect
│   ├── server.js                # Runtime entrypoint: connects DB, seeds admin, calls app.listen()
│   ├── config/                  # db.js, cloudinary.js, env.js (dev/prod flag), validateEnv.js
│   ├── controllers/             # One per resource (auth, users, wardrobe, admin, ai, recommendations, ...)
│   ├── middleware/               # auth (JWT), admin (role guard), validateObjectId
│   ├── models/                  # Mongoose schemas
│   ├── routes/                  # Express routers + express-validator chains
│   ├── services/                 # The recommendation pipeline + supporting services (see below)
│   ├── utils/                    # validation.js (password/regex/enum helpers), urlSafety.js (SSRF guard)
│   ├── scripts/                  # Seed/backfill scripts (Kathmandu trends, synthetic ML bootstrap data, weather history)
│   └── tests/                    # Jest unit + integration tests
├── frontend/
│   ├── public/                   # Static assets served as-is
│   └── src/
│       ├── pages/                # Routed pages + Dashboard's internal tab views
│       ├── components/           # Shared components (RecommendationPanel, XAIPanel, ErrorBoundary, ...)
│       ├── context/               # AuthContext
│       ├── services/              # api.js (axios instance)
│       └── utils/                 # confidenceScale.js (shared score-color logic)
├── ml-service/
│   ├── app.py                    # Flask routes
│   ├── ml_engine.py               # Model singleton: load/predict/retrain/backup
│   ├── acceptance_trainer.py      # Training pipeline (pulls labeled data from MongoDB)
│   ├── ranking_metrics.py         # NDCG / diversity / personalization evaluation
│   ├── model_backups/             # Auto-created: timestamped model snapshots before each retrain (not versioned)
│   └── tests/                     # pytest unit tests
├── docker-compose.yml
├── .gitignore
├── README.md
└── package.json                   # Root orchestrator (concurrently runs all three services)
```

Key backend services (`backend/services/`):

| File | Responsibility |
|---|---|
| `contextEngine.js` | Gathers everything a session needs (wardrobe, weather, behavior, festivals) |
| `candidateGenerationService.js` | Deterministic outfit assembly from the wardrobe |
| `fashionRulesEngine.js` | Color theory, occasion/weather/body-type/fabric compatibility rules |
| `scoringService.js` | The 9-dimension weighted scoring model |
| `rankingService.js` | Per-category ranking + the one batched ML call per session |
| `diversityEngine.js` | MMR-style distinct-outfit selection with cross-session recency penalty |
| `explanationService.js` | Template explanations + optional, fact-checked LLM polish |
| `aiProviderService.js` | Shared Anthropic/Gemini/Groq cascade (text + vision) — used by both the recommendation engine and the chat assistant |
| `visionExtractionService.js` / `colorExtractionService.js` | Wardrobe photo → structured metadata (k-means color clustering + vision LLM) |
| `mlBridgeService.js` | Circuit-breaker-protected client for the Python ML service |
| `kathmanduIntelligence.js` | Kathmandu climate/festival/trend context, DB-first with hardcoded fallback |
| `groundingService.js` | Lexical heuristic flagging AI chat replies that reference a wardrobe item the user doesn't actually own |

## Prerequisites

- **Node.js** 20 or later
- **Python** 3.11 or later
- **MongoDB** (local instance or a MongoDB Atlas cluster)
- A **Cloudinary** account (free tier) for wardrobe image uploads
- At least one AI provider API key: **Google Gemini** (free), **Groq** (free), or **Anthropic Claude** (paid)
- (Optional) An SMTP provider such as **Mailtrap** for email verification in development

## Installation

```bash
git clone https://github.com/aayushma12/StyleAI-Outfit-Recommendation-System.git
cd StyleAI-Outfit-Recommendation-System

# Backend
cd backend
cp .env.example .env    # fill in MONGO_URI, JWT_SECRET, and at least one AI provider key
npm install
cd ..

# ML Service
cd ml-service
cp .env.example .env
python -m venv .venv
.venv\Scripts\activate       # Windows — use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
cp .env.example .env         # fill in Cloudinary cloud name + an unsigned upload preset
npm install
cd ..

# Root orchestrator
npm install
```

## Environment Variables

Each service has its own `.env.example` template — copy it to `.env` and fill in real values. **Never commit a real `.env` file.**

**`backend/.env`**

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign auth tokens — the server refuses to boot without it |
| `NODE_ENV` | Recommended | `development`/`test` relax rate limiting, cookie security, and CSP |
| `CLIENT_URL` | Yes, outside dev/test | CORS origin for the deployed frontend |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | For auto-seed | An admin account is created automatically on first boot if none exists |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For image uploads | Uploads go browser→Cloudinary directly (unsigned preset); the backend only ever stores the resulting URL |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `ANTHROPIC_API_KEY` | At least one | First configured provider wins; Gemini/Anthropic support vision (wardrobe photo tagging), Groq is text-only unless `GROQ_VISION_MODEL` is also set |
| `ML_SERVICE_URL` | No | Defaults to `http://localhost:8000`; the recommendation pipeline works without it |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | Without SMTP configured, accounts are auto-verified (dev-friendly default) |

**`frontend/.env`**

| Variable | Required |
|---|---|
| `REACT_APP_API_URL` | Yes |
| `REACT_APP_CLOUDINARY_CLOUD_NAME` | Yes |
| `REACT_APP_CLOUDINARY_UPLOAD_PRESET` | Yes — must be an **unsigned** Cloudinary preset |

**`ml-service/.env`**

| Variable | Required |
|---|---|
| `MONGO_URI` | Yes |
| `PORT` | No — defaults to `8000` |

## Running the Application

### Development mode (all services together)

From the project root:

```bash
npm run dev
```

This starts the backend on `http://localhost:5000`, the frontend on `http://localhost:3000`, and the ML service on `http://localhost:8000` concurrently.

### Running each service individually

```bash
npm run dev:backend     # Backend only — nodemon, auto-restarts on file changes
npm run dev:frontend    # Frontend only — CRA dev server with hot reload
npm run dev:ml          # ML service only — Flask dev server
```

### Bootstrapping demo/reference data (optional, recommended for a fresh database)

```bash
npm run seed:kathmandu         # Festival/trend/venue/seasonal/local-brand reference data
npm run seed:weather-history   # 12 months of Kathmandu climate normals
npm run seed:persona-data      # 30-persona synthetic behavioral dataset for ML training
npm run train:ml               # Trains the acceptance-probability model on the seeded data
```

## Build Instructions

**Frontend production build:**

```bash
cd frontend
npm run build
```

Outputs an optimized static bundle to `frontend/build/`, ready to be served by any static host (Netlify, Vercel, Nginx, etc.).

**Backend / ML service** are Node.js and Python runtimes respectively — there is no separate compilation step; deploy the source directly (see [Deployment](#deployment)) or containerize with the provided Dockerfiles.

## API Documentation

All routes are mounted under `/api` and require authentication (`protect` middleware) unless noted. Full route definitions live in `backend/routes/`.

| Base path | Purpose |
|---|---|
| `/api/auth` | register, login, logout, email verification, password reset |
| `/api/users` | profile, onboarding, saved outfits, account settings |
| `/api/wardrobe` | item CRUD, `/analyze` (AI photo tagging), saved outfit combos |
| `/api/calendar` | outfit calendar CRUD + AI suggestion |
| `/api/ai` | chat assistant, conversation history |
| `/api/recommendations` | `/generate`, `/wizard`, `/daily`, history, analytics, feedback |
| `/api/admin` | admin-only: user/content moderation, ML retraining, Kathmandu trend CRUD |

Every `:id` route validates the ID is a well-formed MongoDB ObjectId before hitting the database (`middleware/validateObjectId.js`), returning a clean `400` instead of a raw driver error.

## Machine Learning Pipeline

The live model is a **Logistic Regression acceptance-probability predictor** (`ml-service/acceptance_trainer.py`), trained on real `Recommendation` outcomes pulled directly from MongoDB — not a static CSV. It answers: *given this candidate outfit's 9 scoring dimensions, how likely is a real user to accept it?* It is blended into — not a replacement for — the deterministic rule-based score; the pipeline continues to function with the ML signal absent (`mlAcceptanceProbability: null`) if the ML service is unreachable.

- **Features**: the same 9 dimensions `scoringService.js` computes (style match, color harmony, color preference, occasion fit, weather fit, behavior signal, body-type match, fabric match, trend score) plus occasion formality, weather tier, and a wardrobe-only flag.
- **Why Logistic Regression over a tree ensemble by default**: this is a binary accept/reject decision, coefficients are directly interpretable (`+1.18` for `colorPref` means it measurably increases acceptance — a tree ensemble's `feature_importances_` gives magnitude only, never direction), and its `predict_proba` is honestly calibrated at this dataset size.
- **Cold start**: refuses to train below 50 labeled samples or with only one outcome class present, returning a clean, documented failure rather than a degenerate model.

### Persona-based synthetic training data

A thesis-timeline deployment cannot accumulate enough organic labeled interactions to train a meaningful personalization model on its own. `backend/scripts/personaDefinitions.js` defines **10 named style archetypes** representative of young Kathmandu women (e.g. `korean_minimalist_college`, `traditional_festival_lover`, `office_professional_minimalist`, `streetwear_trend_chaser`, `budget_conscious_practical`, `romantic_boho_dreamer`, `athleisure_active`, `modest_chic_conservative`, `vintage_grunge_alt`, `preppy_smart_casual`), each with a normalized 9-dimension weight vector, occasion bias, ideal comfort temperature, and traditional/festival affinity. `expandArchetypesToPersonas(3)` expands these into **30 jittered personas** with genuine within-archetype variation.

`backend/scripts/seedPersonaSyntheticBehavior.js` creates one real `User` per persona and simulates interactions over a recency-skewed 180-day window, using **real** `KATHMANDU_CLIMATE` and festival data to pick contextually appropriate occasions, deriving quality scores pulled toward each persona's own weight vector, and drawing acceptance via a per-persona sigmoid decision boundary. Every record is honestly tagged `synthetic: true` with a `syntheticMeta` block — never disguised as real. The model metadata and admin UI report the real/synthetic split transparently (`syntheticFraction`, `realSampleCount`, `personaCount`).

**Measured effect of the persona-based data (live retrain during development):**

| Metric | Single flat synthetic user (before) | 30-persona dataset (after) |
|---|---|---|
| Accuracy | 0.634 | 0.737 |
| F1 | 0.615 | 0.793 |
| ROC-AUC | 0.726 | 0.811 |
| Training rows | 201 | 9,158 (97.8% synthetic, 204 real) |

The improvement isn't just "more data" — the per-persona heterogeneity gives the model genuine structure to learn, since different personas' acceptance boundaries actually differ.

### Algorithm selection: Logistic Regression vs. Gradient Boosting

`compare_algorithms()` runs both `LogisticRegression` (the deployed default) and `GradientBoostingClassifier` through 5-fold stratified cross-validation. **Decision rule**: keep Logistic Regression unless Gradient Boosting's mean CV ROC-AUC beats it by more than a documented `+0.03` margin — chosen because Logistic Regression's directly-signed coefficients feed the explainability panel, so a marginal accuracy gain from a black-box-ish ensemble isn't worth losing that. On the actual development dataset this comparison honestly recommended Logistic Regression (LR ROC-AUC 0.798 vs. GB 0.793). The deployed algorithm can be switched via the `ML_ALGORITHM` environment variable without a code change.

### Ranking-quality metrics

Classification metrics alone don't capture ranking quality. `ranking_metrics.py` adds:

- **NDCG@5** (relevance mapping `worn=3, liked=2, saved=2, disliked=0, skipped=0`), computed **separately** for real and synthetic sessions — never conflated.
- **Diversity** — the same Jaccard-similarity formula used in `diversityEngine.js`'s anti-repetition logic, ported to Python for direct comparability.
- **Personalization** — mean pairwise Jaccard distance between different real users' top-ranked picks for the same occasion, computed on real sessions only.

`GET /ranking-metrics` (admin-proxied at `GET /admin/ml/ranking-metrics`) reports every metric alongside its sample-size denominator rather than hiding a low `n`.

Retrain via `npm run train:ml` (from the repo root) or the admin panel's "Retrain Model" button, which reports real accuracy/precision/recall/F1/ROC-AUC/confusion-matrix metrics plus the synthetic/real data split and algorithm comparison.

### Known limitations

- The persona generator is a researcher-defined simulation based on domain knowledge, not a real user study — disclosed, not hidden, and standard practice for cold-start bootstrapping.
- Ranking-quality metrics on real (non-synthetic) data currently have low sample sizes, since organic usage is still accumulating post-launch.
- The AI Assistant's grounding check (`groundingService.js`) is a lexical heuristic, not semantic verification — a paraphrase can slip through, and an unusually-worded real item could occasionally be over-flagged. It is a bounded safety net, not a hallucination-detection guarantee.
- Kathmandu local-brand content is researcher-curated by category (e.g. "Thamel independent boutiques"), not scraped or verified against specific commercial businesses.
- Historical weather data stores climate normals, not a live-measured day-by-day archive.

## Database Design

MongoDB via Mongoose. The most structurally significant collections:

- **`User`** — auth + the full personalized style profile inline (body type, skin tone, fashion styles, modesty level, budget, lifestyle, etc.).
- **`WardrobeItem`** — manually-entered fields (name, category, color, occasion, season) plus AI-extracted structured metadata (`colorHex`, `subcategory`, `fit`, `formalityLevel`, `styleTags`, etc.) with an `unverifiedFields`/`metadataReviewed` flag pair so the UI can show "AI suggested" badges until the user confirms or edits a field.
- **`Recommendation`** — one document per generated session, embedding up to 5 fully-scored, fully-explained outfit candidates, plus the context (weather, occasion, calendar event) that produced them.
- **`KathmanduTrend`** — admin-editable festival/trend/venue/seasonal-note/local-brand data that `kathmanduIntelligence.js` reads DB-first, falling back to hardcoded seasonal data only if the collection is empty.
- **`BehaviorLog`** — append-only interaction log (TTL-expired after 365 days) feeding both the collaborative-filtering signal and the ML model's training labels.
- **`WeatherHistory`** — monthly climate-normal reference table sourced from a hardcoded Kathmandu climate table, explicitly labeled as reference data rather than a live-measured archive.

## Testing

185 automated tests across all three services — run everything with:

```bash
npm test
```

Or per-service:

```bash
npm run test:backend    # Jest + Supertest, 141 tests
npm run test:ml         # pytest, 34 tests
npm run test:frontend   # React Testing Library, 10 tests
```

**Backend** (`backend/tests/`): integration tests run against an isolated in-memory MongoDB (`mongodb-memory-server`) via a real `supertest`-driven Express app — auth flows, wardrobe CRUD, validation, cross-user data isolation, malformed-ID handling, the wardrobe AI-metadata backfill, and the AI chat's session linking and grounding-flag behavior. Unit tests cover the recommendation engine's pure logic (fashion rules, scoring, candidate generation, diversity selection), the persona-based synthetic data generator, the Kathmandu intelligence service, the `WeatherHistory` schema, and security utilities (SSRF domain allowlist, regex-escaping, password strength).

**ML service** (`ml-service/tests/`): the training pipeline's feature-schema contract, label-derivation logic, the cold-start guard, an end-to-end train-and-evaluate smoke test, synthetic-data provenance columns, the Logistic-Regression-vs-Gradient-Boosting comparison, and the NDCG/Jaccard ranking-quality metrics.

**Frontend** (`frontend/src/**/__tests__/`): the shared confidence-scale utility and the Error Boundary's catch-and-render behavior.

**Note**: the very first backend test run downloads a real MongoDB binary for `mongodb-memory-server` (~500–800 MB, one-time, then cached permanently) — this can take several minutes depending on your connection.

## Screenshots

> Screenshots will be added here prior to final thesis submission.

| Page | Preview |
|---|---|
| Landing Page | _placeholder_ |
| Onboarding / Style Profiling | _placeholder_ |
| Dashboard | _placeholder_ |
| Wardrobe Management | _placeholder_ |
| Outfit Recommendations (XAI Panel) | _placeholder_ |
| AI Fashion Assistant | _placeholder_ |
| Admin Panel | _placeholder_ |

## Deployment

`docker-compose.yml` defines four services (`mongodb`, `backend`, `ml-service`, `frontend`). `JWT_SECRET` must be supplied via your shell or a `.env` file — the compose file will refuse to start without it.

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") docker-compose up --build
```

Each service also has its own standalone `Dockerfile` if you'd rather deploy them independently (e.g., frontend to a static host, backend to a container platform, ML service to a separate scale-to-zero function).

## Troubleshooting

- **"AI Assistant needs an API key"** — add `GEMINI_API_KEY` (free, supports vision) or `GROQ_API_KEY` (free, text-only) to `backend/.env` and restart.
- **Wardrobe photo uploads fail** — confirm `CLOUDINARY_*` vars are set in `backend/.env` and the frontend's `REACT_APP_CLOUDINARY_UPLOAD_PRESET` is configured as an **unsigned** preset in your Cloudinary dashboard.
- **CORS errors after deploying beyond localhost** — set `CLIENT_URL` in the backend environment to your real frontend origin.
- **ML predictions always show as unavailable** — the acceptance model needs training first (`npm run train:ml`); check the ML service's console for whether it loaded a model at startup.
- **First `npm test` run is slow** — expected; see [Testing](#testing).

## Future Improvements

- Deepen the outfit wizard's use of its own context parameters (`budget`, `dresscode`, `vibe`, `indoorOutdoor`, `dayNight` are currently stored but don't yet steer candidate generation as strongly as `colors`/`style`/`accessories` do).
- A stronger cross-style hard filter for sparse wardrobes under high diversity pressure.
- Retrain the acceptance model on real usage data as more accumulates post-launch.
- Broader `express-validator` coverage across the full admin surface.
- A CRA→Vite migration to resolve a set of long-standing, dev-toolchain-only `npm audit` findings inherited from `react-scripts` (none affect the production bundle).

## Author

**Aayushma Acharya**
Final Year Student — Softwarica College of IT & E-Commerce
GitHub: [@aayushma12](https://github.com/aayushma12)

## License

This project was developed as part of the requirements for a final-year undergraduate thesis. All rights reserved. The source code is made publicly available for portfolio and academic evaluation purposes; please contact the author before reusing substantial portions of it.
