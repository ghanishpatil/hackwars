# CTF Platform — Implementation Summary

This document describes **everything** that has been implemented in this Attack & Defense CTF platform, at a detailed level. No business logic is omitted; small aspects (middleware, env vars, UI states) are included.

---

## 1. Overview & Architecture

- **Three independent services:**
  - **Frontend** (React + Vite) — Player UI and Admin portal; single app, role-based routing.
  - **Backend** (Node.js, Express) — Control plane: auth, matchmaking, admin, metadata, Socket.IO.
  - **Match Engine** (Node.js, Express) — Data plane: Docker lifecycle, scoring, flag validation, health.
- **Auth & DB:** Firebase (Authentication + Firestore). All Firestore access is server-side via Firebase Admin SDK; client has no direct Firestore access.
- **Realtime:** Socket.IO (namespace `/match`) for match state and admin broadcast.
- **Styling:** Tailwind CSS; dark theme; neon-style variables in `globals.css`.
- **Infra placeholders:** `nginx/` (reverse proxy configs), `services/` (vulnerable service templates) exist as structure only.

---

## 2. Repository Structure

```
ctf-platform/
├── frontend/          # React + Vite + Tailwind
├── backend/           # Express + Socket.IO + Firebase Admin
├── match-engine/      # Engine HTTP API + Docker/scoring
├── services/          # .gitkeep (vulnerable service templates, empty)
├── nginx/             # nginx.conf + README (placeholder)
├── firestore.rules    # Deny all client; backend-only access
├── firestore.indexes.json
└── README.md
```

---

## 3. Backend (Control Plane)

### 3.1 Entry & Config

- **`server.js`** — Creates HTTP server, attaches Socket.IO to the same server, mounts Express app, calls `initializeSockets(io)`, stores `io` on `app.set('io', io)` for admin broadcast. Listens on `config.port` (default 3000).
- **`app.js`** — Express app: `cors`, `express.json` (body limit from config), `requestLogger`. Routes: `/health` → `{ status: 'OK', service: 'backend' }`; `/auth`, `/queue`, `/match`, `/admin`, `/api` (public), `/report`. 404 and error handlers.
- **`config/env.js`** — Loads `dotenv`. Exposes: `port`, `nodeEnv`, `bodyLimit` (default 100KB), `maxConcurrentMatches` (default 50), `maxQueueSizePerDifficulty` (default 200), `firebase` (projectId, privateKey, clientEmail), `cors` (origin array, credentials), `socket.cors`.
- **`config/ranks.js`** — Rank tiers for ELO: array of `{ name, min }` (Script Kiddie 0, Initiate 800, … Zero-Day 2100). `RP_MIN`, `RP_MAX` (0, 100).

### 3.2 Middleware

- **`authMiddleware.js`** — `authenticateUser`: reads `Authorization: Bearer <token>`, verifies Firebase ID token via `getAuth().verifyIdToken(token)`, sets `req.user = decodedToken`. 401 on missing/invalid token. `requireAuth` is an alias.
- **`adminGuard.js`** — Runs `authenticateUser` then loads role from Firestore via `getUserRole(uid)`. If role !== `'admin'`, responds 403 "Admin access required". Admin status is **only** from Firestore `users/{uid}.role`, not token claims.
- **`rateLimit.js`** — In-memory rate limiting. `authLimit`: strict, per IP (default 10 req/min). `queueLimit`: per user (or IP), default 30 req/min. `createRateLimiter({ maxRequests, windowMs, keyFn })`. Sends `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`; 429 on exceed. Cleanup interval for expired windows.
- **`requestLogger.js`** — Logs method, path, status code, and duration on response finish; logs ERROR for 5xx, WARN for 4xx, REQUEST for success. Used as app-level middleware.

### 3.3 Firebase

- **`firebase/firebaseAdmin.js`** — Initializes Firebase Admin from `config.firebase` (projectId, privateKey, clientEmail). Exports `getAuth()`, `getFirestore()`. If env missing, Firestore/Auth are null and operations fail gracefully or throw as documented.

### 3.4 Routes

#### Auth (`/auth`)

- **GET `/auth/me`** — `authenticateUser` → `getOrCreateUser(decodedToken)`. Returns: `uid`, `email`, `username`, `displayName`, `phone`, `institute`, `track`, `role`, `mmr`, `rank`, `rp`. If user is banned, `getOrCreateUser` throws `BANNED` → response 403 with `{ error, code: 'banned' }`.
- **PATCH `/auth/profile`** — `authenticateUser` → `updateUserProfile(decodedToken, { displayName, phone, institute, track })`. Responds `{ status: 'ok' }`.

