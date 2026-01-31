import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Queue from './pages/Queue';
import Profile from './pages/Profile';
import Match from './pages/Match';
import Rankings from './pages/Rankings';
import TeamSetup from './pages/TeamSetup';
import MatchmakingHub from './pages/MatchmakingHub';
import AdminDashboard from './admin/AdminDashboard';
import AdminMatches from './admin/AdminMatches';
import AdminMatchDetail from './admin/AdminMatchDetail';
import AdminPlayers from './admin/AdminPlayers';
import AdminUserActivity from './admin/AdminUserActivity';
import AdminAudit from './admin/AdminAudit';
import AdminReports from './admin/AdminReports';
import AdminSystem from './admin/AdminSystem';
import './styles/globals.css';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] bg-grid-cyber">
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] bg-grid-cyber">
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="team-setup" element={<RequireAuth><TeamSetup /></RequireAuth>} />
          <Route path="matchmaking" element={<RequireAuth><MatchmakingHub /></RequireAuth>} />
          <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="queue" element={<RequireAuth><Queue /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="match/:matchId" element={<RequireAuth><Match /></RequireAuth>} />
          <Route path="rankings" element={<Rankings />} />
        </Route>
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="matches" element={<AdminMatches />} />
          <Route path="matches/:matchId" element={<AdminMatchDetail />} />
          <Route path="players" element={<AdminPlayers />} />
          <Route path="activity" element={<AdminUserActivity />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
