# TEAM FORMATION + MATCHMAKING ENHANCEMENT SPECIFICATION

## 🎯 OBJECTIVE

Add team-based matchmaking, online presence tracking, and direct challenge system to the existing CTF platform WITHOUT modifying existing queue/match functionality.

---

## 1. COMPLETE USER FLOW

### Current System:
```
Login → Dashboard → Queue Join → Automated Match → Live Game
```

### New System:
```
Login → Team Setup Screen → Matchmaking Hub → {Normal Queue OR Direct Challenge} → Live Game
        ↓ (optional)              ↓
    Form/Join Team         See Online Players/Teams
                          Challenge Specific Opponents
```

---

## 2. TEAM FORMATION FEATURE

### When It Appears:
Immediately after successful login, if user has never created/joined a team and hasn't chosen to skip.

### Three Options Presented:

**CREATE TEAM:**
- Input: Team name (validate: 3-20 chars, alphanumeric only, must be unique across platform)
- Input: Maximum team size (radio buttons: 2, 3, or 4)
- Action: Generate 6-character alphanumeric invite code (format: ABCDEF, all uppercase, must be unique)
- Result: User becomes team leader, shown invite code in modal, redirected to matchmaking hub
- Store: Team in database with leader ID, members array, invite code, creation timestamp

**JOIN TEAM:**
- Input: 6-character invite code
- Validation: Code exists, team not full, user not already in another team
- Action: Add user to team's members array, recalculate team average MMR
- Result: Show team roster, redirected to matchmaking hub
- Update: User record with current team ID

**SKIP (PLAY SOLO):**
- Action: Set flag in localStorage that user chose solo
- Result: Never show team setup again, redirect to matchmaking hub
- Note: User can still create/join team later from settings

### Team Management Rules:

**Leadership:**
- Creator is initial leader
- If leader leaves: Transfer to next oldest member automatically
- If leader leaves and no members remain: Team disbanded (soft delete, set isActive = false)

**Membership:**
- Maximum size defined at creation (2, 3, or 4)
- Cannot join if team full
- Cannot join if already in another team (must leave first)
- Each member has: uid, username, MMR, joined timestamp

**Team Properties:**
- Team name (unique, immutable after creation)
- Invite code (unique, permanent)
- Average MMR (recalculated whenever member joins/leaves)
- Member count (1 to max size)
- Active status (true/false, false = disbanded)

**Leave/Disband:**
- Any member can leave anytime
- Leader can disband entire team (kicks all members, marks inactive)
- Leaving updates: Remove from team members, clear currentTeamId from user, recalculate team average MMR

---

## 3. MATCHMAKING HUB (NEW CENTRAL PAGE)

### Purpose:
Single page where players configure match settings, see online opponents, and either queue normally or send direct challenges.

### Layout Sections:

**LEFT PANEL - Match Settings:**

1. Mode Selector (Radio Buttons):
   - Solo (user not in team, or chooses to queue alone)
   - Team (user must be in team, entire team queues together)

2. Difficulty Selector (Radio Buttons):
   - Beginner
   - Advanced  
   - Expert

3. Team Size Selector (Toggle Buttons):
   - 1v1, 2v2, 3v3, 4v4
   - Only show sizes <= current team size if in team mode
   - If solo mode, only 1v1 available

4. Match Info Display:
   - Estimated MMR gain/loss range (calculate based on difficulty and current MMR)
   - Estimated wait time (based on current queue size)
   - Match duration (30 minutes standard)
   - Number of services (5 per team)

5. Action Buttons:
   - "ENTER QUEUE" → Joins normal matchmaking queue (ELO-based)
   - "CANCEL QUEUE" → Leaves queue (only shown when queued)
   - Queue status indicator: "Searching for match..." with timer when active

**RIGHT PANEL - Online Players/Teams:**

Purpose: Show all online players/teams that can be challenged

Display When Solo Mode Selected:
- List all online solo players
- Each entry shows: Username, Current rank, MMR, "Online" indicator
- Filter by MMR range: ±200, ±500, or Any (dropdown)
- Exclude: Players in queue, players in active match, self
- Sort by: MMR similarity to current user
- "Challenge" button on each entry