#### Queue (`/queue`)

- **POST `/queue/join`** — Body: `{ difficulty, teamSize }`. Rejected if maintenance enabled. Calls `joinQueue(uid, { difficulty, teamSize })`; 400 if already queued, 503 if queue full. Returns `{ queued: true, queue }`.
- **POST `/queue/leave`** — `leaveQueue(uid)`. Returns `{ left }`.
- **GET `/queue/status`** — Returns `getQueueStatus(uid)`: `{ queued: boolean, difficulty?, teamSize?, queueId? }`.

#### Match (`/match`)

- **GET `/match/history`** — Authenticated. Returns recent matches for the current user (uid in `teamA` or `teamB`): merged from two Firestore queries (`array-contains` on teamA, teamB), sorted by `createdAt` desc, limit 20. Each item: `matchId`, `status`, `difficulty`, `createdAt`.
- **POST `/match/start`** — Body: `{ matchId }`. Rejected if maintenance. Checks `maxConcurrentMatches`; 503 if at cap. Loads match from Firestore, calls `engineClient.startMatch(...)`, sets match status to `starting`, calls `startMatchStateTracking(matchId, 'initializing')`. Returns `{ status: 'starting' }`. 502 on engine unavailable/timeout.
- **POST `/match/end`** — Body: `{ matchId }`. Calls `processMatchEnd(matchId)` (engine result, MMR/RP update). Returns `playerDelta` for the requesting user (oldRank, newRank, mmrDelta, rpDelta) or null if not in match. 400 if match not ended, 502 if result unavailable.

#### Public (`/api`)

- **GET `/api/announcement`** — No auth. Returns `getAnnouncement()`: `{ text, enabled }`. On error: `{ text: '', enabled: false }`.
- **GET `/api/feature-flags`** — No auth. Returns `getFeatureFlags()`: `queueEnabled`, `rankingsVisible`, `signupEnabled`. Defaults true on error.
- **GET `/api/leaderboard`** — No auth. Query `limit` (default 50, max 100). Returns `getPublicLeaderboard(limit)`: respects `rankingsVisible`; if false returns `[]`. Otherwise same leaderboard query as admin (users by mmr desc). On error returns `[]`.

#### Report (`/report`)

- **POST `/report`** — Authenticated. Body: `{ targetUid, reason }`. Calls `createReport(reporterUid, { targetUid, reason })`. Document in `reports` with `reporterUid`, `targetUid`, `reason`, `status: 'pending'`, `createdAt`. Returns `{ id }`.

#### Admin (`/admin`) — All routes use `adminGuard`.

- **Overview & matches:**  
  - **GET `/admin/overview`** — `getOverview(adminId)`: total users count, waiting queues size, active matches size, engine health. Audited.  
  - **GET `/admin/matches`** — `getMatches(adminId)`: list matches from Firestore (matchId, difficulty, status, teamA, teamB, invalid), orderBy createdAt desc, limit 100.  
  - **GET `/admin/match/:id`** — `getMatchDetail(adminId, id)`: Firestore match + engine status + result if ended.  
  - **POST `/admin/match/:id/stop`** — `stopMatchAdmin`: engine stop + Firestore status `stopped`.  
  - **POST `/admin/match/:id/invalid`** — `markMatchInvalid`: set match `invalid: true` (no rank update on end).
- **Players & users:**  
  - **GET `/admin/players`** — `getPlayers(adminId)`: list users with status (ACTIVE, IN_QUEUE, IN_MATCH, BANNED) derived from queues/matches.  
  - **GET `/admin/user/:uid`** — `getUserProfile(adminId, uid)`: full user document (including displayName, phone, institute, track, banned, shadowBan, mmr, rank, rp).  
  - **GET `/admin/user/:uid/activity`** — `getUserActivity(adminId, uid)`: lastLogin, lastActive, loginHistory (last 20), recentMatches (user in teamA/teamB), recentAdminEvents (targeting this uid).  
  - **POST `/admin/user/:uid/ban`** — Set user `banned: true`; audit.  
  - **POST `/admin/user/:uid/unban`** — Set `banned: false`.  
  - **DELETE `/admin/user/:uid`** — Delete Firestore user doc and Firebase Auth user; cannot delete self.  
  - **POST `/admin/user/:uid/shadow-ban`**, **shadow-unban** — Toggle `shadowBan`.  
  - **POST `/admin/user/:uid/reset-rank`** — Reset mmr/rank/rp to defaults.  
  - **POST `/admin/user/:uid/achievements`** — Body `{ achievementId }`. `assignAchievement(adminId, uid, achievementId)`: add to `user_achievements`.
