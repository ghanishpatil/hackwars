/**
 * Socket.IO Event Handlers
 *
 * Handles real-time communication via Socket.IO.
 *
 * In this step, we only implement match state propagation:
 * - Namespace: /match
 * - Client event:  join_match
 * - Server event:  match_state
 */

import { getAuth, getFirestore } from '../firebase/firebaseAdmin.js';
import { registerSocketServer } from '../services/matchStateService.js';

/**
 * Initialize Socket.IO event handlers.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function initializeSockets(io) {
  // Make Socket.IO server available to other services (e.g., match state polling).
  registerSocketServer(io);

  const matchNamespace = io.of('/match');

  // Per-socket authentication using Firebase ID token.
  matchNamespace.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token) {
        return next(new Error('Missing auth token'));
      }

      const auth = getAuth();
      if (!auth) {
        return next(new Error('Authentication service not available'));
      }

      const decoded = await auth.verifyIdToken(token);
      // Attach decoded user to socket for downstream handlers.
      socket.user = decoded;

      return next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      return next(new Error('Authentication failed'));
    }
  });

  matchNamespace.on('connection', (socket) => {
    console.log(`Match namespace socket connected: ${socket.id}`);

    socket.on('join_match', async (payload) => {
      try {
        const { matchId } = payload || {};
        const uid = socket.user?.uid;

        if (!uid) {
          return;
        }

        if (!matchId || typeof matchId !== 'string') {
          return;
        }

        const firestore = getFirestore();
        if (!firestore) {
          return;
        }

        const matchRef = firestore.collection('matches').doc(matchId);
        const snap = await matchRef.get();

        if (!snap.exists) {
          // Do not join non-existent matches.
          return;
        }

        const data = snap.data() || {};
        const teamA = Array.isArray(data.teamA) ? data.teamA : [];
        const teamB = Array.isArray(data.teamB) ? data.teamB : [];

        const isParticipant =
          teamA.includes(uid) || teamB.includes(uid);

        if (!isParticipant) {
          // User is not authorized for this match; do not join room.
          return;
        }

        const room = `match:${matchId}`;
        await socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      } catch (error) {
        console.error('Error handling join_match:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Match namespace socket disconnected: ${socket.id}`);
    });
  });

  // ——— Matchmaking namespace: presence, challenges, match found ———
  const matchmakingNamespace = io.of('/matchmaking');

  matchmakingNamespace.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);
      if (!token) return next(new Error('Missing auth token'));
      const auth = getAuth();
      if (!auth) return next(new Error('Authentication service not available'));
      const decoded = await auth.verifyIdToken(token);
      socket.user = decoded;
      return next();
    } catch (error) {
      console.error('Matchmaking socket auth failed:', error);
      return next(new Error('Authentication failed'));
    }
  });

  matchmakingNamespace.on('connection', (socket) => {
    const uid = socket.user?.uid;
    if (!uid) return;
    socket.join(`user:${uid}`);
    socket.join('matchmaking');
    console.log(`Matchmaking socket connected: ${socket.id} (user: ${uid})`);

    socket.on('disconnect', () => {
      console.log(`Matchmaking socket disconnected: ${socket.id}`);
    });
  });
}

