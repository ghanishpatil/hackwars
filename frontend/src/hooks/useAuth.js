import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { setApiToken, clearApiToken, api } from '../api/client';
import { connectMatchSocket, disconnectMatchSocket, connectMatchmakingSocket, disconnectMatchmakingSocket } from '../socket/socket';

/**
 * Auth state: role comes from DB (GET /auth/me), not from token claims.
 * Normal users have role "user"; only users with role "admin" in Firestore get admin access.
 * Banned users get 403 from /auth/me; we sign them out and set bannedMessage so the UI can notify them.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannedMessage, setBannedMessage] = useState(null);

  const clearBannedMessage = useCallback(() => setBannedMessage(null), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setIsAdmin(false);
        clearApiToken();
        disconnectMatchSocket();
        disconnectMatchmakingSocket();
        setBannedMessage((prev) => prev);
        setLoading(false);
        return;
      }
      const idToken = await fbUser.getIdToken();
      setApiToken(idToken);
      connectMatchSocket(idToken);
      connectMatchmakingSocket(idToken);
      try {
        const profile = await api.getMe();
        setBannedMessage(null);
        setUser({
          uid: profile.uid,
          email: profile.email,
          username: profile.username,
          displayName: profile.displayName ?? '',
          phone: profile.phone ?? '',
          institute: profile.institute ?? '',
          track: profile.track ?? '',
          role: profile.role ?? 'user',
          mmr: profile.mmr,
          rank: profile.rank,
          rp: profile.rp,
          currentTeamId: profile.currentTeamId ?? null,
          onlineStatus: profile.onlineStatus ?? null,
        });
        setIsAdmin(profile.role === 'admin');
      } catch (err) {
        if (err.status === 403 && err.data?.code === 'banned') {
          setBannedMessage(err.data?.error || 'Your account has been banned.');
          await fbSignOut(auth);
          setUser(null);
          setIsAdmin(false);
          clearApiToken();
          disconnectMatchSocket();
          disconnectMatchmakingSocket();
        } else {
          setUser({ uid: fbUser.uid, email: fbUser.email ?? null });
          setIsAdmin(false);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signIn = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email, password) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await fbSignOut(auth);
    clearApiToken();
    disconnectMatchSocket();
    disconnectMatchmakingSocket();
  };

  return { user, isAdmin, loading, bannedMessage, clearBannedMessage, signIn, signUp, signOut, auth };
}