- **System controls:**  
  - **POST `/admin/system/matchmaking/disable`** — Set system config matchmaking disabled.  
  - **POST `/admin/system/matchmaking/enable`** — Re-enable.  
  - **POST `/admin/system/queues/drain`** — Remove all waiting queue entries.  
  - **POST `/admin/system/engine/restart`** — Logical restart (no OS process).  
  - **POST `/admin/system/maintenance/enable`**, **disable** — Global kill switch.
- **Announcement:**  
  - **GET `/admin/announcement`** — Same as public.  
  - **PATCH `/admin/announcement`** — Body `{ text, enabled }`. `setAnnouncement(adminId, body)`; audit.
- **Audit & leaderboard:**  
  - **GET `/admin/audit`** — Query params: `limit`, `action`, `target`. `getAuditLog(adminId, params)`: read `admin_events`, filter, sort by timestamp desc.  
  - **GET `/admin/leaderboard`** — Query `limit`. `getLeaderboard(adminId, limit)` (audited).  
  - **GET `/admin/stats`** — `getStats(adminId)`: totalUsers, activeQueues, activeMatches, matchesToday, engineHealth. Audited.
- **Bulk & export:**  
  - **POST `/admin/users/bulk-ban`** — Body `{ uids }`. `bulkBanUsers(adminId, uids)`.  
  - **POST `/admin/users/bulk-unban`** — `bulkUnbanUsers`.  
  - **GET `/admin/export/users`** — Query `format=json|csv`. `exportUsers`; CSV: header row + rows.  
  - **GET `/admin/export/matches`** — Query `format`, `limit`. Same pattern.  
  - **GET `/admin/export/audit`** — Query `format`, `limit`. Same pattern.
- **Feature flags:**  
  - **GET `/admin/feature-flags`** — Same as public (for admin UI).  
  - **PATCH `/admin/feature-flags`** — Body `{ queueEnabled?, rankingsVisible?, signupEnabled? }`. `setFeatureFlags(adminId, body)`; audit.
- **Rank tiers:**  
  - **GET `/admin/rank-tiers`** — `getRankTiers()`: read `system_config/rank_tiers`.  
  - **PUT `/admin/rank-tiers`** — Body `{ tiers }` or array. `setRankTiers(adminId, tiers)`; audit.
- **Reports:**  
  - **GET `/admin/reports`** — Query `status`. `getReports(adminId, status)`.  
  - **POST `/admin/reports/:id/dismiss`** — `dismissReport(adminId, id)`: status → dismissed, resolvedBy, resolvedAt.  
  - **POST `/admin/reports/:id/action`** — Body `{ action }` (e.g. 'ban'). `actionReport`: status → actioned; if action ban, set target user `banned: true`. Audited.
- **Seasons:**  
  - **GET `/admin/seasons`** — `getSeasons(adminId)`.  
  - **POST `/admin/seasons`** — Body `{ name, startAt?, endAt? }`. `createSeason(adminId, body)`.  
  - **PATCH `/admin/seasons/:id/current`** — `setCurrentSeason(adminId, id)`: batch update all seasons so only this one has `isCurrent: true`.
- **Achievements:**  
  - **GET `/admin/achievements`** — `getAchievements(adminId)`.  
  - **POST `/admin/achievements`** — Body `{ name, description, criteria, icon? }`. `createAchievement(adminId, body)`.  
  - **POST `/admin/user/:uid/achievements`** — See above.
- **Custom match:**  
  - **POST `/admin/match/create`** — Body `{ teamA, teamB, difficulty }`. `createCustomMatch(adminId, body)`: create match doc in Firestore with status pending, custom true. Audited.
- **Difficulty presets:**  
  - **GET `/admin/difficulty-presets`** — `getDifficultyPresets()`.  
  - **PUT `/admin/difficulty-presets`** — Body array or `{ presets }`. `setDifficultyPresets(adminId, presets)`; audit.
