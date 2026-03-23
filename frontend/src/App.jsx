import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SalesPipeline from './pages/SalesPipeline';
import Onboarding from './pages/Onboarding';
import SocietyReg from './pages/SocietyReg';
import Royalty from './pages/Royalty';
import Members from './pages/Members';
import MemberProfile from './pages/MemberProfile';
import Tracker from './pages/Tracker';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import SpocManagement from './pages/SpocManagement';

const ProtectedRoutes = () => {
  const { user, loading, isFullAccess, hasRole } = useAuth();

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '16px' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Role-gated wrapper: redirects to "/" if user lacks access
  const Gate = ({ roles, fullOnly, children }) => {
    if (fullOnly && !isFullAccess) return <Navigate to="/" replace />;
    if (roles && !isFullAccess && !roles.some((r) => hasRole(r))) return <Navigate to="/" replace />;
    return children;
  };

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sales-pipeline" element={<SalesPipeline />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/society-reg" element={<SocietyReg />} />
        <Route path="/royalty" element={<Royalty />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberProfile />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/spoc-management" element={<Gate fullOnly><SpocManagement /></Gate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

const LoginGuard = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
};

const SessionTimeoutModal = () => {
  const { sessionExpired, dismissSessionExpired } = useAuth();
  if (!sessionExpired) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '400px',
          padding: '36px',
          backgroundColor: '#141720',
          borderRadius: '16px',
          border: '1px solid #1e2540',
          textAlign: 'center',
        }}
      >
        {/* Clock icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Session Timed Out
        </h3>
        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
          You have been logged out due to 10 minutes of inactivity. Please sign in again to continue.
        </p>

        <button
          onClick={dismissSessionExpired}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign In Again
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <SessionTimeoutModal />
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
