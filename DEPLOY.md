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

### 2.6 Deploy match engine on your own server (detailed)

You can run the **match engine** on your own PC or home server (Windows, macOS, or Linux) instead of a cloud VPS. The backend (e.g. on Render) must be able to reach this engine over the internet.

---

#### Requirements (own server)

| Requirement | Details |
|-------------|---------|
| **OS** | Windows 10/11, macOS, or Linux (e.g. Ubuntu 22.04). |
| **Docker** | Must be installed and running. The engine uses Docker to create match networks and containers. |
| **Node.js** | v20 LTS or newer. |
| **RAM** | 4 GB+ recommended (each match runs multiple containers). |
| **Network** | A way for the cloud backend to reach your machine: **public IP + port forward**, or a **tunnel** (ngrok / Cloudflare Tunnel). |

---

#### Step 1: Install Docker and Node.js

**Windows**

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). Start Docker Desktop and ensure it is running (whale icon in system tray).
2. Install Node 20 LTS from [nodejs.org](https://nodejs.org/) (LTS), or with `winget install OpenJS.NodeJS.LTS`.

**macOS**

```bash
# Docker
# Download Docker Desktop from https://www.docker.com/products/docker-desktop/ and install. Start the app.

# Node 20 (with Homebrew)
brew install node@20
brew link --overwrite node@20
```

**Linux (e.g. Ubuntu 22.04)**

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER   # then log out and back in

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:

```bash
docker --version
node --version   # should be v20.x
```

---

#### Step 2: Get the code and install dependencies

On your server (or PC):

```bash
# Clone the repo (replace with your repo URL)
git clone https://github.com/YOUR_USER/YOUR_REPO.git
cd YOUR_REPO/match-engine

# Install Node dependencies
npm install
```

If you already have the repo, just pull and install:

```bash
cd /path/to/your/repo/match-engine
git pull
npm install
```

---

#### Step 3: Configure environment (`.env`)

Create a `.env` file in the `match-engine` folder (copy from `.env.example`):

```bash
cp .env.example .env
# Then edit .env with your values (see below)
```

**Variables explained:**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Port the engine HTTP server listens on. | `7000` |
| `NODE_ENV` | Yes | Use `production` on a real server. | `production` |
| `BACKEND_URL` | Yes | Full URL of your backend (Render). The engine calls this to fetch default service collections and to push match infrastructure. | `https://ctf-backend.onrender.com` |
| `FLAG_SECRET` | Yes | Secret used for HMAC/signing of flags. Generate a long random string; **must match** what the backend uses for the same matches. | e.g. 32+ random chars |
| `MAX_CONCURRENT_MATCHES` | No | Max number of matches at once; engine rejects new ones above this. | `50` |
| `FLAG_SUBMIT_RATE_MAX` | No | Max flag submissions per window (rate limit). | `30` |
| `MAX_CONTAINER_AGE_HOURS` | No | Containers older than this are cleaned up by the safety cron. | `4` |
| `MAX_MATCH_DURATION_HOURS` | No | Matches older than this are considered stale for cleanup. | `3` |

**Example `.env` (backend on Render):**

```env
PORT=7000
NODE_ENV=production
BACKEND_URL=https://ctf-backend.onrender.com
FLAG_SECRET=your-long-random-secret-at-least-32-chars
MAX_CONCURRENT_MATCHES=50
FLAG_SUBMIT_RATE_MAX=30
MAX_CONTAINER_AGE_HOURS=4
MAX_MATCH_DURATION_HOURS=3
```

**Important:** The backend must use the **same** `FLAG_SECRET` (or equivalent) when generating/validating flags for matches that this engine provisions; otherwise scoring will not align.

---

#### Step 4: Run the match engine

**Quick run (foreground, for testing):**

```bash
node src/engine.js
```

You should see the server listening on `PORT` (e.g. `7000`). Stop with `Ctrl+C`.

**Run in background and survive reboots (recommended):**

- **Linux / macOS:** use PM2.

  ```bash
  sudo npm install -g pm2
  pm2 start src/engine.js --name match-engine
  pm2 save
  pm2 startup
  # Run the command that pm2 startup prints (e.g. sudo env PATH=... pm2 startup)
  ```

  Useful: `pm2 status`, `pm2 logs match-engine`, `pm2 restart match-engine`.

- **Windows:** run as a service or use a process manager. For a simple “run in background” option you can use `pm2` (install via npm and run in the same way), or run `node src/engine.js` inside a terminal that stays open / under a Windows service wrapper.

After this step, the engine is reachable **only on this machine** at `http://localhost:7000`. Next, expose it so the backend on the internet can call it.

---

#### Step 5: Expose the engine so the backend can reach it

The backend (e.g. on Render) needs a **public URL** for the match engine. Choose one of the following.

---

**Option A: Port forwarding (you have a public IP)**

1. **Find your machine’s local IP** (e.g. `192.168.1.100`):  
   - Windows: `ipconfig`  
   - macOS/Linux: `ip addr` or `ifconfig`
2. **Router:** Log in to your router (often `192.168.1.1` or `192.168.0.1`). Find **Port Forwarding** / **Virtual Server** / **NAT**.
3. **Add a rule:**  
   - External port: `7000` (TCP)  
   - Internal IP: your PC’s IP (e.g. `192.168.1.100`)  
   - Internal port: `7000`  
   Save.
4. **Public IP:** Check [whatismyip.com](https://www.whatismyip.com/) or similar. If your ISP gives you a **dynamic** IP, it can change; use a **DDNS** hostname (e.g. No-IP, DuckDNS) and point it to your public IP, then use that hostname instead of the raw IP.
5. **Firewall:** On the PC, allow inbound TCP port `7000` (Windows Firewall / `ufw` on Linux).
6. **Engine URL:**  
   `http://YOUR_PUBLIC_IP:7000` or `http://YOUR_DDNS_HOSTNAME:7000`  
   Use this as `MATCH_ENGINE_URL` in the backend (Render).

---

**Option B: ngrok (no port forwarding, good for dev / home)**

1. Sign up at [ngrok.com](https://ngrok.com) and get your auth token.
2. Install ngrok:  
   - [Download](https://ngrok.com/download) for your OS, or  
   - macOS: `brew install ngrok`  
   - Windows: `winget install ngrok.ngrok` or use the installer from the site.
3. Configure auth (once):  
   `ngrok config add-authtoken YOUR_TOKEN`
4. Start the match engine (Step 4), then in another terminal:  
   `ngrok http 7000`
5. ngrok will print a **Forwarding** URL, e.g. `https://abc123.ngrok-free.app`.  
   **Use this exact URL** as `MATCH_ENGINE_URL` in the backend (Render).
6. **Limitation (free tier):** The URL changes each time you restart ngrok. After each restart, update `MATCH_ENGINE_URL` in Render and redeploy/restart the backend if it caches the URL.

---

**Option C: Cloudflare Tunnel (free, stable hostname possible)**

1. Install `cloudflared`:  
   - [Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for your OS, or  
   - macOS: `brew install cloudflared`  
   - Linux: e.g. `wget ... && sudo dpkg -i cloudflared-*.deb` (see Cloudflare docs).
2. **Quick tunnel (no Cloudflare account, URL changes each run):**  
   `cloudflared tunnel --url http://localhost:7000`  
   Use the printed `https://xxx.trycloudflare.com` URL as `MATCH_ENGINE_URL`. Update the backend when the URL changes.
3. **Named tunnel (stable URL, needs Cloudflare account):**  
   - Log in: `cloudflared tunnel login` (opens browser).  
   - Create tunnel: `cloudflared tunnel create match-engine`.  
   - Create a config file (e.g. `~/.cloudflared/config.yml`) with `ingress` pointing to `http://localhost:7000`.  
   - Run: `cloudflared tunnel run match-engine`.  
   - In Cloudflare Dashboard → **Zero Trust** → **Tunnels** → **Public Hostname**, add a hostname (e.g. `engine.yourdomain.com`) that routes to your tunnel.  
   Use `https://engine.yourdomain.com` as `MATCH_ENGINE_URL`.

---

#### Step 6: Configure the backend (Render)

1. In **Render** → your backend service → **Environment**.
2. Set **`MATCH_ENGINE_URL`** to the URL you got from Step 5:  
   - Port forwarding: `http://YOUR_PUBLIC_IP_OR_DDNS:7000`  
   - ngrok: `https://xxxx.ngrok-free.app`  
   - Cloudflare: `https://xxxx.trycloudflare.com` or `https://engine.yourdomain.com`
3. **No trailing slash.** Use `http` or `https` to match what the engine is served over.
4. Save and redeploy the backend so it picks up the new value.

The backend will use this URL to call the match engine (e.g. provision match, cleanup, get infrastructure).

---

#### Step 7: Verify

1. **Local:** With the engine running, open in a browser:  
   `http://localhost:7000/engine/health`  
   You should get a healthy response (e.g. 200 and a JSON body).
2. **From the internet:** Use the **public** URL (the one you set as `MATCH_ENGINE_URL`):  
   `https://your-ngrok-or-cloudflare-url/engine/health`  
   Same response.
3. **Backend:** Trigger an action that uses the engine (e.g. start a match). Check backend logs and engine logs (`pm2 logs match-engine` if using PM2) for errors.

---

#### Troubleshooting (own server)

| Problem | What to check |
|---------|----------------|
| Engine won’t start | Docker running? (`docker ps`). Port 7000 free? (`netstat -an | findstr 7000` on Windows, `ss -tlnp | grep 7000` on Linux). |
| Backend can’t reach engine | Is the **public** URL (ngrok/Cloudflare/port-forward) correct and without trailing slash? Can you open `PUBLIC_URL/engine/health` in a browser from another network (e.g. phone off Wi‑Fi)? |
| “Docker not found” | Docker daemon must be running. On Windows, start Docker Desktop. On Linux, `sudo systemctl start docker`. |
| ngrok URL changed | Update `MATCH_ENGINE_URL` in Render and redeploy the backend. |
| Containers not created | Check engine logs; ensure `BACKEND_URL` is correct and the engine can reach the backend. Check Docker has enough resources (memory/disk). |

---

#### Full stack on one machine (optional)

If you want **frontend + backend + match engine** all on the same PC or home server:

- Run **backend** (e.g. `cd backend && npm start`), **match engine** (e.g. `cd match-engine && node src/engine.js` or PM2), and **frontend** (e.g. `cd frontend && npm run dev` or serve the built `dist/`).
- Set backend **`MATCH_ENGINE_URL`** to `http://localhost:7000`.
- Set frontend **`VITE_API_URL`** and **`VITE_SOCKET_URL`** to your backend URL (e.g. `http://localhost:3000`).
- Set backend **`CORS_ORIGIN`** to the frontend origin (e.g. `http://localhost:5173` for Vite dev).
- For **remote** players, expose frontend and backend (and optionally the engine) via port forwarding or a tunnel; then use the public URLs in the frontend env and CORS.

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
| **Match Engine** | Free VPS (Oracle Cloud Always Free) or **your own PC / home server** | Node + Docker, `.env` with `BACKEND_URL` + `FLAG_SECRET`, run with `pm2 start src/engine.js`. Use a tunnel (ngrok, Cloudflare) if the backend is in the cloud and your PC has no public IP. |

The match engine **must** run on a host with Docker (VPS or your own machine). Render only runs your Node app in a container; it does not give your app access to the Docker daemon to create match containers. **Oracle Cloud Always Free** gives you one or more VMs at no cost (no charges if you stay within Always Free limits). Alternatively, run the engine on **your own PC or home server** and expose it via port forwarding or a tunnel (see §2.6).