- **Maintenance countdown:**  
  - **GET `/admin/maintenance/config`** — `getMaintenanceConfig()`: `enabled`, `endTime`.  
  - **PATCH `/admin/maintenance/end-time`** — Body `{ endTime }` (ISO string or null). `setMaintenanceEndTime(adminId, endTime)`.
- **Broadcast:**  
  - **POST `/admin/broadcast`** — Body `{ message }`. Gets `io` from `app.get('io')`, emits `admin_broadcast` on `io.of('/match')` with `{ message, from: adminId }`. Writes audit event. Returns `{ sent: true }`.

### 3.5 Services

- **`userService.js`** — `deriveUsername(decodedToken)` (displayName/email/uid → lowercase, alphanumeric + underscore). `getOrCreateUser(decodedToken)`: if user doc missing, create with uid, email, username, displayName, phone, institute, track, role user, mmr 1000, rank Initiate, rp 0, createdAt, lastLogin, lastActive; if exists and `banned`, throw BANNED; else update lastLogin, lastActive, append to loginHistory (keep last 20). Returns profile fields. `updateUserProfile(decodedToken, body)`: update displayName, phone, institute, track (and lastLogin); create user if not exists. `getUserRole(uid)`: read users doc, return 'admin' or 'user'.
- **`queueService.js`** — Join/leave queue; queue keyed by difficulty+teamSize; Firestore `queues`; max queue size from config; on join triggers `attemptMatch` (matchmaking).
- **`matchmaking.js`** — `attemptMatch`: when enough players in a queue, create match doc (teamA, teamB, difficulty, teamSize, status pending), remove players from queue, return matchId.
- **`matchResult.js`** — `processMatchEnd(matchId)`: ensure match ended via engine, fetch result, compute MMR deltas (elo), update rank/RP (rank tiers from config or Firestore), persist in transaction; return playerDeltas map.
- **`elo.js`** — K-factor, expected score, MMR delta calculation; `updateRankAndRP` using rank tiers (from Firestore `rank_tiers` or default config).
- **`matchStateService.js`** — Registers Socket.IO server. `startMatchStateTracking(matchId, initialState)`: one polling loop per match (interval 3s), calls `getMatchStatus(matchId)` (engine), maps engine state to client state (initializing | running | ended), emits `match_state` to room `match:${matchId}` only on change; stops polling when ended. `stopMatchStateTracking(matchId)`.
- **`engineClient.js`** — HTTP client to match-engine base URL (env). `startMatch(body)`, `stopMatch(matchId)`, `getMatchStatus(matchId)`, `getMatchResult(matchId)`, `getEngineHealth()`. Timeouts and error codes (e.g. ENGINE_UNAVAILABLE).
- **`maintenance.js`** — `isMaintenanceEnabled()`: read `system_config/maintenance` (or similar) from Firestore; returns boolean.
- **`adminService.js`** — Implements getOverview, getMatches, getMatchDetail, stopMatchAdmin, markMatchInvalid, getPlayers (with status), getUserProfile, getUserActivity, banUser, unbanUser, deleteUser (Firestore + Auth), shadowBan/Unban, resetUserRank, disableMatchmaking, enableMatchmaking, drainQueues, restartEngineWorkers, enableMaintenance, disableMaintenance. All audit to `admin_events`.
- **`adminFeaturesService.js`** — Implements: getAnnouncement, setAnnouncement; getAuditLog, getLeaderboard, getPublicLeaderboard (respects rankingsVisible), getStats; bulkBanUsers, bulkUnbanUsers; exportUsers, exportMatches, exportAudit (return arrays for JSON/CSV); getFeatureFlags, setFeatureFlags; getRankTiers, setRankTiers; createReport, getReports, dismissReport, actionReport; getSeasons, createSeason, setCurrentSeason; getAchievements, createAchievement, assignAchievement; createCustomMatch; getDifficultyPresets, setDifficultyPresets; getMaintenanceConfig, setMaintenanceEndTime. Also `auditEvent(firestore, adminId, action, target, metadata)` for writing to `admin_events`.

### 3.6 Sockets

- **`sockets/index.js`** — `initializeSockets(io)`: registers io with matchStateService. Namespace `/match`: middleware verifies Firebase ID token from `socket.handshake.auth.token` or `Authorization` header, sets `socket.user`. On `join_match`, payload `{ matchId }`: verify user is in match (teamA or teamB in Firestore), then `socket.join('match:' + matchId)`. Logs connect/disconnect.

