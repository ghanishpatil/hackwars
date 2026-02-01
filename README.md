# CTF Platform - Attack & Defense Multiplayer Platform

A production-grade multiplayer Attack & Defense CTF (Capture The Flag) platform with clean service separation.

## 🏗️ Architecture Overview

The platform consists of three independent services:

### 1. **Frontend** (`frontend/`) — single app, role-based UI
- **Purpose**: One React app for both players and admins. After login, **role decides the experience**: players see home/queue/match/profile; admins can open the Admin portal (dashboard, matches, players, system).
- **Stack**: React + Vite + Tailwind CSS + Firebase Auth + Socket.IO client
- **Port**: 5173
- **Responsibilities**: Auth (Firebase); post-login redirect by role (admin claim); player flows (queue, match, profile); admin flows (Dashboard, Matches, Players, System) under `/admin` with `RequireAdmin`.

### 2. **Backend** (`backend/`)
- **Purpose**: Control plane
- **Stack**: Node.js + Express + Socket.IO + Firebase Admin SDK
- **Responsibilities**:
  - Authentication & authorization
  - Matchmaking queue management
  - Match metadata management
  - Real-time communication (Socket.IO)
  - Admin operations (future)

### 3. **Match Engine** (`match-engine/`)
- **Purpose**: Data plane
- **Stack**: Node.js + dockerode
- **Responsibilities**:
  - Docker container lifecycle management
  - Match infrastructure orchestration
  - Scoring calculations
  - Health monitoring & flag validation
  - Service uptime tracking

### Service Communication

```
Frontend (5173) ──HTTP/Socket.IO──► Backend (3000) ──HTTP──► Match Engine (7000)
```

- **Frontend** (single app) talks only to the backend. Backend CORS allows the frontend origin (default `http://localhost:5173`). Admin and player use the same origin; access is enforced by Firebase custom claim `admin` and `RequireAdmin` routes.
- **Backend ↔ Match Engine**: HTTP only (backend calls engine; engine not exposed to browsers).

## 📁 Repository Structure

```
├── frontend/          # Single UI (React + Vite) — port 5173; role-based (player + admin)
│   ├── src/pages/     # Home, Login, Queue, Profile, Match + admin/* (Dashboard, Matches, Players, System)
│   ├── src/components # Layout, AdminLayout
│   ├── src/hooks, socket, api, firebase
│   └── .env.example
│
├── backend/           # Express backend (control plane) — port 3000
│   ├── src/
│   │   ├── app.js     # Express app setup
│   │   ├── server.js  # Server entry point
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic services
│   │   ├── sockets/   # Socket.IO handlers
│   │   ├── middleware/# Express middleware
│   │   ├── firebase/  # Firebase Admin SDK
│   │   └── config/    # Configuration
│   └── .env.example
│
├── match-engine/      # Match engine (data plane)
│   ├── src/
│   │   ├── engine.js        # Engine entry point
│   │   ├── lifecycle/       # Match lifecycle management
│   │   ├── docker/          # Docker client
│   │   ├── scoring/         # Scoring logic
│   │   ├── health/          # Health monitoring
│   │   └── state/           # State management
│   └── .env.example
│
├── services/          # Vulnerable service templates (empty)
├── nginx/             # Reverse proxy configs
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Docker Desktop** (for match-engine, Windows) or **Docker** (Linux)
- **Firebase Project** (for authentication - credentials needed)

### Installation

#### 1. Backend

```bash
cd backend
npm install
# Create .env with PORT, CORS_ORIGINS (optional), Firebase Admin SDK vars, MATCH_ENGINE_URL
```

#### 2. Match Engine

```bash
cd match-engine
npm install
# Create .env with PORT=7000, FLAG_SECRET
```

#### 3. Frontend (single app: player + admin)

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000, VITE_SOCKET_URL=http://localhost:3000, Firebase client config
```

### Run the full platform (development)

Start in this order. Use **three terminals**.

| Order | Service           | Command           | URL                      |
|-------|-------------------|-------------------|--------------------------|
| 1     | Backend           | `cd backend; npm run dev`           | `http://localhost:3000`  |
| 2     | Match Engine      | `cd match-engine; npm run dev`       | `http://localhost:7000` (internal) |
| 3     | Frontend          | `cd frontend; npm run dev`           | **http://localhost:5173** |

