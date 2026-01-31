/**
 * Static mock data for UI-only build. No API calls.
 */

export const MOCK_USER = {
  username: 'h4x0r_01',
  mmr: 1842,
  rank: 'Diamond',
  rp: 420,
  avatar: null,
};

export const MOCK_RECENT_MATCHES = [
  { id: 'm1', result: 'win', score: '3 - 1', difficulty: 'Medium', date: '2h ago' },
  { id: 'm2', result: 'loss', score: '1 - 2', difficulty: 'Hard', date: '5h ago' },
  { id: 'm3', result: 'win', score: '2 - 0', difficulty: 'Easy', date: '1d ago' },
];

export const MOCK_SYSTEM_FEED = [
  { id: 1, type: 'flag', text: 'Flag captured on service_web by team A', time: '00:42' },
  { id: 2, type: 'down', text: 'service_db went DOWN', time: '01:15' },
  { id: 3, type: 'up', text: 'service_db restored', time: '01:18' },
  { id: 4, type: 'flag', text: 'Flag captured on service_api by team B', time: '02:00' },
];

export const MOCK_SERVICES = [
  { id: 'web', name: 'service_web', status: 'up', points: 100 },
  { id: 'api', name: 'service_api', status: 'up', points: 100 },
  { id: 'db', name: 'service_db', status: 'down', points: 0 },
  { id: 'auth', name: 'service_auth', status: 'up', points: 100 },
];

export const MOCK_MATCH = {
  id: 'match-cyber-001',
  timer: '12:34',
  scoreA: 3,
  scoreB: 1,
  teamA: 'Attack',
  teamB: 'Defense',
  services: MOCK_SERVICES,
  feed: MOCK_SYSTEM_FEED,
};

export const MOCK_RANKINGS = [
  { rank: 1, username: 'elite_0', mmr: 2450, rankName: 'Zero-Day' },
  { rank: 2, username: 'cyber_ninja', mmr: 2320, rankName: 'APT Unit' },
  { rank: 3, username: 'h4x0r_01', mmr: 1842, rankName: 'Red Operator' },
  { rank: 4, username: 'pwn_all', mmr: 1780, rankName: 'Exploit Crafter' },
  { rank: 5, username: 'flag_hunter', mmr: 1650, rankName: 'Packet Sniffer' },
];

export const MOCK_ADMIN_OVERVIEW = {
  activeUsers: 42,
  activeQueues: 3,
  activeMatches: 5,
  engineHealth: { status: 'ok', uptime: 86400 },
};

export const MOCK_ADMIN_MATCHES = [
  { matchId: 'm-001', difficulty: 'Medium', status: 'running', teamA: 2, teamB: 2, invalid: false },
  { matchId: 'm-002', difficulty: 'Hard', status: 'finished', teamA: 2, teamB: 2, invalid: false },
];

export const MOCK_ADMIN_PLAYERS = [
  { uid: 'u1', username: 'elite_0', mmr: 2450, rank: 'Master', banned: false, shadowBan: false },
  { uid: 'u2', username: 'cyber_ninja', mmr: 2320, rank: 'Diamond', banned: false, shadowBan: false },
];