---

## 4. Frontend

### 4.1 App & Routing

- **`App.jsx`** — `BrowserRouter`, `Routes`. `RequireAuth`: if loading show "Loading…"; if !user redirect to `/login`; else render children. `RequireAdmin`: same + if !isAdmin redirect to `/dashboard`. Layout route `/`: `Layout` with `Outlet`. Child routes: index `Landing`, `login`, `signup`, `dashboard` (RequireAuth), `queue`, `profile`, `match/:matchId`, `rankings`. Admin route `/admin`: `RequireAdmin`, `AdminLayout`, children: index `AdminDashboard`, `matches`, `matches/:matchId`, `players`, `activity`, `audit`, `reports`, `system`. Catch-all `Navigate to="/"`.
- **`Layout.jsx`** — If user and pathname `/`, redirect to `/admin` (if isAdmin) or `/dashboard`. Renders: `AnnouncementBanner`; if `broadcastMessage` (from socket `admin_broadcast`) a sticky dismissible banner; `Navbar`; main with `Outlet`. Subscribes to `onAdminBroadcast` when user exists; cleanup `offAdminBroadcast`.

### 4.2 API Client

- **`api/client.js`** — `BASE` from `VITE_API_URL` or localhost:3000. `token` (module-level). `setApiToken(t)`, `clearApiToken()`. `request(path, options)`: JSON, Bearer if token, throws on !res.ok with error message and status. `requestPublic(path)`: no auth. `requestText(path, options)`: same auth as request, returns response text (for CSV export). **Player API:** getMe, updateProfile, getQueueStatus, joinQueue, leaveQueue, startMatch, endMatch, getAnnouncement, getFeatureFlags, getLeaderboard(limit), getMatchHistory, report(body). **Admin API:** getOverview, getMatches, getMatch, stopMatch, markMatchInvalid, getPlayers, getUser, getUserActivity, banUser, unbanUser, deleteUser, shadowBanUser, shadowUnbanUser, resetUserRank; disableMatchmaking, enableMatchmaking, drainQueues, restartEngine; enableMaintenance, disableMaintenance; getAnnouncement, setAnnouncement; getAuditLog, getLeaderboard, getStats; bulkBanUsers, bulkUnbanUsers; exportUsers, exportMatches, exportAudit (format, limit); exportUsersCsv, exportMatchesCsv, exportAuditCsv; getFeatureFlags, setFeatureFlags; getRankTiers, setRankTiers; getReports, dismissReport, actionReport; getSeasons, createSeason, setCurrentSeason; getAchievements, createAchievement, assignAchievement; createCustomMatch; getDifficultyPresets, setDifficultyPresets; getMaintenanceConfig, setMaintenanceEndTime; broadcast(message).

### 4.3 Auth & Socket

- **`hooks/useAuth.js`** — `onAuthStateChanged(auth, ...)`: if no user, clear token, disconnect match socket, setUser null, isAdmin false. If user, getIdToken, setApiToken, connectMatchSocket(idToken), then api.getMe(): on success set user (uid, email, username, displayName, phone, institute, track, role, mmr, rank, rp) and isAdmin = (role === 'admin'). On 403 with code 'banned', set bannedMessage, signOut, clear user. signIn(email, password), signUp(email, password), signOut (clear token, disconnect socket). Returns user, isAdmin, loading, bannedMessage, clearBannedMessage, signIn, signUp, signOut, auth.
- **`socket/socket.ts`** — Single socket to `${VITE_SOCKET_URL}/match` with auth `{ token: idToken }`. `connectMatchSocket(idToken)`, `disconnectMatchSocket()`. `joinMatch(matchId)` emits `join_match`; `onMatchState(cb)` / `offMatchState(cb)` for `match_state`; `onAdminBroadcast(cb)` / `offAdminBroadcast(cb)` for `admin_broadcast` (payload `{ message, from? }`).

### 4.4 Firebase (Frontend)

- **`firebase/config.js`** — Initialize Firebase app from env (VITE_FIREBASE_*). Export `auth` (getAuth()).

### 4.5 Components