- **Everyone** uses **http://localhost:5173**. Sign in with Firebase; **role decides the experience**:
  - **Players**: home, queue, match, profile (and an "Admin" link in the nav if they have the admin claim).
  - **Admins**: after login you are redirected to `/admin` (dashboard); you can also open Admin from the nav. Admin routes require Firebase custom claim `admin: true`.

Backend allows the frontend origin by default (`http://localhost:5173`). To override: set `CORS_ORIGIN` or `CORS_ORIGINS` in `backend/.env`.

#### Production

```bash
# Backend
cd backend; npm start

# Match Engine
cd match-engine; npm start

# Frontend (single static app)
cd frontend; npm run build; npm run preview
```

## 🔧 Configuration

### Environment Variables

Each service has its own `.env.example` file. Copy to `.env` and fill in:

#### Frontend (`frontend/.env`)
- `VITE_API_URL` - Backend API URL (e.g. `http://localhost:3000`)
- `VITE_SOCKET_URL` - Socket.IO server URL (same as backend)
- Firebase client config (same project as backend; admin users need custom claim `admin: true`)

#### Backend (`backend/.env`)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` or `CORS_ORIGINS` - Allowed origins (default: `http://localhost:5173` for the single frontend)
- `MATCH_ENGINE_URL` - Match engine URL (e.g. `http://localhost:7000`)
- Firebase Admin SDK credentials:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_STORAGE_BUCKET` (optional) - Storage bucket for landing mission image uploads. Use the bucket name from Firebase Console → Storage (new projects often use `{projectId}.firebasestorage.app`).

#### Match Engine (`match-engine/.env`)
- `PORT` - Engine port (default: 7000)
- `NODE_ENV` - Environment
- `MATCH_ENGINE_URL` - Used by backend (e.g. `http://localhost:7000`)
- `FLAG_SECRET` - Engine-only secret for flag generation (never expose)
- `MAX_CONCURRENT_MATCHES` - Cap (default 50)
- `MAX_CONTAINER_AGE_HOURS` - Safety cron removes older containers (default 4)
- `MAX_MATCH_DURATION_HOURS` - Safety cron ends matches older than this (default 3)
- `SAFETY_CRON_INTERVAL_MS` - Safety cron interval (default 45 min)

#### Backend hardening (`backend/.env`)
- `BODY_LIMIT` - Max request body size in bytes (default 100KB)
- `MAX_CONCURRENT_MATCHES` - Reject new match start when exceeded (default 50)
- `MAX_QUEUE_SIZE_PER_DIFFICULTY` - Reject queue join when full (default 200)
- `RATE_LIMIT_AUTH_MAX` - Auth requests per window (default 10)
- `RATE_LIMIT_QUEUE_MAX` - Queue requests per window (default 30)

### Firebase: Rules & Indexes

#### Firestore rules

The app uses **Firebase Admin SDK** on the backend only; the frontend does not read or write Firestore directly. To lock down client access, use the provided rules at the repo root:

- **`firestore.rules`** — denies all client read/write so only the backend (Admin SDK) can access Firestore. Deploy from the project root:

  ```bash
  firebase deploy --only firestore:rules
  ```

  If you manage rules in the Firebase Console instead, set: `match /{document=**} { allow read, write: if false; }` so the client SDK cannot access data.

#### Firestore indexes

Several **composite indexes** are required (queues, matches, teams, online_users, challenges). They are defined in **`firestore.indexes.json`** at the repo root.

- **matches** (match history): `teamA` (array-contains) + `createdAt` (desc), and `teamB` (array-contains) + `createdAt` (desc) — used by `GET /match/history`.
- **queues**: `players` (array-contains) + `status` (asc).
- **teams**, **online_users**, **challenges**: see `firestore.indexes.json`.

**Deploy indexes** (required after cloning or if you see "The query requires an index"):

1. At the repo root, link your Firebase project: `firebase use <project-id>` (e.g. `firebase use csbc-wg`).
2. Deploy indexes:

   ```bash
   firebase deploy --only firestore:indexes
   ```

   Indexes can take a few minutes to build. After they are green in the [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/), match history and other queries will work.

- **Option B — From Console**: If you skip deploy and run the app, Firestore will return an error with a **link to create the missing index**. Open the link, create the index, wait for it to build, then re-run.

#### Firebase Storage (landing mission images)

Admin landing image uploads use **Firebase Storage**. You must:

