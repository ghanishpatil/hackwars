# Deploy: Frontend (Vercel), Backend (Render), Match Engine (VPS with Docker)

This guide deploys the CTF platform in three parts:

- **Frontend** → Vercel  
- **Backend** → Render (Web Service)  
- **Match Engine** → A VPS with Docker (Render cannot run Docker for you)

Deploy in this order: **Backend first**, then **Match Engine**, then **Frontend** (so you have URLs for env vars).

---

## Prerequisites

1. **Firebase**: Project set up with Auth, Firestore, Storage. Deploy rules and indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
2. **Repo**: Code in a Git repo (GitHub/GitLab) that Vercel and Render can access.
3. **VPS**: A server with Docker and Node.js for the match engine (e.g. DigitalOcean Droplet, Ubuntu 22.04, 1GB+ RAM).

---

## 1. Backend on Render

1. Go to [Render](https://render.com) → **Dashboard** → **New** → **Web Service**.
2. **Connect** your repo.
3. **Settings**:
   - **Name**: `ctf-backend` (or any name).
   - **Region**: Choose one.
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or paid (Free has cold starts).

4. **Environment** (add variables):

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` (Render sets PORT; 3000 is fallback) |
   | `CORS_ORIGIN` | `https://YOUR_VERCEL_APP.vercel.app` (replace after frontend deploy) |
   | `FIREBASE_PROJECT_ID` | From Firebase Console |
   | `FIREBASE_PRIVATE_KEY` | Service account private key (paste full key; newlines as `\n`) |
   | `FIREBASE_CLIENT_EMAIL` | Service account email |
   | `FIREBASE_STORAGE_BUCKET` | e.g. `your-project.firebasestorage.app` |
   | `MATCH_ENGINE_URL` | `https://YOUR_MATCH_ENGINE_DOMAIN` (set after match engine deploy) |

5. **Create Web Service**. Note the URL (e.g. `https://ctf-backend.onrender.com`).

6. **CORS**: After frontend is on Vercel, set `CORS_ORIGIN` to your Vercel URL (or comma-separated list). You can use a wildcard like `https://*.vercel.app` only if Render supports it; otherwise set the exact frontend URL.

---

## 2. Match Engine on a VPS (Docker + Node)

The match engine must run on a host that has **Docker** (to create networks and containers). Render’s Web Service does not give you a Docker daemon, so use a VPS.

### 2.1 Create a free VPS (Oracle Cloud Always Free)

**Oracle Cloud** offers **Always Free** VMs (no time limit, no credit after free tier):

1. Go to [Oracle Cloud](https://www.oracle.com/cloud/free/) → **Start for free**.
2. Create an account (they may ask for a card for verification; Always Free resources do not charge).
3. In the Console: **Menu** → **Compute** → **Instances** → **Create Instance**.
4. **Name**: e.g. `match-engine`.
5. **Image and shape**:  
   - **Image**: **Canonical Ubuntu 22.04**.  
   - **Shape**: Click **Change shape** → **Ampere** → **VM.Standard.A1.Flex** (ARM, free). Set **1 OCPU**, **6 GB memory** (or 2 OCPU, 3 GB — stay within Always Free limits).  
   - Or use **AMD** shape: **VM.Standard.E2.1.Micro** (1/8 OCPU, 1 GB RAM) if A1 is not available in your region.
6. **Networking**: Create or select a VCN; ensure **Assign a public IPv4 address** is checked.
7. **Add SSH keys**: Upload your public key or paste it so you can SSH in.
8. **Create**. Wait for the instance to be **Running**, then note its **Public IP**.

9. **Open port 7000** (so the backend can reach the engine):  
   **Menu** → **Networking** → **Virtual Cloud Networks** → your VCN → **Security Lists** → **Default Security List** → **Add Ingress Rules**:
   - Source: `0.0.0.0/0`
   - Destination port: `7000`
   - Save.

Then SSH in (replace with your key and IP):

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

(Use `ubuntu` if your image is Ubuntu; for Oracle Linux it may be `opc`.)

### 2.2 On the VPS: Install Docker and Node

```bash
# SSH into the VPS (Oracle: user is usually ubuntu)
ssh ubuntu@YOUR_VPS_IP

# Install Docker (use sudo if not root)
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable docker
sudo systemctl start docker
# Allow your user to run Docker without sudo (optional)
sudo usermod -aG docker $USER
# Log out and back in for the group to apply, or run next commands with sudo docker

# Install Node 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2.3 Deploy the match engine

```bash
# Clone your repo (or use git pull if already cloned)
git clone https://github.com/YOUR_USER/YOUR_REPO.git
cd YOUR_REPO/match-engine

# Install dependencies
npm install

# Create .env
nano .env
```

**.env** on the VPS (match-engine):

```env
PORT=7000
NODE_ENV=production
BACKEND_URL=https://ctf-backend.onrender.com
FLAG_SECRET=your-long-random-secret-at-least-16-chars
MAX_CONCURRENT_MATCHES=50
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

### 2.4 Run with PM2 (keeps it running)

```bash
sudo npm install -g pm2
pm2 start src/engine.js --name match-engine
pm2 save
pm2 startup
# Run the command that pm2 startup prints (e.g. sudo env PATH=... pm2 startup)
```

### 2.5 Expose the match engine (for backend to call it)

- **Option A – Direct port**: On Oracle Cloud you already opened port `7000` in step 2.1. Use `http://YOUR_ORACLE_PUBLIC_IP:7000` as `MATCH_ENGINE_URL` in the backend. Render can reach this public IP. (Traffic is HTTP; for production you can put a reverse proxy in front with HTTPS.)
- **Option B – Reverse proxy with HTTPS**: Put Nginx (or Caddy) on the VPS in front of the match engine, point a domain (or subdomain) to the VPS, and use HTTPS. Then set `MATCH_ENGINE_URL=https://engine.yourdomain.com` in the backend.

**Nginx example** (if you have a domain pointing to the VPS):

```nginx
# /etc/nginx/sites-available/match-engine
server {
    listen 80;
    server_name engine.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/match-engine /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Use **Option B** URL as `MATCH_ENGINE_URL` in the backend.

---

## 3. Frontend on Vercel

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. **Import** your Git repo.
3. **Settings**:
   - **Root Directory**: `frontend` (click **Edit**, set to `frontend`).
   - **Framework Preset**: Vite (auto-detected).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables** (add these):

   | Key | Value |
   |-----|--------|
   | `VITE_API_URL` | `https://ctf-backend.onrender.com` |
   | `VITE_SOCKET_URL` | `https://ctf-backend.onrender.com` |
   | `VITE_FIREBASE_API_KEY` | From Firebase Console |
   | `VITE_FIREBASE_AUTH_DOMAIN` | From Firebase Console |
   | `VITE_FIREBASE_PROJECT_ID` | From Firebase Console |
   | `VITE_FIREBASE_STORAGE_BUCKET` | From Firebase Console |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
   | `VITE_FIREBASE_APP_ID` | From Firebase Console |

5. **Deploy**. Note the frontend URL (e.g. `https://your-app.vercel.app`).

6. **Backend CORS**: In Render, set the backend env var `CORS_ORIGIN` to your Vercel URL (e.g. `https://your-app.vercel.app`). Redeploy the backend if needed.

---

## 4. After deploy checklist

| Item | Where | What |
|------|--------|------|
| Backend URL | Render | Use as `VITE_API_URL` and `VITE_SOCKET_URL` in Vercel. |
| Match engine URL | VPS (or domain) | Use as `MATCH_ENGINE_URL` in Render backend. |
| CORS | Render backend | `CORS_ORIGIN` = exact Vercel frontend URL. |
| Firebase | Firebase Console | Auth domains: add your Vercel domain. |
| Engine API | Backend | Engine calls backend at `BACKEND_URL`; backend must be reachable from VPS (Render URL is public). |

---

## 5. Summary

| Service | Where | Notes |
|---------|--------|------|
| **Frontend** | Vercel | Root = `frontend`, build = `npm run build`, env = `VITE_*` and Firebase. |
| **Backend** | Render | Root = `backend`, start = `npm start`, env = Firebase + `MATCH_ENGINE_URL` + `CORS_ORIGIN`. |
| **Match Engine** | Free VPS (Oracle Cloud Always Free) | Node + Docker, `.env` with `BACKEND_URL` + `FLAG_SECRET`, run with `pm2 start src/engine.js`. |

The match engine **must** run on a host with Docker (VPS). Render only runs your Node app in a container; it does not give your app access to the Docker daemon to create match containers. **Oracle Cloud Always Free** gives you one or more VMs at no cost (no charges if you stay within Always Free limits).