- **`AnnouncementBanner`** — Fetches `api.getAnnouncement()` on mount. If enabled and text non-empty and not dismissed, shows banner with text and dismiss (×) button. Dismiss state is local (no API).
- **`Navbar`** — Links: Home, Dashboard, Queue, Rankings, Profile; if admin, link to /admin; Sign out. Uses useAuth.
- **`NeonCard`** — Wrapper with border/glow (e.g. glow="cyan"), used across player and admin pages.
- **`AnimatedButton`** — Button with variants (e.g. green, red, ghost), used for primary actions.
- **`ConfirmationModal`** — Modal with title, message, confirm/cancel; optional danger styling.
- **`Layout`** — See above (includes announcement, broadcast banner, navbar, outlet).
- **`AdminLayout`** — Wraps admin routes; typically includes AdminHeader, AdminNav (tabs), outlet.
- **`AdminHeader`** — Admin header bar (e.g. title, user).
- **`AdminNav`** — Tabs/links: Dashboard, Matches, Players, User Activity, Audit, Reports, System.
- **`Sidebar`** — Optional sidebar for admin.
- **`GlitchText`**, **`LogoAnimation`** — Decorative/styled text and logo (e.g. landing).
- **`Layout`** (player) — Redirect logic, announcement, broadcast banner, navbar, main.

### 4.6 Pages (Player)

- **`Landing`** — Public landing (e.g. GlitchText, CTA to login/signup).
- **`Login`** — Email/password inputs; on submit Firebase signInWithEmailAndPassword, then setApiToken, then api.getMe(); on 403 banned show bannedMessage; on success navigate by role (admin → /admin, else /dashboard). Error state shown.
- **`Signup`** — Fields: full name (displayName), email, password, phone, institute, track/specialization. createUserWithEmailAndPassword, then setApiToken, then api.updateProfile({ displayName, phone, institute, track }), then navigate.
- **`Home`** — If path is "/" and user, Layout redirects; so Home may show when not at "/". Fetches api.getMe() and api.getQueueStatus(); shows profile summary and queue status or "Find match" CTA.
- **`Dashboard`** — RequireAuth. Fetches api.getMe() and api.getMatchHistory() on mount; 30s polling for both. Shows: welcome + displayName; rank card (rank, mmr, rp, progress bar); "Find match" link to /queue; recent matches list (matchId, status, link to match if running); system feed blurb (live events on match page).
- **`Queue`** — RequireAuth. getQueueStatus; if queued shows difficulty, teamSize, "Leave queue" (leaveQueue). If not queued, form: difficulty, teamSize, "Join queue" (joinQueue). After join or when matched, UI updates (and can redirect to match when matchId is available if wired).
- **`Profile`** — RequireAuth. getMe(); shows avatar (initial), displayName, track, email, phone, institute, track, rank, mmr, rp. "Report a player" button opens modal: targetUid, reason; submit api.report({ targetUid, reason }); success/error message.
- **`Match`** — RequireAuth, param matchId. On mount joinMatch(matchId), onMatchState(handler) to set matchState (initializing | running | ended). Displays matchId (truncated), state badge. Two cards: Attack score 0, Defense score 0 (real default; engine scores can be wired later). Event feed blurb: "Live events…" / "Match ended" / "Waiting for match state…".
- **`Rankings`** — Fetches api.getFeatureFlags() and api.getLeaderboard(50). If !rankingsVisible, shows "Rankings are currently hidden". Else table: #, Player (displayName or email), Rank, MMR, Progress bar. Empty state "No players yet". Polling every 30s.

### 4.7 Admin Pages

