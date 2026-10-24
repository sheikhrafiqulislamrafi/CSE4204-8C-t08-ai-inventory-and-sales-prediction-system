# myShop AI — Deployment Checklist (Render + Vercel)

This file documents how to deploy the project. Follow the numbered steps.

---

## Part A: Backend (Express API) on Render

### Step 1: Prepare code
1. Push your project to GitHub (the whole repo must have `backend/` and `frontend/` at root).
2. Add a `Dockerfile` in `backend/` if missing (see below) OR keep the plain Node build on Render.

### Step 2: Create PostgreSQL database on Render
1. Go to [render.com](https://render.com) → Databases → New → PostgreSQL.
2. Wait until status is "Available".
3. Copy the connection string. It looks like:
   ```
   postgres://postgres:postgres@host-name.onrender.com:5432/db-name
   ```
   Use this exact string as your `DATABASE_URL`.

### Step 3: Create a Web Service on Render
1. On Render, click **Create > New Web Service**.
2. Select **Connect to Git** → choose your repo.
3. Choose **Build from source** (no custom Dockerfile needed; Render runs `npm install && npm start` automatically).
4. Set **Root Directory**: `backend`
5. Set **Build Command**: `npm install`
6. Set **Start Command**: `npm start`
7. Deploy once.

### Step 4: Configure environment variables (Render dashboard → Build & Env tab of your service)
| Variable | Value |
|---|---|
| `PORT` | `8000` (auto-assigned, don't change) |
| `DATABASE_URL` | Your PostgreSQL connection string (copied above) |
| `JWT_SECRET` | Any strong random string like `myshop-ai-secret-key-prod-2026` |
| `CORS_ORIGINS` | `https://your-frontend-vercel-url.vercel.app` |
| (optional) | `GOOGLE_AI_STUDIO_KEY`, etc. |

Save & restart the service. Note its URL, e.g. `https://myshop-ai-backend.onrender.com`.

### Step 5: Test backend
Open `https://your-backend-url/api/health` in the browser → should return JSON with `status: 'ok'`.

---

## Part B: Frontend (React Vite) on Vercel

### Step 1: Prepare code
Push whole repo to GitHub. Vercel auto-detects the root (project root).

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → GitHub repository.
2. Root directory: leave empty (project at repo root) or set to `frontend`.
3. Framework preset: **Vite** (auto detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy. Copy your URL, e.g. `https://myshop-ai.vercel.app`.

### Step 3: Configure Vercel environment variable
Vercel → Project → Settings → Environment Variables:
| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend-render-url/api` |
| `VITE_APP_NAME` | `myShop AI` |
| `VITE_APP_VERSION` | `2.0.0` |

Commit & redeploy frontend.

### Step 4: Final check
Open `https://your-frontend-url.vercel.app` → register or login → upload orders/products → test pricing AI, restock planner, win-back.

---

## Part C: Production notes
- If using **Railway** instead of Render: same steps, Railway gives `https://your-service.up.railway.app`.
- For both platforms update `CORS_ORIGINS` in the backend after frontend URL is known.
- Keep `backend/.env.example`; never commit real secrets to git.
- `docker-compose.yml` works locally / self-hosted; online only if you run your own server.
