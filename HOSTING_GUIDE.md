# 🌐 Backend API & AI Model Hosting Guide

Iss guide me bataya gaya hai ki aap apne backend ko kisi bhi cloud provider (Render, Railway, VPS, Docker, ya Vercel) par kaise smoothly host kar sakte hain aur endpoints & AI models ko access kar sakte hain.

---

## 🛠️ 1. Architecture Overview (How it Works)

1. **Database Persistence**:
   - Primary database local JSON file hai (`data/db.json`).
   - Disk writes atomic and thread-safe hain via `server/db.ts`.
   - Production cloud persistence ke liye volume mount (`./data:/app/data`) use hota hai taaki data restart hone par remove na ho.

2. **AI & ML Model Hosting**:
   - Backend par Gemini 2.0 / 1.5 Flash models hosted hain (`server/routes/ai.routes.ts`).
   - Agar `GEMINI_API_KEY` present nahi hai, toh automatic rule-based local model fallback run hota hai.

3. **REST API Endpoints**:
   - All endpoints `/api/*` ke under structured hain with CORS enabled, JWT authentication, and standardized JSON responses.

---

## 📡 2. Core API Endpoints Reference

### 🏥 System & Health Check
- `GET /api/health` -> System health and uptime
- `GET /api/status` -> Database record count and status

### 🔐 Auth Endpoints
- `POST /api/auth/signup` -> Register new user
- `POST /api/auth/login` -> Login user (returns JWT access & refresh tokens)
- `POST /api/auth/refresh` -> Get new access token
- `POST /api/auth/logout` -> Invalidate session
- `GET /api/auth/me` -> Fetch current user profile

### 🧠 AI Model Endpoints (Hosted AI & Prediction Models)
- `POST /api/ai/prioritize` -> AI Urgency & Risk model
- `POST /api/ai/subtasks` -> AI Subtask breakdown model
- `POST /api/ai/schedule` -> AI Daily Schedule planner model
- `POST /api/ai/coach` -> AI Focus Coach chat assistant
- `POST /api/ai/predict` -> AI Task Delay prediction & Consistency model
- `POST /api/ai/simulate` -> AI What-If scenario simulation
- `POST /api/ai/rescue` -> AI Emergency schedule recovery model
- `POST /api/ai/goals/plan` -> AI Goal decomposition model

---

## 🚀 3. How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables in .env
GEMINI_API_KEY="your-gemini-api-key"
JWT_SECRET="your-custom-secret"

# 3. Start development server
npm run dev
```

The API will be live at `http://localhost:3000`.

---

## 🐳 4. Hosting via Docker & Docker Compose

Aap kisi bhi Linux VPS (AWS EC2, DigitalOcean, Hetzner, Linode) par Docker ke zariye 1-command deployment kar sakte hain:

```bash
# Docker image build & run
docker-compose up -d --build
```

Aapka backend `http://<your-server-ip>:3000` par access ho jayega aur `./data/db.json` volume ke through permanent save rahega.

---

## ☁️ 5. Free Cloud Hosting (Render / Railway)

### Option A: Render.com (Recommended for Free Tier)
1. GitHub par project push karein.
2. Render Dashboard -> **New Web Service** -> Connect GitHub repo.
3. Settings:
   - **Environment**: Node
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `GEMINI_API_KEY` = `<your_key>`
   - `JWT_SECRET` = `<your_secret>`
5. Click **Deploy Web Service**.

### Option B: Railway.app
1. Railway Dashboard -> **New Project** -> Deploy from GitHub repo.
2. Railway auto-detects `Dockerfile` or `package.json`.
3. Add `GEMINI_API_KEY` in Environment Variables.
4. Deploy.

---

## 🧪 6. Testing Endpoints via Curl

```bash
# Health Check
curl http://localhost:3000/api/health

# AI Task Breakdown Model
curl -X POST http://localhost:3000/api/ai/subtasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-last-minute-life-saver" \
  -d '{"title": "Build AI Model API", "description": "Create scalable Node backend"}'
```