Display When Team Mode Selected:
- List all online teams
- Each entry shows: Team name, Member count (e.g. "3/4"), Average MMR, "Online" indicator
- Filter by MMR range: ±200, ±500, or Any
- Exclude: Teams in queue, teams in active match, own team
- Sort by: Average MMR similarity
- "Challenge" button on each entry

**TOP BAR - User/Team Info:**
- If solo: Show username, rank badge, MMR
- If in team: Show team name, role (Leader/Member), team average MMR, member count
- "Leave Team" button if in team
- Online count: "247 players online" (updated real-time)

### Real-Time Updates:

**Every 30 seconds:**
- Send heartbeat to server (keep user marked as online)
- Update current page location (matchmaking, match, offline)

**Every 10 seconds:**
- Refresh online players/teams list
- Update queue status

**Instant via WebSocket:**
- New challenge received → Show modal
- Challenge accepted → Redirect to match
- Match found from queue → Redirect to match
- Online count changes → Update counter

---

## 4. ONLINE PRESENCE SYSTEM

### Heartbeat Mechanism:

**Client Side:**
- Every 30 seconds: POST to /presence/heartbeat with currentPage ('matchmaking', 'match', 'dashboard')
- Stops when: User closes tab, navigates away, logs out

**Server Side:**
- Update user's lastHeartbeat timestamp in online_users collection
- Update onlineStatus object in users collection
- Mark isOnline = true
- Store currentPage value

**Cleanup:**
- Every heartbeat request: Delete online_users entries where lastHeartbeat > 2 minutes ago
- These users considered offline

### Online Status Data:

For each online user, store and display:
- User ID and username
- Current MMR and rank
- Team ID and team name (if in team, null if solo)
- Is in queue (boolean)
- Is in active match (boolean)
- Last heartbeat timestamp

### Visibility Rules:

Show in online list ONLY if:
- lastHeartbeat within last 2 minutes
- NOT currently in queue
- NOT currently in active match
- NOT the current user viewing the list