- **`AdminDashboard`** — Fetches getOverview(), getStats(), getLeaderboard(10). Shows system health (backend, engine), overview counts (users, queues, matches), matches today, leaderboard snapshot (top 10), engine status.
- **`AdminMatches`** — Fetches adminApi.getMatches(); table: matchId, difficulty, status, teamA size, teamB size, "View" link. Refresh button. Loading and error states.
- **`AdminMatchDetail`** — Param matchId. Fetches adminApi.getMatch(matchId). Shows status, engineState, difficulty, teamSize, invalid, result (if any). Buttons: Force stop match (stopMatch), Mark match invalid (markMatchInvalid). Back to matches.
- **`AdminPlayers`** — getPlayers(); table: user (avatar, displayName, rank, track), contact (email, phone), institute, role, status (ACTIVE/IN_QUEUE/IN_MATCH/BANNED). Checkbox bulk select; "Ban selected", "Unban selected" (bulkBanUsers, bulkUnbanUsers). Per-row View opens modal: getUser(uid), show full profile; actions: Ban, Unban, Delete (with confirm).
- **`AdminUserActivity`** — getPlayers() for list; summary bar (total, active now, banned). Table: user (avatar, name, email), last login, last active, status. "Detailed history" opens modal: getUserActivity(uid) → lastLogin, lastActive, login history (last 10), recent matches, recent admin events. "Manage Users" link to /admin/players.
- **`AdminAudit`** — getAuditLog({ limit, action, target }). Filters: action, target. Table: timestamp, adminId, action, target, metadata. Search/filter UI.
- **`AdminReports`** — getReports(statusFilter): pending | dismissed | actioned. List: reporter, target, reason, status, createdAt. Actions: Dismiss, Ban target (actionReport with 'ban').
- **`AdminSystem`** — Multiple sections: (1) System health: getOverview() for backend/engine status, refresh button, 10s polling. (2) Maintenance: Enable (with confirmation modal → enableMaintenance), Disable (disableMaintenance). (3) Matchmaking: Disable / Enable. (4) Queues: Drain all. (5) Engine: Restart. (6) Global announcement: text input, enabled checkbox, Save (setAnnouncement). (7) Feature flags: queueEnabled, rankingsVisible, signupEnabled checkboxes, Save (setFeatureFlags). (8) Export: Users JSON/CSV, Matches JSON/CSV, Audit JSON/CSV (download via requestText for CSV). (9) Broadcast: message input, Send (broadcast). (10) Maintenance end time: datetime-local, PATCH end-time. (11) Rank tiers: list with name/min inputs, Add tier, Remove, Save tiers (setRankTiers). (12) Seasons: list with "Set as current" per season, Create season (createSeason). (13) Achievements: list; Create achievement; Assign to user (uid input + achievement dropdown + Assign). (14) Difficulty presets: list with name, difficulty, teamSize; Add preset, Remove, Save presets (setDifficultyPresets). (15) Custom match: teamA UIDs, teamB UIDs (comma-separated), difficulty select; Create custom match (createCustomMatch).

### 4.8 Styles

- **`styles/globals.css`** / **`index.css`** — Tailwind base; CSS variables for theme: bg-primary, bg-secondary, text-primary, text-muted, border, neon-cyan, neon-red, neon-green, neon-amber, neon-purple, etc. Dark theme. Grid/cyber background class.

### 4.9 Data

- **`data/mock.js`** — Static mock data (MOCK_USER, MOCK_RANKINGS, MOCK_MATCH, etc.). Not used by any live page; kept for reference or tests.

---

## 5. Match Engine (Data Plane)

- **`engine.js`** — Express server (default port 7000). Middleware: JSON body limit 50KB; in-memory flag submission rate limit per matchId:teamId (default 30/min). Routes: **GET /health** → { status: 'ok', service: 'match-engine' }. **POST /engine/match/start**: body matchId, difficulty, teamSize, teamA, teamB; validates; checks MAX_CONCURRENT_MATCHES; createMatch (stateStore), transitionToInitializing (matchLifecycle). **GET /engine/match/:matchId/status**: returns current state from stateStore. **POST /engine/match/:matchId/stop**: transitionToEnded. **POST /engine/flag/submit**: flagRateLimit middleware; validateFlag, recordFlagCapture, onFlagCaptured (scorer). **GET /engine/match/:matchId/result**: getMatchResult (scores, winner). Recovery and safetyCron started on boot.
- **`state/stateStore.js`** — In-memory (or persistent) store: createMatch, getMatch, getCurrentTick, recordFlagCapture, isFlagCaptured, getAllMatches, getMatchResult. Match state: CREATED | INITIALIZING | RUNNING | ENDING | ENDED.
- **`lifecycle/matchLifecycle.js`** — State machine: transitionToInitializing, transitionToEnded; timers and transitions (e.g. to RUNNING, ENDING). Described in comments.
- **`lifecycle/recovery.js`** — runRecovery: reconcile stuck matches (e.g. with backend or state).
- **`lifecycle/safetyCron.js`** — startSafetyCron: periodic cleanup or safety checks.
- **`docker/dockerClient.js`** — Dockerode client; initialize (no containers created in scaffold). Used by lifecycle for starting/stopping game containers.
- **`docker/networkManager.js`** — Network isolation for match containers (if implemented).
- **`flags/flagManager.js`** — validateFlag(matchId, teamId, flagPayload): check flag secret, prevent double-submit; FLAG_SECRET from env, never logged.
- **`scoring/scorer.js`** — onFlagCaptured(matchId, teamId, serviceId?): update scores in stateStore; compute per-service or aggregate.
- **`health/gamebot.js`** — Health-check bot or endpoint for game services (placeholder or minimal).
- **Env:** PORT, MAX_CONCURRENT_MATCHES, FLAG_SUBMIT_RATE_MAX, Docker/network vars; .env.example in match-engine.

