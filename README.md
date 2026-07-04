# StyleAI — AI-Driven Outfit Recommendation System

Final-year thesis project: *"Design and Development of an Artificial Intelligence–Driven Outfit Recommendation System for Young Women Aged 18–25 Using Personalized Style Profiling in the Context of Kathmandu."*

StyleAI recommends outfits from a user's own digital wardrobe using a deterministic, explainable, ML-informed scoring pipeline — not a single LLM prompt. It's a full-stack app: **React** frontend, **Node/Express + MongoDB** backend, and a **Python/Flask** ML microservice that predicts outfit-acceptance probability with a trained Logistic Regression model.

## Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB (local or Atlas)
- A Cloudinary account (free tier) for wardrobe image uploads
- At least one AI provider API key — Gemini or Groq (free) or Anthropic (paid)

## Setup

```bash
git clone https://github.com/aayushma12/StyleAI-Outfit-Recommendation-System.git
cd StyleAI-Outfit-Recommendation-System

# Backend
cd backend && cp .env.example .env && npm install && cd ..

# ML Service
cd ml-service && cp .env.example .env
python -m venv .venv
.venv\Scripts\activate       # Windows — use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt && cd ..

# Frontend
cd frontend && cp .env.example .env && npm install && cd ..

# Root orchestrator
npm install
```

Fill in each `.env` file with your own values — see the `.env.example` in each folder for what's required (MongoDB URI, JWT secret, Cloudinary keys, an AI provider key).

## Running the app

```bash
npm run dev
```

Starts everything together: backend on `http://localhost:5000`, frontend on `http://localhost:3000`, ML service on `http://localhost:8000`.

Or run each service on its own:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:ml
```

An admin account is created automatically on first boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `backend/.env`.

### Optional: seed reference/demo data

```bash
npm run seed:kathmandu         # Kathmandu festival/trend/venue reference data
npm run seed:weather-history   # 12 months of climate normals
npm run seed:persona-data      # Synthetic behavioral data for ML training
npm run train:ml               # Trains the acceptance-probability model
```

## Testing

```bash
npm test
```

## Author

**Aayushma Acharya** — Final Year Student, Softwarica College of IT & E-Commerce
GitHub: [@aayushma12](https://github.com/aayushma12)

## License

Developed as part of a final-year undergraduate thesis. All rights reserved.