1. **Enable Storage** in [Firebase Console → Build → Storage](https://console.firebase.google.com/) → **Get started** (creates the default bucket).
2. In **backend `.env`**, set **`FIREBASE_STORAGE_BUCKET`** to the bucket name shown in the Storage UI (e.g. `csbc-wg.firebasestorage.app` for new projects, or `your-project.appspot.com` for legacy).
3. Deploy Storage rules so landing images are publicly readable:

   ```bash
   firebase deploy --only storage
   ```

---

## 🚀 Deployment checklist (hardening)

### Required ports

| Service       | Port | Expose to internet? |
|---------------|------|----------------------|
| NGINX         | 80, 443 | Yes (only NGINX)   |
| Backend       | 3000 | No (behind NGINX)    |
| Match Engine  | 7000 | **No** (backend only)|
| Frontend (dev)| 5173 | Optional (dev)       |

### Startup order

1. **NGINX** (if used): start first, proxies to backend only.
2. **Backend**: `cd backend && npm start` — must be up before frontend/admin.
3. **Match Engine**: `cd match-engine && npm start` — backend connects via `MATCH_ENGINE_URL`.

Engine must not be reachable from the public internet. Backend talks to engine on localhost or internal network only.

### What to monitor

- **Backend**: `/health` returns 200; request/error logs; admin actions in Firestore `admin_events`.
- **Match Engine**: `/health` returns 200; `[RECOVERY]` and `[SAFETY_CRON]` logs; no orphan containers/networks.
- **Firestore**: `users`, `queues`, `matches`, `admin_events` — no silent write failures.

### How to kill everything safely

1. **Maintenance mode**: Use admin portal → System → Enable maintenance. This stops new queue joins and match starts.
2. **Drain queues**: Admin → Drain all queues (optional).
3. **Stop backend**: `SIGTERM` or Ctrl+C — server closes gracefully.
4. **Stop match engine**: `SIGTERM` or Ctrl+C — in-flight matches will leave containers until next recovery (restart engine to run recovery and clean orphans).
5. **Restart engine** after crash: On boot, engine runs recovery (cleans orphans and lost-state matches), then starts safety cron.

### Security sanity

- **FLAG_SECRET**: Set in match-engine `.env` only; never log or expose in API.
- **Flags**: Never logged (engine only returns accepted/rejected).
- **Admin routes**: Double-guarded (Firebase auth + admin claim); all actions audited to `admin_events`.
- **Engine endpoints**: Not public; only backend (and admin via backend) should call engine.

---

## 🧪 Health Checks

### Backend Health Check
```bash
curl http://localhost:3000/health
```
Expected response: `{"status":"OK","service":"backend"}`

### Frontend
Open `http://localhost:5173` — should show the app (home when logged out; after login, players see home/queue/profile, admins are redirected to `/admin`).

### Match Engine
Check console output - should show "Match Engine initialized"

## 📋 Current Status

### ✅ Completed (Foundation Only)

- **Frontend**: React + Vite + Tailwind CSS setup with folder structure
- **Backend**: Express + Socket.IO + Firebase Admin SDK setup with routes scaffolding
- **Match Engine**: Docker client initialization and lifecycle structure
- **Configuration**: Environment variable templates for all services
- **Documentation**: Comprehensive README

### 🚧 Not Implemented (By Design)

- Authentication logic
- Matchmaking algorithms
- ELO rating system
- Docker container orchestration
- Scoring calculations
- Health monitoring
- Admin portal
- Real API endpoints
- Socket.IO event handlers
- Firebase queries
- Tests

## 🎯 Next Steps

1. **Authentication**: Implement Firebase Auth flow
2. **Matchmaking**: Build queue system and matching logic
3. **Match Lifecycle**: Implement Docker container management
4. **Scoring**: Build flag capture and service availability scoring
5. **Real-time**: Implement Socket.IO events
6. **Admin Portal**: Build admin interface
7. **Testing**: Add unit and integration tests

## 🔒 Security Notes

- Never commit `.env` files
- Keep Firebase credentials secure
- Use environment variables for all secrets
- Implement proper authentication before production

## 📝 Development Guidelines

- **No shortcuts**: Follow the established structure
- **Clean separation**: Keep services independent
- **Comments**: Code includes explanatory comments
- **Foundation first**: Build infrastructure before features

## 🤝 Contributing

This is a foundation setup. All business logic is intentionally not implemented to allow for proper architecture-first development.

## 📄 License

[Your License Here]
