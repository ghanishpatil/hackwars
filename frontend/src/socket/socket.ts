import { io, Socket } from 'socket.io-client';

type MatchState = 'initializing' | 'running' | 'ended';

type MatchStatePayload = {
  matchId: string;
  state: MatchState;
};

let socket: Socket | null = null;

function getSocketServerUrl() {
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
}

/**
 * Initialize the Socket.IO client for the /match namespace.
 *
 * Caller is responsible for providing a valid Firebase ID token.
 */
export function connectMatchSocket(idToken: string) {
  if (socket) {
    return socket;
  }

  socket = io(`${getSocketServerUrl()}/match`, {
    transports: ['websocket'],
    auth: {
      token: idToken,
    },
  });

  socket.on('connect_error', (err) => {
    console.error('Match socket connection error:', err);
  });

  return socket;
}

/**
 * Join a match room.
 *
 * The backend will verify that the authenticated user belongs
 * to the specified match before actually joining the room.
 */
export function joinMatch(matchId: string) {
  if (!socket) {
    console.warn('Socket not connected. Call connectMatchSocket first.');
    return;
  }

  socket.emit('join_match', { matchId });
}

/**
 * Register a listener for match state updates.
 */
export function onMatchState(callback: (payload: MatchStatePayload) => void) {
  if (!socket) {
    console.warn('Socket not connected. Call connectMatchSocket first.');
    return;
  }

  socket.on('match_state', callback);
}

/**
 * Remove match state listener (for React cleanup).
 */
export function offMatchState(callback: (payload: MatchStatePayload) => void) {
  if (!socket) return;
  socket.off('match_state', callback);
}

export type AdminBroadcastPayload = { message: string; from?: string };

/**
 * Register a listener for admin broadcast messages (real-time).
 */
export function onAdminBroadcast(callback: (payload: AdminBroadcastPayload) => void) {
  if (!socket) return;
  socket.on('admin_broadcast', callback);
}

/**
 * Remove admin broadcast listener (for React cleanup).
 */
export function offAdminBroadcast(callback: (payload: AdminBroadcastPayload) => void) {
  if (!socket) return;
  socket.off('admin_broadcast', callback);
}

/**
 * Disconnect the match socket cleanly.
 */
export function disconnectMatchSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

// ——— Matchmaking namespace ———
let matchmakingSocket: Socket | null = null;

export function connectMatchmakingSocket(idToken: string) {
  if (matchmakingSocket) return matchmakingSocket;
  matchmakingSocket = io(`${getSocketServerUrl()}/matchmaking`, {
    transports: ['websocket'],
    auth: { token: idToken },
  });
  matchmakingSocket.on('connect_error', (err) => {
    console.error('Matchmaking socket connection error:', err);
  });
  return matchmakingSocket;
}

export function disconnectMatchmakingSocket() {
  if (!matchmakingSocket) return;
  matchmakingSocket.disconnect();
  matchmakingSocket = null;
}

export function getMatchmakingSocket() {
  return matchmakingSocket;
}

export function onChallengeReceived(callback: (payload: { challengeId: string; from: { id: string; name: string; type: string }; difficulty: string; teamSize: number; expiresAt: number }) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.on('challenge:received', callback);
}

export function offChallengeReceived(callback: (payload: unknown) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.off('challenge:received', callback);
}

export function onChallengeAccepted(callback: (payload: { challengeId: string; matchId: string }) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.on('challenge:accepted', callback);
}

export function offChallengeAccepted(callback: (payload: unknown) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.off('challenge:accepted', callback);
}

export function onChallengeDeclined(callback: (payload: { challengeId: string; reason: string }) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.on('challenge:declined', callback);
}

export function offChallengeDeclined(callback: (payload: unknown) => void) {
  if (!matchmakingSocket) return;
  matchmakingSocket.off('challenge:declined', callback);
}