---

## 6. Firestore

### 6.1 Rules

- **`firestore.rules`** — rules_version 2; match /databases/{database}/documents/{document=**} allow read, write: if false;. So all client access denied; only backend (Admin SDK) can read/write.

### 6.2 Indexes

- **`firestore.indexes.json`** — Composite indexes: (1) queues: players (array-contains), status (asc). (2) admin_events: target (asc), timestamp (desc). (3) matches: teamA (array-contains), createdAt (desc). (4) matches: teamB (array-contains), createdAt (desc).

### 6.3 Collections (Logical)

- **users** — uid, email, username, displayName, phone, institute, track, role, mmr, rank, rp, banned, shadowBan, createdAt, lastLogin, lastActive, loginHistory (array of timestamps).
- **queues** — keyed by difficulty+teamSize; players[], status.
- **matches** — matchId, teamA[], teamB[], difficulty, teamSize, status, invalid, custom, createdAt, etc.
- **admin_events** — adminId, action, target, metadata, timestamp.
- **system_config** — docs: announcement (text, enabled), feature_flags (queueEnabled, rankingsVisible, signupEnabled), rank_tiers (tiers[]), difficulty_presets (presets[]), maintenance (enabled, endTime).
- **reports** — reporterUid, targetUid, reason, status, createdAt, resolvedAt, resolvedBy, action.
- **seasons** — name, startAt, endAt, isCurrent, createdAt.
- **achievements** — name, description, criteria, icon, createdAt.
- **user_achievements** — uid, achievementId, assignedBy, assignedAt.

---

## 7. Environment & Config Files

- **Backend:** `.env` / `.env.example` — PORT, NODE_ENV, FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, CORS_ORIGIN(S), BODY_LIMIT, MAX_CONCURRENT_MATCHES, MAX_QUEUE_SIZE_PER_DIFFICULTY, RATE_LIMIT_AUTH_MAX, RATE_LIMIT_QUEUE_MAX, MATCH_ENGINE_URL (for engineClient).
- **Frontend:** `.env` / `.env.example` — VITE_API_URL, VITE_SOCKET_URL, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, etc.
- **Match-engine:** `.env` / `.env.example` — PORT, MAX_CONCURRENT_MATCHES, FLAG_SUBMIT_RATE_MAX, FLAG_SECRET, Docker-related vars.

---

## 8. Nginx & Services

- **`nginx/`** — nginx.conf and README as placeholder for reverse proxy (frontend, backend, engine); no logic implemented.
- **`services/`** — Directory for vulnerable service templates; .gitkeep only.

---

## 9. Small Details (Misc)

- **Backend:** All admin routes return JSON; errors use appropriate status codes (400, 401, 403, 404, 429, 500, 502, 503). Audit events include adminId, action, target, metadata, timestamp.
- **Frontend:** Loading states ("Loading…") and error states (NeonCard with error message) on data-fetch pages. Empty states ("No players yet", "No matches yet", etc.). Polling: Dashboard and Rankings 30s; AdminSystem health 10s.
- **Socket:** Match namespace auth via Firebase token; join_match only allows participants of that match; match_state and admin_broadcast are the only server-emitted events documented here.
- **Rank tiers:** Stored in Firestore `system_config/rank_tiers`; used by ELO and profile display; default set in config/ranks.js.
- **Banned users:** Checked in getOrCreateUser; 403 on /auth/me; frontend shows bannedMessage and signs out.
- **Maintenance:** When enabled, queue join and match start are rejected (503) with a message.
- **Export CSV:** Backend returns text/csv with header row; frontend uses requestText and Blob download with appropriate filename (date in name).
- **Report flow:** Player submits via POST /report; admin sees in Reports, can Dismiss or Action (e.g. ban target); actionReport updates report status and optionally user.banned.

This document is the single source of truth for what has been implemented in this platform as of the last update.
