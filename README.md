# 17-Skill Master Stack — API Backend

Cloud sync backend for the 17-Skill Master Stack learning tracker.
**Supports unlimited users** — each person creates their own account and their progress is stored privately in the cloud.

---

## Deploy in 15 Minutes (100% Free)

### Step 1 — Fork or push to GitHub

```bash
cd masterstack-api
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/masterstack-api.git
git push -u origin main
```

---

### Step 2 — Create a free Turso database

Turso = free cloud SQLite (500MB, 1B reads/month).

```bash
# Install Turso CLI (Mac/Linux):
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up + log in:
turso auth signup

# Create the database:
turso db create masterstack-db

# Get your database URL:
turso db show masterstack-db --url
# → Copy the URL that looks like: libsql://masterstack-db-yourname.turso.io

# Create an auth token:
turso db tokens create masterstack-db
# → Copy the long token string
```

Keep both values — you'll need them in Step 3.

---

### Step 3 — Deploy to Render.com (free)

1. Go to **[render.com](https://render.com)** → sign up (free)
2. Click **New +** → **Web Service**
3. Connect your GitHub account → select the `masterstack-api` repo
4. Render auto-detects the `render.yaml` — click **Apply**
5. In the **Environment Variables** section, manually add:

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://masterstack-db-yourname.turso.io` |
| `TURSO_AUTH_TOKEN` | `<your token from Step 2>` |

6. Click **Deploy** → wait ~2 minutes
7. Render gives you a URL like: `https://masterstack-api.onrender.com`

---

### Step 4 — Push your schema to Turso

```bash
# In the masterstack-api folder, edit .env and add your Turso credentials:
TURSO_DATABASE_URL=libsql://masterstack-db-yourname.turso.io
TURSO_AUTH_TOKEN=<your token>
NODE_ENV=production

# Then push the schema:
npx drizzle-kit push
```

---

### Step 5 — Update the HTML file

Open `17Skill_MasterStack_v3.html` and find this line near the bottom:

```js
const API_BASE = 'http://localhost:3001/trpc';
```

Change it to your Render URL:

```js
const API_BASE = 'https://masterstack-api.onrender.com/trpc';
```

---

### Step 6 — Share with your 4 people

Send them:
1. The HTML file (or host it on GitHub Pages for a public URL)
2. They open it in any browser
3. Click the **☁ Cloud Sync** panel → **Register** with their email
4. Their progress syncs to the cloud automatically

Each person has **their own private account** — progress is never shared between users.

---

## Quick Test — Is It Working?

```bash
curl https://masterstack-api.onrender.com/health
# → {"status":"ok","ts":"..."}
```

---

## ⚠️ Render Free Tier Note

The free tier **sleeps after 15 minutes of inactivity**. First load after sleep takes ~30 seconds.
- This is fine for personal use with 5 people
- To avoid cold starts: upgrade to Render's $7/mo plan, or use [Railway.app](https://railway.app) ($5 free credit/month)

---

## Running Locally

```bash
npm run dev        # Server on http://localhost:3001
npm run db:studio  # Visual DB browser (Drizzle Studio)
```

## API Endpoints

All endpoints are at `/trpc/<router>.<procedure>`.

| Endpoint | Auth | Type |
|---|---|---|
| `auth.register` | ❌ | mutation |
| `auth.login` | ❌ | mutation |
| `auth.me` | ✅ | query |
| `progress.getAll` | ✅ | query |
| `progress.update` | ✅ | mutation |
| `progress.saveNotes` | ✅ | mutation |
| `progress.updateBook` | ✅ | mutation |
| `progress.incrementPomodoro` | ✅ | mutation |
| `habits.getAll` | ✅ | query |
| `habits.toggleDay` | ✅ | mutation |
| `tasks.getAll` | ✅ | query |
| `tasks.toggle` | ✅ | mutation |
| `tasks.addCustom` | ✅ | mutation |
| `dashboard.stats` | ✅ | query |