Filter by MMR range if selected (±200 or ±500 from viewer's MMR)

---

## 5. CHALLENGE SYSTEM

### What It Is:
Direct invite to play a match immediately, bypassing the normal queue. Think "friendly match" or "callout".

### Sending a Challenge:

**From Matchmaking Hub:**
- Click "Challenge" button next to any online player/team
- System validates:
  - Target is still online
  - Target not in queue or match
  - Challenger not in queue or match
  - If team challenge: Both teams have compatible size for selected teamSize

**Challenge Data Created:**
- Unique challenge ID
- From: Challenger ID, type (solo/team), display name
- To: Target ID, type (solo/team), display name  
- Match settings: Difficulty, team size
- Status: pending, accepted, declined, or expired
- Created timestamp
- Expires timestamp (created + 2 minutes)

**Notifications:**
- Target receives instant WebSocket notification
- Target sees modal pop-up with challenge details
- Challenger sees "Challenge sent!" confirmation

### Receiving a Challenge:

**Modal Shows:**
- Who sent it: "Player_47 challenges you!" or "Team Alpha challenges you!"
- Match details: Difficulty, team size (2v2, 3v3, etc.)
- Countdown timer: "1:45 remaining"
- Two buttons: "Accept" or "Decline"

**Actions:**

If ACCEPT:
- Create match immediately (status: created)
- Set match type as 'challenge' (not 'ranked')
- Both parties redirected to match page
- Match does NOT affect MMR/rank (optional: make this configurable)
- Challenge status → accepted
- Notify challenger: "Challenge accepted! Starting match..."

If DECLINE:
- Challenge status → declined
- Notify challenger: "Player_47 declined your challenge"
- Modal closes, return to matchmaking hub

If TIMEOUT (2 minutes):
- Auto-decline
- Challenge status → expired
- Notify challenger: "Challenge expired"
- Modal closes automatically

### Challenge Rules:

**Limitations:**
- Cannot challenge someone already in queue
- Cannot challenge someone already in match
- Cannot send multiple challenges to same target (cooldown: 1 minute after previous challenge resolved)
- Maximum 3 pending outgoing challenges at once per user/team

**Team Challenges:**
- Only team leader can send team challenges
- Only team leader can accept/decline incoming team challenges
- All team members see notification but only leader can respond
- If team disbands while challenge pending: Auto-decline all challenges

**Match Creation from Challenge:**
- Skip queue entirely
- Match created with status 'created' (not 'provisioning')
- Both teams added to match roster
- Match type marked as 'challenge'
- Standard match flow begins (engine provisioning, etc.)

---

## 6. DATABASE STRUCTURE CHANGES

### New Collections:

**teams:**
- Purpose: Store team information
- Key fields: teamId, name, leaderId, members array, maxSize, currentSize, inviteCode, averageMMR, isActive, createdAt
- Indexes: inviteCode (unique), name (unique)

**online_users:**
- Purpose: Real-time presence tracking
- Key fields: uid, username, mmr, rank, teamId, teamName, isInQueue, isInMatch, lastHeartbeat
- Indexes: lastHeartbeat (for cleanup queries)
- Lifecycle: Document created when user goes online, deleted when lastHeartbeat > 2 min

**challenges:**
- Purpose: Store challenge requests
- Key fields: challengeId, fromId, fromType, fromName, toId, toType, toName, difficulty, teamSize, status, createdAt, expiresAt
- Indexes: status, expiresAt (for cleanup)
- Lifecycle: Created on send, updated on response, cleaned up after 1 hour

### Modified Collections:

**users (add fields):**
- currentTeamId: string or null (which team user is in)
- onlineStatus object:
  - isOnline: boolean
  - lastHeartbeat: timestamp
  - currentPage: string ('matchmaking', 'match', 'offline')

**queues (add fields):**
- playerId: string or null (if solo player)
- teamId: string or null (if team queuing)
- type: 'solo' or 'team'
- averageMMR: number (individual MMR or team average)

**matches (add field):**
- type: 'ranked' or 'challenge' (to distinguish queue matches from challenge matches)

---

## 7. BACKEND API ENDPOINTS TO CREATE

### Team Routes:

**POST /api/teams/create**
- Body: { teamName, maxSize }
- Validation: Name unique, maxSize 2-4, user not in team
- Action: Generate invite code, create team, set user as leader
- Return: Team object with invite code

**POST /api/teams/join**
- Body: { inviteCode }
- Validation: Code exists, team not full, user not in team
- Action: Add user to members, recalculate average MMR
- Return: Updated team object

**POST /api/teams/leave**
- Validation: User is in team
- Action: Remove from members, transfer leadership if needed, recalculate MMR
- Return: Success confirmation

**DELETE /api/teams/:teamId/disband**
- Validation: User is team leader
- Action: Set isActive false, remove all members, clear their currentTeamId
- Return: Success confirmation

**GET /api/teams/:teamId**
- Return: Team details (name, members, stats)

### Presence Routes:

**POST /api/presence/heartbeat**
- Body: { currentPage }
- Action: Update online_users entry, update user onlineStatus, cleanup stale entries
- Return: { success: true, onlineCount: number }

**GET /api/matchmaking/online-players**
- Query params: mode ('solo' | 'team'), minMMR, maxMMR
- Action: Query online_users, filter by availability and MMR, separate into players/teams
- Return: { players: [...], teams: [...] }

### Challenge Routes:

**POST /api/challenges/send**
- Body: { targetId, targetType, difficulty, teamSize }
- Validation: Target online and available, challenger available
- Action: Create challenge, send WebSocket notification to target
- Return: { success: true, challengeId }

**POST /api/challenges/:challengeId/respond**
- Body: { action: 'accept' | 'decline' }
- Validation: Challenge not expired, user is target
- Action: If accept → create match immediately; If decline → update status
- Return: { success: true, matchId? }

**GET /api/challenges/received**
- Return: List of pending challenges sent to current user/team

**GET /api/challenges/sent**
- Return: List of pending challenges sent by current user/team

### Enhanced Queue Routes:

**POST /api/queue/join**
- Body: { mode: 'solo' | 'team', difficulty, teamSize }
- Validation: If team mode → user must be in team, team size valid
- Action: Create queue entry with playerId OR teamId, mark online_users as isInQueue
- Return: Queue confirmation

**POST /api/queue/leave**
- Action: Remove from queue, update online_users isInQueue flag
- Return: Success confirmation

---

## 8. WEBSOCKET EVENTS

### Server → Client (Backend Emits):

**'matchmaking:found'**
- When: Queue matching algorithm finds opponent
- Data: { matchId, opponent: { name, mmr }, difficulty, teamSize }
- Action: Client redirects to /match/:matchId

**'challenge:received'**
- When: Someone sends you a challenge
- Data: { challengeId, from: { id, name, type }, difficulty, teamSize, expiresAt }
- Action: Client shows challenge modal

**'challenge:accepted'**
- When: Your challenge was accepted
- Data: { challengeId, matchId }
- Action: Client redirects to /match/:matchId

**'challenge:declined'**
- When: Your challenge was declined
- Data: { challengeId, reason: 'declined' | 'expired' }
- Action: Client shows notification

**'online_users:update'**
- When: Online users list changes (someone joins/leaves matchmaking)
- Data: { players: [...], teams: [...] }
- Action: Client updates online list display

### Client → Server (Frontend Emits):

**'presence:online'**
- When: User connects to Socket.IO
- Data: { uid }
- Action: Server marks user online, broadcasts update

**'matchmaking:join'**
- When: User enters matchmaking hub page
- Action: Server adds socket to 'matchmaking' room for broadcasts

**'matchmaking:leave'**
- When: User leaves matchmaking hub page
- Action: Server removes socket from 'matchmaking' room

**'queue:entered'**
- When: User clicks "Enter Queue"
- Data: { difficulty, teamSize, mode }
- Action: Server triggers matchmaking algorithm

**'queue:left'**
- When: User clicks "Cancel Queue"
- Action: Server removes from queue

---

## 9. MATCHMAKING ALGORITHM UPDATE

### Current System:
ELO-based matching within same difficulty/team size

### Enhancement Needed:

**Support Two Types:**
1. Solo players (individual MMR)
2. Teams (average team MMR)

**Matching Logic:**

Solo Queue:
- Match solo player vs solo player
- Use individual MMR for comparison
- MMR tolerance: Start ±100, expand ±50 every 30 seconds waiting (max ±500)

Team Queue:
- Match team vs team
- Use average team MMR for comparison
- Same tolerance expansion
- Must match on team size (2v2, 3v3, or 4v4)

**Queue Entry Updates:**
- Store: playerId (if solo) OR teamId (if team)
- Store: type ('solo' or 'team')
- Store: averageMMR (individual or team average)
- Match only: same type, same difficulty, same teamSize, similar MMR

**Match Creation:**
- If solo: Create match with single player per team
- If team: Create match with all team members in roster
- Update match document with correct player UIDs in teamA and teamB arrays

---

## 10. FRONTEND PAGES TO CREATE

### Page 1: Team Setup (`/team-setup`)

**When Shown:**
- After login
- If user.currentTeamId is null
- If localStorage 'skipTeam' is not true

**Layout:**
- Center card with three options as large buttons
- "Create Team" button → Opens modal with team name input and size selector
- "Join Team" button → Opens modal with invite code input
- "Skip - Play Solo" button → Sets skipTeam flag, navigates to matchmaking

**Modals:**
- Create modal: Team name field, max size radio buttons (2/3/4), Create button
- Join modal: Invite code input (6 chars, auto-uppercase), Join button
- Success modal: Shows team info, displays invite code if created, Continue button

### Page 2: Matchmaking Hub (`/matchmaking`)

**Layout:**
Three sections in grid:

**Top Bar (Full Width):**
- Left: User/team info with avatar and stats
- Center: Page title "Matchmaking Hub"
- Right: Online count, Leave Team button (if in team)

**Left Column (Settings Panel):**
- Mode selector (Solo/Team radio)
- Difficulty selector (Beginner/Advanced/Expert radio)
- Team size buttons (1v1/2v2/3v3/4v4)
- Match info display (estimated MMR, wait time, duration)
- Enter Queue / Cancel Queue button (toggles based on state)
- Queue status: "Searching..." with timer if queued

**Right Column (Online List):**
- Header: "Online Players" or "Online Teams" (based on mode)
- Filter dropdown: MMR range (±200/±500/Any)
- Scrollable list of cards, each showing:
  - Name, MMR, rank/member count
  - Challenge button
  - Online indicator (green dot)
- Empty state: "No players online" if list empty

**Modals:**
- Challenge modal (when receiving): Shows sender, settings, countdown, Accept/Decline
- Challenge sent confirmation toast
- Challenge accepted/declined notifications

### Page 3: Updates to Existing Pages

**Login Page:**
- After auth success: Check if user needs team setup
- If yes → Navigate to /team-setup
- If no → Navigate to /matchmaking (not /dashboard)

**Dashboard Page:**
- Add "Matchmaking" nav link to main navigation
- Add "Team Settings" link if user in team

**Settings/Profile Page:**
- Add "Team Management" section
- Show current team info if in team
- "Leave Team" button
- "Create Team" button if not in team
- "Join Team" with code input if not in team

---

## 11. CRITICAL IMPLEMENTATION REQUIREMENTS

### Team Formation:

1. Invite codes MUST be exactly 6 characters, alphanumeric, uppercase
2. Team names MUST be unique across entire platform
3. User can only be in ONE team at a time
4. Team average MMR recalculates whenever members change
5. If team leader leaves and members remain: Auto-transfer to oldest member (by joinedAt)
6. If team leader leaves and no members: Mark team isActive = false (soft delete)

### Online Presence:

1. Heartbeat MUST run every 30 seconds when user on platform
2. User marked offline if lastHeartbeat > 2 minutes ago
3. Cleanup stale online_users on every heartbeat request
4. Update both online_users collection AND users.onlineStatus object
5. Online list MUST exclude: users in queue, users in match, self

### Challenge System:

1. Challenges expire EXACTLY 2 minutes after creation
2. Only ONE pending challenge allowed per challenger-target pair
3. Maximum 3 outgoing pending challenges per user/team
4. Auto-decline on: expiration, target goes offline, target enters queue/match
5. Challenge matches created immediately (skip queue)
6. Challenge matches have type='challenge' (distinguish from ranked)

### Queue & Matching:

1. Solo queue stores playerId, team queue stores teamId (never both)
2. MMR tolerance expansion: +50 every 30 seconds (max +500 from base ±100)
3. Match ONLY same: type, difficulty, teamSize
4. When team queues: ALL members added to match roster
5. When match found: Remove BOTH from queue, update online status

### Real-Time Updates:

1. WebSocket required for: challenge notifications, match found, online list updates
2. Polling acceptable for: online list refresh (every 10s), heartbeat (every 30s)
3. Socket.IO namespace: Use existing or create '/matchmaking'
4. Room structure: 'matchmaking' room for all users in hub

### Error Handling:

1. Team full: "This team has reached maximum capacity"
2. Already in team: "You must leave your current team first"
3. Invalid code: "Invalid invite code"
4. Target offline: "This player/team is not currently online"
5. Challenge expired: "This challenge has expired"
6. Target busy: "This player/team is currently unavailable"

---

## 12. TESTING SCENARIOS

### Scenario 1: Create Team → Team Queue → Match
1. Player A logs in → Sees team setup screen
2. Clicks "Create Team" → Enters "Alpha Squad", selects max 4
3. Gets invite code "XYZ789" displayed in modal
4. Player B logs in → Sees team setup screen  
5. Clicks "Join Team" → Enters "XYZ789"
6. Both now in Team Alpha with average MMR calculated
7. Team leader (Player A) enters matchmaking hub
8. Selects: Team mode, Advanced difficulty, 2v2
9. Clicks "Enter Queue"
10. System finds another 2-person team with similar MMR
11. Both teams redirected to match

### Scenario 2: Solo Player Challenges Another Solo
1. Player A logs in → Clicks "Skip - Play Solo"
2. Enters matchmaking hub → Sees Player B in online list
3. Player B has similar MMR (within ±200)
4. Player A clicks "Challenge" next to Player B
5. Player B receives modal: "Player A challenges you! Advanced 1v1"
6. Countdown starts at 2:00 minutes
7. Player B clicks "Accept" at 1:45 remaining
8. Match created immediately (type: 'challenge')
9. Both redirected to /match/:matchId
10. Match starts normally

### Scenario 3: Team Challenge with Decline
1. Team Alpha (3 players, avg MMR 1650) in matchmaking hub
2. Team Bravo (3 players, avg MMR 1700) also in hub
3. Both appear in each other's "Online Teams" list
4. Team Alpha leader clicks "Challenge" on Team Bravo
5. Team Bravo leader sees modal: "Team Alpha challenges you! Expert 3v3"
6. Team Bravo leader clicks "Decline"
7. Team Alpha gets notification: "Team Bravo declined your challenge"
8. Both remain in matchmaking hub

### Scenario 4: Challenge Expiration
1. Player A sends challenge to Player B
2. Player B sees modal, doesn't respond
3. Countdown reaches 0:00
4. Challenge auto-declined (status: expired)
5. Player B's modal closes automatically
6. Player A gets notification: "Challenge expired"

### Scenario 5: Leave Team During Match
1. Team Alpha in active match
2. Player X (non-leader member) clicks "Leave Team" from settings
3. System prevents: "Cannot leave team during active match"
4. After match ends, Player X leaves successfully
5. Team Alpha now has 2 members (recalculated average MMR)
6. If Player X was last member, team marked isActive = false

---

## 13. UI/UX REQUIREMENTS

### Visual Design:
- Match existing dark theme with neon accents
- Use existing components where possible (NeonCard, NeonButton)
- Team setup: Large centered card, dark background
- Matchmaking hub: Two-column layout (settings left, online right)
- Challenge modal: Centered overlay with backdrop, pulsing countdown

### Loading States:
- "Creating team..." when submitting creation
- "Joining team..." when entering code
- "Loading online players..." when fetching list
- "Sending challenge..." when challenge button clicked
- "Searching for match..." when in queue with animated icon

### Empty States:
- Team setup: Default state with three large option buttons
- Online list empty: "No players online" with refresh button
- No team: "You are not in a team" in profile section

### Error States:
- Invalid invite code: Red border on input, error text below
- Team full: Toast notification with error message
- Challenge failed: Toast notification with reason
- Network error: Retry button with error message

### Notifications:
- Challenge received: Modal popup with sound (optional)
- Challenge accepted: Toast notification with success icon
- Challenge declined: Toast notification with neutral icon
- Match found: Full screen transition to match page

### Accessibility:
- All buttons keyboard accessible
- Form inputs have labels
- Modals closeable with ESC key
- Focus management in modals
- Screen reader friendly status messages

---

## 14. IMPLEMENTATION PRIORITY ORDER

### Phase 1: Database & Backend Foundation
1. Create Firestore collections: teams, online_users, challenges
2. Add fields to users collection: currentTeamId, onlineStatus
3. Add fields to queues collection: playerId, teamId, type, averageMMR
4. Add field to matches collection: type
5. Create backend services: teamService, presenceService, challengeService
6. Create API routes: /teams/*, /presence/*, /challenges/*
7. Update queue routes to support solo/team mode

### Phase 2: WebSocket Real-Time
1. Add Socket.IO event handlers for presence (online/offline)
2. Add Socket.IO event handlers for challenges (send/receive/respond)
3. Add Socket.IO broadcast for online list updates
4. Update matchmaking algorithm to handle solo vs team queues
5. Test WebSocket events in isolation

### Phase 3: Frontend - Team Setup
1. Create TeamSetup page component
2. Create team creation modal
3. Create team join modal
4. Implement skip functionality with localStorage
5. Add routing logic: login → team-setup → matchmaking
6. Test team creation, joining, and skip flows

### Phase 4: Frontend - Matchmaking Hub
1. Create MatchmakingHub page component
2. Build settings panel (left column)
3. Build online players/teams list (right column)
4. Implement mode switching (solo/team)
5. Connect to Socket.IO for real-time updates
6. Add heartbeat interval (every 30s)
7. Add online list refresh (every 10s)

### Phase 5: Challenge System
1. Create ChallengeModal component
2. Implement challenge send flow
3. Implement challenge receive flow with countdown
4. Add accept/decline actions
5. Add expiration auto-decline
6. Add challenge notifications (toasts)
7. Test full challenge flow end-to-end

### Phase 6: Integration & Testing
1. Test: Solo player skip → queue → match
2. Test: Create team → join member → queue → match
3. Test: Solo challenge solo → accept → match
4. Test: Team challenge team → decline
5. Test: Challenge expiration
6. Test: Leave team scenarios
7. Test: Online/offline status accuracy
8. Test: Concurrent users and race conditions

---

## 15. SUCCESS CRITERIA CHECKLIST

**Team Formation:**
- [ ] User can create team with unique name and invite code
- [ ] User can join team with valid invite code
- [ ] User can skip team setup and play solo
- [ ] Team leader can disband team
- [ ] Any member can leave team
- [ ] Team average MMR recalculates correctly
- [ ] Leadership transfers when leader leaves

**Online Presence:**
- [ ] Users marked online when entering matchmaking hub
- [ ] Heartbeat keeps users online (every 30s)
- [ ] Users marked offline after 2 minutes of inactivity
- [ ] Online list shows only available players/teams
- [ ] Online list updates in real-time
- [ ] Online count displays correctly

**Challenge System:**
- [ ] User can send challenge to online opponent
- [ ] Target receives challenge modal with countdown
- [ ] Accept creates match immediately
- [ ] Decline notifies sender
- [ ] Challenge expires after 2 minutes
- [ ] Cannot challenge users in queue or match
- [ ] Maximum 3 pending outgoing challenges enforced

**Matchmaking:**
- [ ] Solo queue matches solo vs solo
- [ ] Team queue matches team vs team
- [ ] MMR tolerance expands over time
- [ ] Queue respects difficulty and team size
- [ ] Match found notification works
- [ ] Both queue and challenge paths work

**Error Handling:**
- [ ] All error messages clear and helpful
- [ ] Cannot join full team
- [ ] Cannot join team while in another team
- [ ] Cannot challenge offline users
- [ ] Cannot send duplicate challenges
- [ ] Invalid invite codes rejected

**UI/UX:**
- [ ] Loading states on all async actions
- [ ] Empty states display correctly
- [ ] Modals closeable and accessible
- [ ] Notifications appear for all events
- [ ] Responsive design works on mobile
- [ ] Dark theme consistent throughout

---

## 16. COMMON PITFALLS TO AVOID

1. **Race Conditions:**
   - Don't allow team join if someone else just filled last slot
   - Use Firestore transactions for team member addition
   - Lock queue entry while match creation in progress

2. **Stale Data:**
   - Always refresh online list before showing challenge button
   - Validate challenge target still online when sending
   - Check team still exists before joining via code

3. **Memory Leaks:**
   - Clear heartbeat interval when component unmounts
   - Close Socket.IO connection on logout
   - Remove event listeners when leaving matchmaking page

4. **UX Confusion:**
   - Show clear difference between queue and challenge modes
   - Disable queue button when in team but team too small
   - Show team size clearly (e.g., "3/4 members")

5. **Performance:**
   - Debounce online list refresh (don't hammer every second)
   - Paginate online list if >100 entries
   - Use Firestore indexes for all queries

6. **Security:**
   - Validate team size on server (don't trust client)
   - Verify user is team leader before disband
   - Check challenge not expired before creating match
   - Rate limit challenge sends (max 10 per minute)

---

## 17. FINAL NOTES

### This Feature is ADDITIVE:
- Does NOT replace existing queue system
- Does NOT modify existing match structure  
- Does NOT change admin functionality
- Does NOT alter MMR/ranking calculations

### Players Can Choose:
- Solo play (skip team setup)
- Team play (create or join)
- Normal queue (ELO-based matching)
- Direct challenges (instant matches)

### All Existing Features Work:
- Current matchmaking still functions
- Existing matches unaffected
- Admin panel unchanged
- Leaderboard unchanged

### Integration Points:
- Team setup: Insert between login and dashboard
- Matchmaking hub: Becomes new main pre-match page
- Challenge matches: Use existing match engine
- Online presence: Layers on top of existing auth

This specification is complete and ready for implementation. No code provided - only requirements, flows, and success criteria.
