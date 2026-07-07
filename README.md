# StyleAI — AI-Driven Outfit Recommendation System

Final-year thesis project: *"Design and Development of an Artificial Intelligence–Driven Outfit Recommendation System for Young Women Aged 18–25 Using Personalized Style Profiling in the Context of Kathmandu."*

StyleAI recommends outfits from a user's own digital wardrobe using a deterministic, explainable, ML-informed scoring pipeline — not a single LLM prompt. It's a full-stack app: **React** frontend, **Node/Express + MongoDB** backend, and a **Python/Flask** ML microservice that predicts outfit-acceptance probability with a trained Logistic Regression model.

## Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB 
- A Cloudinary account for wardrobe image uploads
- A free Google Gemini API key (aistudio.google.com/app/apikey)


# Backend
cd backend && cp .env.example .env && npm install && cd ..

# ML Service
cd ml-service && cp .env.example .env
python -m venv .venv
.venv\Scripts\activate       # Windows — use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt && cd ..

# Frontend
cd frontend && cp .env.example .env && npm install && cd ..


## Author

**Aayushma Acharya** — Final Year Student, Softwarica College of IT & E-Commerce
GitHub: [@aayushma12](https://github.com/aayushma12)

